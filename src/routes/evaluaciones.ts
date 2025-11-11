// src/routes/evaluaciones.ts
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authRequired } from "../middleware/auth";
import { requirePerm } from "../middleware/perm";
import { z } from "zod";

const router = Router();

// Asignar evaluador a competencia
router.post(
  "/asignar/:competitionId",
  authRequired,
  requirePerm("evaluaciones.create"),
  async (req: any, res) => {
    try {
      const { competitionId } = req.params;
      const evaluadorId = req.user.id;

      // Verificar que la competencia existe
      const competition = await prisma.competition.findUnique({
        where: { id: competitionId },
      });

      if (!competition) {
        return res.status(404).json({ ok: false, message: "Competencia no encontrada" });
      }

      // Verificar si ya está asignado
      const yaAsignado = await prisma.evaluadorCompetencia.findUnique({
        where: {
          evaluadorId_competitionId: {
            evaluadorId,
            competitionId,
          },
        },
      });

      if (yaAsignado) {
        return res.status(409).json({ ok: false, message: "Ya estás asignado a esta competencia" });
      }

      // Crear asignación
      const asignacion = await prisma.evaluadorCompetencia.create({
        data: {
          evaluadorId,
          competitionId,
        },
        include: {
          competition: {
            select: {
              id: true,
              nombre: true,
              nivel: true,
              area: true,
            },
          },
        },
      });

      res.json({ ok: true, message: "Asignado correctamente", asignacion });
    } catch (error) {
      console.error(error);
      res.status(500).json({ ok: false, message: "Error al asignar evaluador" });
    }
  }
);

// Desasignar evaluador de competencia
router.delete(
  "/desasignar/:competitionId",
  authRequired,
  requirePerm("evaluaciones.delete"),
  async (req: any, res) => {
    try {
      const { competitionId } = req.params;
      const evaluadorId = req.user.id;

      const asignacion = await prisma.evaluadorCompetencia.findUnique({
        where: {
          evaluadorId_competitionId: {
            evaluadorId,
            competitionId,
          },
        },
      });

      if (!asignacion) {
        return res.status(404).json({ ok: false, message: "No estás asignado a esta competencia" });
      }

      await prisma.evaluadorCompetencia.delete({
        where: {
          id: asignacion.id,
        },
      });

      res.json({ ok: true, message: "Desasignado correctamente" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ ok: false, message: "Error al desasignar evaluador" });
    }
  }
);

// Obtener competencias asignadas al evaluador
router.get(
  "/mis-competencias",
  authRequired,
  requirePerm("evaluaciones.read"),
  async (req: any, res) => {
    try {
      const evaluadorId = req.user.id;

      const asignaciones = await prisma.evaluadorCompetencia.findMany({
        where: { evaluadorId },
        include: {
          competition: {
            include: {
              etapas: {
                select: {
                  etapa: true,
                  fechaInicio: true,
                  fechaFin: true,
                },
                orderBy: { fechaInicio: "asc" },
              },
              _count: {
                select: {
                  inscripciones: true,
                },
              },
            },
          },
        },
        orderBy: { fechaAsignacion: "desc" },
      });

      res.json({
        ok: true,
        competencias: asignaciones.map((a) => ({
          id: a.competition.id,
          nombre: a.competition.nombre,
          nivel: a.competition.nivel,
          area: a.competition.area,
          modalidad: a.competition.modalidad,
          estado: a.competition.estado,
          fechaAsignacion: a.fechaAsignacion,
          totalInscritos: a.competition._count.inscripciones,
          etapas: a.competition.etapas,
        })),
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ ok: false, message: "Error al obtener competencias" });
    }
  }
);

// Verificar si está asignado a una competencia
router.get(
  "/verificar/:competitionId",
  authRequired,
  requirePerm("evaluaciones.read"),
  async (req: any, res) => {
    try {
      const { competitionId } = req.params;
      const evaluadorId = req.user.id;

      const asignacion = await prisma.evaluadorCompetencia.findUnique({
        where: {
          evaluadorId_competitionId: {
            evaluadorId,
            competitionId,
          },
        },
      });

      res.json({ ok: true, asignado: !!asignacion });
    } catch (error) {
      console.error(error);
      res.status(500).json({ ok: false, message: "Error al verificar asignación" });
    }
  }
);

