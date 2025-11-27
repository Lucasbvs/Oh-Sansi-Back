"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const perm_1 = require("../middleware/perm");
const router = (0, express_1.Router)();
/* =================== ZOD SCHEMAS =================== */
const FaseSchema = zod_1.z.object({
    nombre: zod_1.z.string().min(2).max(80),
    fechaInicio: zod_1.z.string().transform((v) => new Date(v)),
    fechaFin: zod_1.z.string().transform((v) => new Date(v)),
});
const EtapaItemSchema = zod_1.z
    .object({
    etapa: zod_1.z.enum(["INSCRIPCION", "DESARROLLO", "EVALUACION", "CORRECCION", "PREMIACION"]),
    fechaInicio: zod_1.z.string().transform((v) => new Date(v)),
    fechaFin: zod_1.z.string().nullable().transform((v) => (v ? new Date(v) : null)),
})
    .superRefine((val, ctx) => {
    if (val.etapa !== "CORRECCION" && !val.fechaFin) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "fechaFin es obligatoria para esta etapa",
            path: ["fechaFin"],
        });
    }
});
const CompetitionCreateBody = zod_1.z.object({
    nombre: zod_1.z.string().min(3),
    nivel: zod_1.z.enum(["PRINCIPIANTE", "INTERMEDIO", "AVANZADO"]),
    area: zod_1.z.enum(["MATEMATICA", "FISICA", "ROBOTICA", "QUIMICA", "PROGRAMACION"]),
    participantes: zod_1.z.number().min(1).max(5),
    modalidad: zod_1.z.enum(["PRESENCIAL", "VIRTUAL"]),
    formaCalificacion: zod_1.z.string().max(400),
    fases: zod_1.z.array(FaseSchema).min(1),
    etapas: zod_1.z.array(EtapaItemSchema).min(1),
});
const CompetitionUpdateBody = zod_1.z.object({
    nombre: zod_1.z.string().min(3).optional(),
    nivel: zod_1.z.enum(["PRINCIPIANTE", "INTERMEDIO", "AVANZADO"]).optional(),
    area: zod_1.z.enum(["MATEMATICA", "FISICA", "ROBOTICA", "QUIMICA", "PROGRAMACION"]).optional(),
    participantes: zod_1.z.number().min(1).max(5).optional(),
    modalidad: zod_1.z.enum(["PRESENCIAL", "VIRTUAL"]).optional(),
    formaCalificacion: zod_1.z.string().max(400).optional(),
    fechaInicio: zod_1.z.string().transform((v) => new Date(v)).optional(),
    fases: zod_1.z.array(FaseSchema).min(1).optional(),
    etapas: zod_1.z.array(EtapaItemSchema).min(1).optional(),
});
/* =================== HELPERS =================== */
function validarSolapes(fases) {
    const s = [...fases].sort((a, b) => a.fechaInicio.getTime() - b.fechaInicio.getTime());
    for (let i = 0; i < s.length - 1; i++) {
        if (s[i].fechaFin > s[i + 1].fechaInicio) {
            return `Las fechas de la fase "${s[i + 1].nombre}" se solapan con "${s[i].nombre}"`;
        }
    }
    return null;
}
function validarFasesEnDesarrollo(fases, etapas) {
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
function isBetween(d, ini, fin) {
    const t = d.getTime(), a = ini.getTime(), b = fin ? fin.getTime() : Number.POSITIVE_INFINITY;
    return t >= a && t <= b;
}
/* =================== RUTAS =================== */
// Crear
router.post("/", auth_1.authRequired, (0, perm_1.requirePerm)("competitions.create"), async (req, res) => {
    const parsed = CompetitionCreateBody.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ ok: false, message: "Datos inválidos", errors: parsed.error.issues });
    const data = parsed.data;
    // Validación existente de solapamiento
    const err = validarSolapes(data.fases.map((f) => ({ ...f, nombre: f.nombre })));
    if (err)
        return res.status(400).json({ ok: false, message: err });
    const errFasesDesarrollo = validarFasesEnDesarrollo(data.fases.map((f) => ({ ...f, nombre: f.nombre })), data.etapas);
    if (errFasesDesarrollo)
        return res.status(400).json({ ok: false, message: errFasesDesarrollo });
    const competition = await prisma_1.prisma.competition.create({
        data: {
            nombre: data.nombre,
            nivel: data.nivel,
            area: data.area,
            participantes: data.participantes,
            modalidad: data.modalidad,
            formaCalificacion: data.formaCalificacion,
            fechaInicio: data.fases[0].fechaInicio,
            estado: true,
            fases: { create: data.fases },
            etapas: {
                create: data.etapas.map((e) => ({
                    etapa: e.etapa,
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
router.get("/", auth_1.authRequired, (0, perm_1.requirePerm)("competitions.read"), async (req, res) => {
    const includeHidden = req.user.roleSlug === "ADMIN";
    const where = includeHidden ? {} : { estado: true };
    const { q, nivel, area } = req.query ?? {};
    if (q && typeof q === "string") {
        where.OR = [
            { nombre: { contains: q, mode: "insensitive" } },
            { area: { equals: area } },
        ];
    }
    if (nivel && typeof nivel === "string")
        where.nivel = nivel;
    if (area && typeof area === "string")
        where.area = area;
    const competitions = await prisma_1.prisma.competition.findMany({
        where,
        include: { fases: true, etapas: true },
        orderBy: { createdAt: "desc" },
    });
    res.json({ ok: true, competitions });
});
// En la ruta GET /:id
router.get("/:id", auth_1.authRequired, (0, perm_1.requirePerm)("competitions.read"), async (req, res) => {
    const c = await prisma_1.prisma.competition.findUnique({
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
    if (!c)
        return res.status(404).json({ ok: false, message: "No encontrado" });
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
router.put("/:id", auth_1.authRequired, (0, perm_1.requirePerm)("competitions.update"), async (req, res) => {
    const parsed = CompetitionUpdateBody.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ ok: false, message: "Datos inválidos", errors: parsed.error.issues });
    const data = parsed.data;
    const exists = await prisma_1.prisma.competition.findUnique({ where: { id: req.params.id } });
    if (!exists)
        return res.status(404).json({ ok: false, message: "No encontrado" });
    if (data.fases && data.etapas) {
        const err = validarSolapes(data.fases.map((f) => ({ ...f, nombre: f.nombre })));
        if (err)
            return res.status(400).json({ ok: false, message: err });
        const errFasesDesarrollo = validarFasesEnDesarrollo(data.fases.map((f) => ({ ...f, nombre: f.nombre })), data.etapas);
        if (errFasesDesarrollo)
            return res.status(400).json({ ok: false, message: errFasesDesarrollo });
    }
    const updated = await prisma_1.prisma.competition.update({
        where: { id: req.params.id },
        data: {
            nombre: data.nombre,
            nivel: data.nivel,
            area: data.area,
            participantes: data.participantes,
            modalidad: data.modalidad,
            formaCalificacion: data.formaCalificacion,
            fechaInicio: data.fechaInicio,
        },
        include: { fases: true, etapas: true },
    });
    if (data.fases) {
        const err = validarSolapes(data.fases.map((f) => ({ ...f, nombre: f.nombre })));
        if (err)
            return res.status(400).json({ ok: false, message: err });
        if (data.etapas) {
            const errFasesDesarrollo = validarFasesEnDesarrollo(data.fases.map((f) => ({ ...f, nombre: f.nombre })), data.etapas);
            if (errFasesDesarrollo)
                return res.status(400).json({ ok: false, message: errFasesDesarrollo });
        }
        await prisma_1.prisma.fase.deleteMany({ where: { competitionId: updated.id } });
        await prisma_1.prisma.fase.createMany({
            data: data.fases.map((f) => ({
                nombre: f.nombre, fechaInicio: f.fechaInicio, fechaFin: f.fechaFin, competitionId: updated.id,
            })),
        });
    }
    if (data.etapas) {
        await prisma_1.prisma.etapaCompetencia.deleteMany({ where: { competitionId: updated.id } });
        await prisma_1.prisma.etapaCompetencia.createMany({
            data: data.etapas.map((e) => ({
                etapa: e.etapa, fechaInicio: e.fechaInicio, fechaFin: e.fechaFin ?? null, competitionId: updated.id,
            })),
        });
    }
    const final = await prisma_1.prisma.competition.findUnique({
        where: { id: req.params.id },
        include: { fases: true, etapas: true },
    });
    res.json({ ok: true, competition: final });
});
// Cambiar estado 
router.put("/:id/estado", auth_1.authRequired, async (req, res) => {
    if (req.user.roleSlug !== "ADMIN")
        return res.status(403).json({ ok: false, message: "Solo ADMIN" });
    const comp = await prisma_1.prisma.competition.findUnique({ where: { id: req.params.id } });
    if (!comp)
        return res.status(404).json({ ok: false, message: "No encontrado" });
    const updated = await prisma_1.prisma.competition.update({
        where: { id: req.params.id },
        data: { estado: !comp.estado },
    });
    res.json({ ok: true, competition: updated });
});
// Eliminar 
router.delete("/:id", auth_1.authRequired, (0, perm_1.requirePerm)("competitions.delete"), async (req, res) => {
    const comp = await prisma_1.prisma.competition.findUnique({ where: { id: req.params.id } });
    if (!comp)
        return res.status(404).json({ ok: false, message: "No encontrado" });
    if (req.user.roleSlug === "ADMIN") {
        await prisma_1.prisma.competition.delete({ where: { id: req.params.id } });
        return res.json({ ok: true, deleted: true });
    }
    else {
        await prisma_1.prisma.competition.update({ where: { id: req.params.id }, data: { estado: false } });
        return res.json({ ok: true, deleted: false });
    }
});
router.post("/:id/inscribirse", auth_1.authRequired, (0, perm_1.requirePerm)("inscriptions.create"), async (req, res) => {
    const comp = await prisma_1.prisma.competition.findUnique({
        where: { id: req.params.id },
        include: { etapas: true, inscripciones: { where: { userId: req.user.id }, select: { id: true } } },
    });
    if (!comp || !comp.estado)
        return res.status(404).json({ ok: false, message: "Competencia no disponible" });
    if ((comp.inscripciones?.length ?? 0) > 0) {
        return res.status(409).json({ ok: false, message: "Ya estás inscrito en esta competencia" });
    }
    const estudiante = await prisma_1.prisma.user.findUnique({
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
        if (!dentro)
            return res.status(400).json({ ok: false, message: "La etapa de inscripción no está vigente" });
    }
    await prisma_1.prisma.inscripcion.create({
        data: {
            userId: req.user.id,
            competitionId: comp.id
        }
    });
    res.json({ ok: true, message: "Inscripción realizada" });
});
router.delete("/:id/desinscribirse", auth_1.authRequired, (0, perm_1.requirePerm)("inscriptions.delete"), async (req, res) => {
    try {
        const competitionId = req.params.id;
        const authUserId = req.user?.id ?? req.user?.userId ?? req.user?.sub;
        if (!authUserId) {
            return res.status(401).json({ ok: false, message: "Usuario no autenticado" });
        }
        const insc = await prisma_1.prisma.inscripcion.findFirst({
            where: { userId: authUserId, competitionId },
            select: { id: true },
        });
        if (!insc) {
            return res.status(404).json({ ok: false, message: "No estás inscrito en esta competencia" });
        }
        await prisma_1.prisma.inscripcion.delete({ where: { id: insc.id } });
        return res.json({ ok: true, message: "Desinscripción realizada" });
    }
    catch (e) {
        console.error(e);
        return res.status(500).json({ ok: false, message: "Error al desinscribirse" });
    }
});
exports.default = router;
