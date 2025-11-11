import { Router } from "express";
import { prisma } from "../lib/prisma";
import { z } from "zod";
import { authRequired } from "../middleware/auth";
import { requirePerm } from "../middleware/perm";

const router = Router();

/* =================== ZOD SCHEMAS =================== */
const FaseSchema = z.object({
  nombre: z.string().min(2).max(80),
  fechaInicio: z.string().transform((v) => new Date(v)),
  fechaFin: z.string().transform((v) => new Date(v)),
});

const EtapaItemSchema = z
  .object({
    etapa: z.enum(["INSCRIPCION","DESARROLLO","EVALUACION","CORRECCION","PREMIACION"]),
    fechaInicio: z.string().transform((v) => new Date(v)),
    fechaFin: z.string().nullable().transform((v) => (v ? new Date(v) : null)),
  })
  .superRefine((val, ctx) => {
    if (val.etapa !== "CORRECCION" && !val.fechaFin) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "fechaFin es obligatoria para esta etapa",
        path: ["fechaFin"],
      });
    }
  });

const CompetitionCreateBody = z.object({
  nombre: z.string().min(3),
  nivel: z.enum(["PRINCIPIANTE", "INTERMEDIO", "AVANZADO"]),
  area: z.enum(["MATEMATICA", "FISICA", "ROBOTICA", "QUIMICA", "PROGRAMACION"]),
  participantes: z.number().min(1).max(5),
  modalidad: z.enum(["PRESENCIAL", "VIRTUAL"]),
  formaCalificacion: z.string().max(400),
  fases: z.array(FaseSchema).min(1),
  etapas: z.array(EtapaItemSchema).min(1),
});

const CompetitionUpdateBody = z.object({
  nombre: z.string().min(3).optional(),
  nivel: z.enum(["PRINCIPIANTE", "INTERMEDIO", "AVANZADO"]).optional(),
  area: z.enum(["MATEMATICA", "FISICA", "ROBOTICA", "QUIMICA", "PROGRAMACION"]).optional(),
  participantes: z.number().min(1).max(5).optional(),
  modalidad: z.enum(["PRESENCIAL", "VIRTUAL"]).optional(),
  formaCalificacion: z.string().max(400).optional(),
  fechaInicio: z.string().transform((v) => new Date(v)).optional(),
  fases: z.array(FaseSchema).min(1).optional(),
  etapas: z.array(EtapaItemSchema).min(1).optional(),
});

/* =================== HELPERS =================== */
function validarSolapes(
  fases: { fechaInicio: Date; fechaFin: Date; nombre: string }[]
) {
  const s = [...fases].sort((a, b) => a.fechaInicio.getTime() - b.fechaInicio.getTime());
  for (let i = 0; i < s.length - 1; i++) {
    if (s[i].fechaFin > s[i + 1].fechaInicio) {
      return `Las fechas de la fase "${s[i + 1].nombre}" se solapan con "${s[i].nombre}"`;
    }
  }
  return null;
}


function validarFasesEnDesarrollo(
  fases: { fechaInicio: Date; fechaFin: Date; nombre: string }[],
  etapas: { etapa: string; fechaInicio: Date; fechaFin: Date | null }[]
) {
  
  const etapaDesarrollo = etapas.find(e => e.etapa === "DESARROLLO");
  
  if (!etapaDesarrollo) {
    return "No se encontró la etapa de DESARROLLO";
  }

  if (!etapaDesarrollo.fechaFin) {
    return "La etapa de DESARROLLO debe tener fecha de fin para validar las fases";
  }

  
  for (const fase of fases) {
    
    if (fase.fechaFin < fase.fechaInicio) {
      return `La fase "${fase.nombre}" tiene fecha de fin (${fase.fechaFin.toLocaleDateString()}) anterior a la fecha de inicio (${fase.fechaInicio.toLocaleDateString()})`;
    }

    
    if (fase.fechaInicio < etapaDesarrollo.fechaInicio) {
      return `La fase "${fase.nombre}" inicia (${fase.fechaInicio.toLocaleDateString()}) antes del inicio de la etapa de DESARROLLO (${etapaDesarrollo.fechaInicio.toLocaleDateString()})`;
    }
    
    if (fase.fechaFin > etapaDesarrollo.fechaFin) {
      return `La fase "${fase.nombre}" finaliza (${fase.fechaFin.toLocaleDateString()}) después del fin de la etapa de DESARROLLO (${etapaDesarrollo.fechaFin.toLocaleDateString()})`;
    }
  }

  return null;
}

