"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const perm_1 = require("../middleware/perm");
const router = (0, express_1.Router)();
/** Devuelve las competencias en las que está inscrito el usuario actual */
router.get("/mis", auth_1.authRequired, (0, perm_1.requirePerm)("inscriptions.read"), async (req, res) => {
    const authUserId = req.user?.id ?? req.user?.userId ?? req.user?.sub ?? null;
    if (!authUserId) {
        return res.status(401).json({ ok: false, message: "Usuario no autenticado" });
    }
    const items = await prisma_1.prisma.inscripcion.findMany({
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
    const calcularEtapaActual = (etapas) => {
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
        // ELIMINADO: createdAt: i.createdAt, // Esta propiedad no existe en Inscripcion
    }));
    return res.json({
        ok: true,
        items: data,
        competitions: data.map(d => d.competition)
    });
});
/** Cancelar inscripción propia */
router.delete("/:competitionId", auth_1.authRequired, (0, perm_1.requirePerm)("inscriptions.delete"), async (req, res) => {
    await prisma_1.prisma.inscripcion.deleteMany({
        where: { userId: req.user.id, competitionId: req.params.competitionId }
    });
    res.json({ ok: true });
});
exports.default = router;