// Obtener estudiantes de una competencia
router.get(
  "/estudiantes/:competitionId",
  authRequired,
  requirePerm("evaluaciones.read"),
  async (req: any, res) => {
    try {
      const { competitionId } = req.params;
      const evaluadorId = req.user.id;

      // Verificar que el evaluador está asignado a esta competencia
      const asignacion = await prisma.evaluadorCompetencia.findUnique({
        where: {
          evaluadorId_competitionId: {
            evaluadorId,
            competitionId,
          },
        },
      });

      if (!asignacion) {
        return res.status(403).json({ ok: false, message: "No estás asignado a esta competencia" });
      }

      // Obtener estudiantes inscritos
      const inscripciones = await prisma.inscripcion.findMany({
        where: { competitionId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              documentoIdentidad: true,
              ciudad: true,
              tutor: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: { fechaInscripcion: "asc" },
      });

      // Obtener evaluaciones existentes
      const evaluaciones = await prisma.evaluacion.findMany({
        where: {
          evaluadorId,
          competitionId,
        },
        select: {
          estudianteId: true,
          calificacion: true,
          detalles: true,
          fechaEvaluacion: true,
        },
      });

      const evalMap = new Map(evaluaciones.map((e) => [e.estudianteId, e]));

      const estudiantes = inscripciones.map((insc) => ({
        id: insc.user.id,
        nombre: insc.user.name,
        email: insc.user.email,
        documentoIdentidad: insc.user.documentoIdentidad,
        ciudad: insc.user.ciudad,
        tutor: insc.user.tutor,
        fechaInscripcion: insc.fechaInscripcion,
        evaluacion: evalMap.get(insc.user.id) || null,
      }));

      res.json({ ok: true, estudiantes });
    } catch (error) {
      console.error(error);
      res.status(500).json({ ok: false, message: "Error al obtener estudiantes" });
    }
  }
);

// Crear o actualizar evaluación
const EvaluacionSchema = z.object({
  calificacion: z.number().min(0).max(100),
  detalles: z.string().optional(),
});

router.post(
  "/calificar/:competitionId/:estudianteId",
  authRequired,
  requirePerm("evaluaciones.create"),
  async (req: any, res) => {
    try {
      const { competitionId, estudianteId } = req.params;
      const evaluadorId = req.user.id;

      const parsed = EvaluacionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ ok: false, message: "Datos inválidos", errors: parsed.error.issues });
      }

      const { calificacion, detalles } = parsed.data;

      // Verificar asignación
      const asignacion = await prisma.evaluadorCompetencia.findUnique({
        where: {
          evaluadorId_competitionId: {
            evaluadorId,
            competitionId,
          },
        },
      });

      if (!asignacion) {
        return res.status(403).json({ ok: false, message: "No estás asignado a esta competencia" });
      }

      // Verificar que el estudiante está inscrito
      const inscripcion = await prisma.inscripcion.findFirst({
        where: {
          userId: estudianteId,
          competitionId,
        },
      });

      if (!inscripcion) {
        return res.status(404).json({ ok: false, message: "El estudiante no está inscrito en esta competencia" });
      }

      // Crear o actualizar evaluación
      const evaluacion = await prisma.evaluacion.upsert({
        where: {
          evaluadorId_estudianteId_competitionId: {
            evaluadorId,
            estudianteId,
            competitionId,
          },
        },
        update: {
          calificacion,
          detalles: detalles || null,
        },
        create: {
          evaluadorId,
          estudianteId,
          competitionId,
          calificacion,
          detalles: detalles || null,
        },
        include: {
          estudiante: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });

      res.json({ ok: true, message: "Evaluación guardada correctamente", evaluacion });
    } catch (error) {
      console.error(error);
      res.status(500).json({ ok: false, message: "Error al guardar evaluación" });
    }
  }
);

// Obtener evaluación de un estudiante
router.get(
  "/estudiante/:competitionId/:estudianteId",
  authRequired,
  requirePerm("evaluaciones.read"),
  async (req: any, res) => {
    try {
      const { competitionId, estudianteId } = req.params;
      const evaluadorId = req.user.id;

      const evaluacion = await prisma.evaluacion.findUnique({
        where: {
          evaluadorId_estudianteId_competitionId: {
            evaluadorId,
            estudianteId,
            competitionId,
          },
        },
        include: {
          estudiante: {
            select: {
              id: true,
              name: true,
              email: true,
              documentoIdentidad: true,
              ciudad: true,
            },
          },
          competition: {
            select: {
              id: true,
              nombre: true,
              nivel: true,
              area: true,
            },
          },
        },
      });

      res.json({ ok: true, evaluacion });
    } catch (error) {
      console.error(error);
      res.status(500).json({ ok: false, message: "Error al obtener evaluación" });
    }
  }
);

export default router;