function ahora() { return new Date(); }
function isBetween(d: Date, ini: Date, fin?: Date | null) {
  const t = d.getTime(), a = ini.getTime(), b = fin ? fin.getTime() : Number.POSITIVE_INFINITY;
  return t >= a && t <= b;
}

/* =================== RUTAS =================== */

// Crear
router.post("/", authRequired, requirePerm("competitions.create"), async (req, res) => {
  const parsed = CompetitionCreateBody.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ ok: false, message: "Datos inválidos", errors: parsed.error.issues });

  const data = parsed.data;

  // Validación existente de solapamiento
  const err = validarSolapes(data.fases.map((f) => ({ ...f, nombre: f.nombre })));
  if (err) return res.status(400).json({ ok: false, message: err });

  
  const errFasesDesarrollo = validarFasesEnDesarrollo(
    data.fases.map((f) => ({ ...f, nombre: f.nombre })),
    data.etapas
  );
  if (errFasesDesarrollo) return res.status(400).json({ ok: false, message: errFasesDesarrollo });

  const competition = await prisma.competition.create({
    data: {
      nombre: data.nombre,
      nivel: data.nivel as any,
      area: data.area as any,
      participantes: data.participantes,
      modalidad: data.modalidad as any,
      formaCalificacion: data.formaCalificacion,
      fechaInicio: data.fases[0].fechaInicio,
      estado: true,
      fases: { create: data.fases },
      etapas: {
        create: data.etapas.map((e) => ({
          etapa: e.etapa as any,
          fechaInicio: e.fechaInicio,
          fechaFin: e.fechaFin ?? null,
        })),
      },
    },
    include: { fases: true, etapas: true },
  });

  res.status(201).json({ ok: true, competition });
});

// Listar (home)
router.get("/", authRequired, requirePerm("competitions.read"), async (req: any, res) => {
  const includeHidden = req.user.roleSlug === "ADMIN";
  const where: any = includeHidden ? {} : { estado: true };

  const { q, nivel, area } = req.query ?? {};
  if (q && typeof q === "string") {
    where.OR = [
      { nombre: { contains: q, mode: "insensitive" } },
      { area: { equals: area as any } },
    ];
  }
  if (nivel && typeof nivel === "string") where.nivel = nivel as any;
  if (area && typeof area === "string") where.area = area as any;

  const competitions = await prisma.competition.findMany({
    where,
    include: { fases: true, etapas: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ ok: true, competitions });
});


// En la ruta GET /:id
router.get("/:id", authRequired, requirePerm("competitions.read"), async (req: any, res) => {
  const c = await prisma.competition.findUnique({
    where: { id: req.params.id },
    include: {
      fases: true,
      etapas: true,
      inscripciones: { where: { userId: req.user.id }, select: { id: true } },
      evaluadoresAsignados: { 
        where: { evaluadorId: req.user.id }, 
        select: { id: true } 
      },
    },
  });
  if (!c) return res.status(404).json({ ok: false, message: "No encontrado" });

  res.json({
    ok: true,
    competition: {
      ...c,
      yaInscrito: (c.inscripciones?.length ?? 0) > 0,
      yaAsignadoEvaluador: (c.evaluadoresAsignados?.length ?? 0) > 0,
    },
  });
});

// Actualizar
router.put("/:id", authRequired, requirePerm("competitions.update"), async (req, res) => {
  const parsed = CompetitionUpdateBody.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ ok: false, message: "Datos inválidos", errors: parsed.error.issues });
  const data = parsed.data;

  const exists = await prisma.competition.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ ok: false, message: "No encontrado" });

  if (data.fases && data.etapas) {
    const err = validarSolapes(data.fases.map((f) => ({ ...f, nombre: f.nombre })));
    if (err) return res.status(400).json({ ok: false, message: err });

    const errFasesDesarrollo = validarFasesEnDesarrollo(
      data.fases.map((f) => ({ ...f, nombre: f.nombre })),
      data.etapas
    );
    if (errFasesDesarrollo) return res.status(400).json({ ok: false, message: errFasesDesarrollo });
  }

  const updated = await prisma.competition.update({
    where: { id: req.params.id },
    data: {
      nombre: data.nombre,
      nivel: data.nivel as any,
      area: data.area as any,
      participantes: data.participantes,
      modalidad: data.modalidad as any,
      formaCalificacion: data.formaCalificacion,
      fechaInicio: data.fechaInicio,
    },
    include: { fases: true, etapas: true },
  });

  if (data.fases) {
    const err = validarSolapes(data.fases.map((f) => ({ ...f, nombre: f.nombre })));
    if (err) return res.status(400).json({ ok: false, message: err });


    if (data.etapas) {
      const errFasesDesarrollo = validarFasesEnDesarrollo(
        data.fases.map((f) => ({ ...f, nombre: f.nombre })),
        data.etapas
      );
      if (errFasesDesarrollo) return res.status(400).json({ ok: false, message: errFasesDesarrollo });
    }

    await prisma.fase.deleteMany({ where: { competitionId: updated.id } });
    await prisma.fase.createMany({
      data: data.fases.map((f) => ({
        nombre: f.nombre, fechaInicio: f.fechaInicio, fechaFin: f.fechaFin, competitionId: updated.id,
      })),
    });
  }

  if (data.etapas) {
    await prisma.etapaCompetencia.deleteMany({ where: { competitionId: updated.id } });
    await prisma.etapaCompetencia.createMany({
      data: data.etapas.map((e) => ({
        etapa: e.etapa as any, fechaInicio: e.fechaInicio, fechaFin: e.fechaFin ?? null, competitionId: updated.id,
      })),
    });
  }

  const final = await prisma.competition.findUnique({
    where: { id: req.params.id },
    include: { fases: true, etapas: true },
  });

  res.json({ ok: true, competition: final });
});

