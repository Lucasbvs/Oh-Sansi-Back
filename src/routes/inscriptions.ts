import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authRequired } from "../middleware/auth";
import { requirePerm } from "../middleware/perm";

const router = Router();

/** Devuelve las competencias en las que está inscrito el usuario actual */
router.get("/mis", authRequired, requirePerm("inscriptions.read"), async (req: any, res) => {
  
    const authUserId =
      req.user?.id ?? req.user?.userId ?? req.user?.sub ?? null;

    if (!authUserId) {
      return res.status(401).json({ ok: false, message: "Usuario no autenticado" });
    }

    const items = await prisma.inscripcion.findMany({
      where: { userId: authUserId },
      orderBy: { fechaInscripcion: "desc" },
      include: {
        competition: {
          select: {
            id: true,
            nombre: true,
            nivel: true,
            area: true,
            modalidad: true,
            estado: true,
            participantes: true,
            createdAt: true,
            etapas: {
              select: {
                etapa: true,
                fechaInicio: true,
                fechaFin: true,
              },
              orderBy: { fechaInicio: 'asc' }
            },
          },
        },
      },
    });

    // Función para calcular la etapa actual
    const calcularEtapaActual = (etapas: any[]) => {
      const ahora = new Date();
      for (const etapa of etapas) {
        const inicio = new Date(etapa.fechaInicio);
        const fin = etapa.fechaFin ? new Date(etapa.fechaFin) : null;
        
        if (inicio <= ahora && (!fin || fin >= ahora)) {
          return etapa.etapa;
        }
      }
      return "FINALIZADA";
    };

    // Shape compatible con el front
    const data = items.map((i) => ({
      id: i.id,
      competition: {
        ...i.competition,
        etapaActual: calcularEtapaActual(i.competition.etapas || [])
      },
      fechaInscripcion: i.fechaInscripcion,
      createdAt: i.createdAt,
    }));

    // Extra: compatibilidad por si en algún lado consumías como arreglo de competitions
    return res.json({ 
      ok: true, 
      items: data, 
      competitions: data.map(d => d.competition) 
    });
  }
);

/** Cancelar inscripción propia */
router.delete("/:competitionId", authRequired, requirePerm("inscriptions.delete"), async (req: any, res) => {
  await prisma.inscripcion.deleteMany({
    where: { userId: req.user.id, competitionId: req.params.competitionId }
  });
  res.json({ ok: true });
});

export default router;