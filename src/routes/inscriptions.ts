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
      orderBy: { fechaInscripcion: "desc" },        // o createdAt
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
          },
        },
      },
    });

    // Shape compatible con el front
    const data = items.map((i) => ({
      id: i.id,                                 // id de la inscripción
      competition: i.competition,
    }));

    // Extra: compatibilidad por si en algún lado consumías como arreglo de competitions
    return res.json({ ok: true, items: data, competitions: data.map(d => d.competition) });
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