// Cambiar estado 
router.put("/:id/estado", authRequired, async (req: any, res) => {
  if (req.user.roleSlug !== "ADMIN")
    return res.status(403).json({ ok: false, message: "Solo ADMIN" });

  const comp = await prisma.competition.findUnique({ where: { id: req.params.id } });
  if (!comp) return res.status(404).json({ ok: false, message: "No encontrado" });

  const updated = await prisma.competition.update({
    where: { id: req.params.id },
    data: { estado: !comp.estado },
  });
  res.json({ ok: true, competition: updated });
});

// Eliminar 
router.delete("/:id", authRequired, requirePerm("competitions.delete"), async (req: any, res) => {
  const comp = await prisma.competition.findUnique({ where: { id: req.params.id } });
  if (!comp) return res.status(404).json({ ok: false, message: "No encontrado" });

  if (req.user.roleSlug === "ADMIN") {
    await prisma.competition.delete({ where: { id: req.params.id } });
    return res.json({ ok: true, deleted: true });
  } else {
    await prisma.competition.update({ where: { id: req.params.id }, data: { estado: false } });
    return res.json({ ok: true, deleted: false });
  }
});


router.post("/:id/inscribirse", authRequired, requirePerm("inscriptions.create"), async (req: any, res) => {
  const comp = await prisma.competition.findUnique({
    where: { id: req.params.id },
    include: { etapas: true, inscripciones: { where: { userId: req.user.id }, select: { id: true } } },
  });
  if (!comp || !comp.estado) return res.status(404).json({ ok: false, message: "Competencia no disponible" });

  
  if ((comp.inscripciones?.length ?? 0) > 0) {
    return res.status(409).json({ ok: false, message: "Ya estás inscrito en esta competencia" });
  }


  const estudiante = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { 
      tutorId: true, 
      role: { select: { slug: true } }
    }
  });


  if (estudiante?.role?.slug === "ESTUDIANTE" && !estudiante.tutorId) {
    return res.status(400).json({ 
      ok: false, 
      message: "No puedes inscribirte sin tener un tutor asignado. Por favor, asigna un tutor primero desde la sección de Tutores." 
    });
  }

 
  const insc = comp.etapas.find(e => e.etapa === "INSCRIPCION");
  if (insc) {
    const dentro = isBetween(ahora(), insc.fechaInicio, insc.fechaFin ?? undefined);
    if (!dentro) return res.status(400).json({ ok:false, message: "La etapa de inscripción no está vigente" });
  }

  await prisma.inscripcion.create({
    data: {
      userId: req.user.id,
      competitionId: comp.id
    }
  });

  res.json({ ok: true, message: "Inscripción realizada" });
});


router.delete(
  "/:id/desinscribirse",
  authRequired,
  requirePerm("inscriptions.delete"),
  async (req: any, res) => {
    try {
      const competitionId = req.params.id;
      const authUserId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

      if (!authUserId) {
        return res.status(401).json({ ok: false, message: "Usuario no autenticado" });
      }


      const insc = await prisma.inscripcion.findFirst({
        where: { userId: authUserId, competitionId },
        select: { id: true },
      });

      if (!insc) {
        return res.status(404).json({ ok: false, message: "No estás inscrito en esta competencia" });
      }

      await prisma.inscripcion.delete({ where: { id: insc.id } });

      return res.json({ ok: true, message: "Desinscripción realizada" });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ ok: false, message: "Error al desinscribirse" });
    }
  }
);

export default router;