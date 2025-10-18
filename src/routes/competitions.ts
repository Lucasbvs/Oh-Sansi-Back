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

/** Etapas del cronograma.
 *  - CORRECCION: fechaFin opcional
 *  - resto de etapas: fechaFin obligatoria
 */
const EtapaItemSchema = z
  .object({
    etapa: z.enum([
      "INSCRIPCION",
      "DESARROLLO",
      "EVALUACION",
      "CORRECCION",
      "PREMIACION",
    ]),
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
  etapas: z.array(EtapaItemSchema).min(1), // 👈 REUTILIZAMOS
});

const CompetitionUpdateBody = z.object({
  nombre: z.string().min(3).optional(),
  nivel: z.enum(["PRINCIPIANTE", "INTERMEDIO", "AVANZADO"]).optional(),
  area:
    z.enum(["MATEMATICA", "FISICA", "ROBOTICA", "QUIMICA", "PROGRAMACION"]).optional(),
  participantes: z.number().min(1).max(5).optional(),
  modalidad: z.enum(["PRESENCIAL", "VIRTUAL"]).optional(),
  formaCalificacion: z.string().max(400).optional(),
  fechaInicio: z.string().transform((v) => new Date(v)).optional(),
  fases: z.array(FaseSchema).min(1).optional(),
  etapas: z.array(EtapaItemSchema).min(1).optional(), // 👈 REUTILIZAMOS
});

/* =================== HELPERS =================== */

function validarSolapes(
  fases: { fechaInicio: Date; fechaFin: Date; nombre: string }[]
) {
  const s = [...fases].sort(
    (a, b) => a.fechaInicio.getTime() - b.fechaInicio.getTime()
  );
  for (let i = 0; i < s.length - 1; i++) {
    if (s[i].fechaFin > s[i + 1].fechaInicio) {
      return `Las fechas de la fase "${s[i + 1].nombre}" se solapan con "${s[i].nombre}"`;
    }
  }
  return null;
}

/* =================== RUTAS =================== */

// Crear
router.post("/", authRequired, requirePerm("competitions.create"), async (req, res) => {
  const parsed = CompetitionCreateBody.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ ok: false, message: "Datos inválidos", errors: parsed.error.issues });

  const data = parsed.data;

  const err = validarSolapes(
    data.fases.map((f) => ({ ...f, nombre: f.nombre }))
  );
  if (err) return res.status(400).json({ ok: false, message: err });

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

// Listar
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

// Obtener por id
router.get("/:id", authRequired, requirePerm("competitions.read"), async (req, res) => {
  const c = await prisma.competition.findUnique({
    where: { id: req.params.id },
    include: { fases: true, etapas: true },
  });
  if (!c) return res.status(404).json({ ok: false, message: "No encontrado" });
  res.json({ ok: true, competition: c });
});

// Actualizar
router.put("/:id", authRequired, requirePerm("competitions.update"), async (req, res) => {
  const parsed = CompetitionUpdateBody.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ ok: false, message: "Datos inválidos", errors: parsed.error.issues });
  const data = parsed.data;

  const exists = await prisma.competition.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ ok: false, message: "No encontrado" });

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
    const err = validarSolapes(
      data.fases.map((f) => ({ ...f, nombre: f.nombre }))
    );
    if (err) return res.status(400).json({ ok: false, message: err });

    await prisma.fase.deleteMany({ where: { competitionId: updated.id } });
    await prisma.fase.createMany({
      data: data.fases.map((f) => ({
        nombre: f.nombre,
        fechaInicio: f.fechaInicio,
        fechaFin: f.fechaFin,
        competitionId: updated.id,
      })),
    });
  }

  if (data.etapas) {
    await prisma.etapaCompetencia.deleteMany({ where: { competitionId: updated.id } });
    await prisma.etapaCompetencia.createMany({
      data: data.etapas.map((e) => ({
        etapa: e.etapa as any,
        fechaInicio: e.fechaInicio,
        fechaFin: e.fechaFin ?? null,
        competitionId: updated.id,
      })),
    });
  }

  const final = await prisma.competition.findUnique({
    where: { id: req.params.id },
    include: { fases: true, etapas: true },
  });

  res.json({ ok: true, competition: final });
});

// Cambiar estado (soft delete / toggle) – sólo ADMIN
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

export default router;
