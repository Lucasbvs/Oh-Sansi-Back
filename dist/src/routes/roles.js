"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/roles.ts
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const perm_1 = require("../middleware/perm");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
const PermsSchema = zod_1.z.object({
    navbar: zod_1.z.object({
        home: zod_1.z.boolean().optional(),
        competencias: zod_1.z.boolean().optional(),
        usuarios: zod_1.z.boolean().optional(),
        roles: zod_1.z.boolean().optional(),
        tutorias: zod_1.z.boolean().optional(), // ✅ NUEVO
    }).optional(),
    competitions: zod_1.z.object({
        read: zod_1.z.boolean().optional(),
        create: zod_1.z.boolean().optional(),
        update: zod_1.z.boolean().optional(),
        delete: zod_1.z.boolean().optional(),
    }).optional(),
    users: zod_1.z.object({
        read: zod_1.z.boolean().optional(),
        create: zod_1.z.boolean().optional(),
        update: zod_1.z.boolean().optional(),
        delete: zod_1.z.boolean().optional(),
    }).optional(),
    inscriptions: zod_1.z.object({
        read: zod_1.z.boolean().optional(), // ver "Mis competencias"
        create: zod_1.z.boolean().optional(), // inscribirse
        delete: zod_1.z.boolean().optional(), // cancelar inscripción
    }).optional(),
    // ✅ NUEVO: Permisos de tutorías
    tutorias: zod_1.z.object({
        read: zod_1.z.boolean().optional(), // Ver listado de tutorías
        manage: zod_1.z.boolean().optional(), // Gestionar asignaciones (solo admin)
    }).optional(),
}).optional();
const RoleBody = zod_1.z.object({
    name: zod_1.z.string().min(2).max(40),
    slug: zod_1.z.string().regex(/^[A-Z0-9_]+$/).min(3).max(40),
    permissions: PermsSchema,
});
const isAdminSlug = (s) => s === "ADMIN";
/* =========================
   Helpers
   ========================= */
function mapCreateUpdateError(err) {
    if (err instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        // P2002 => unique constraint violation
        if (err.code === "P2002") {
            const target = err.meta?.target ?? [];
            if (Array.isArray(target)) {
                if (target.includes("slug"))
                    return { status: 409, message: "Ya existe un rol con ese slug" };
                if (target.includes("name"))
                    return { status: 409, message: "Ya existe un rol con ese nombre" };
            }
            return { status: 409, message: "Registro duplicado" };
        }
    }
    return { status: 500, message: "Error interno del servidor" };
}
/* =========================
   Rutas
   ========================= */
// === Listar (cualquiera con users.read) ===
router.get("/", auth_1.authRequired, (0, perm_1.requirePerm)("users.read"), async (_req, res) => {
    const roles = await prisma_1.prisma.role.findMany({
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            name: true,
            slug: true,
            isSystem: true,
            permissions: true,
            createdAt: true,
            _count: { select: { users: true } },
        },
    });
    res.json({ ok: true, roles });
});
// === Obtener uno por id (cualquiera con users.read) ===
router.get("/:id", auth_1.authRequired, (0, perm_1.requirePerm)("users.read"), async (req, res) => {
    const r = await prisma_1.prisma.role.findUnique({
        where: { id: req.params.id },
        select: {
            id: true,
            name: true,
            slug: true,
            isSystem: true,
            permissions: true,
            createdAt: true,
            _count: { select: { users: true } },
        },
    });
    if (!r)
        return res.status(404).json({ ok: false, message: "No encontrado" });
    res.json({ ok: true, role: r });
});
// === Crear (solo ADMIN) ===
router.post("/", auth_1.authRequired, async (req, res) => {
    if (req.user.roleSlug !== "ADMIN")
        return res.status(403).json({ ok: false, message: "Solo ADMIN" });
    const parsed = RoleBody.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ ok: false, message: "Datos inválidos", errors: parsed.error.issues });
    }
    const { name, slug, permissions } = parsed.data;
    if (isAdminSlug(slug))
        return res.status(400).json({ ok: false, message: "Slug reservado" });
    try {
        const role = await prisma_1.prisma.role.create({
            data: { name, slug, isSystem: false, permissions: permissions ?? {} },
            select: { id: true, name: true, slug: true, isSystem: true, permissions: true, createdAt: true },
        });
        res.status(201).json({ ok: true, role });
    }
    catch (err) {
        const { status, message } = mapCreateUpdateError(err);
        res.status(status).json({ ok: false, message });
    }
});
// === Editar (solo ADMIN, no roles de sistema) ===
router.put("/:id", auth_1.authRequired, async (req, res) => {
    if (req.user.roleSlug !== "ADMIN")
        return res.status(403).json({ ok: false, message: "Solo ADMIN" });
    const parsed = RoleBody.partial().safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ ok: false, message: "Datos inválidos", errors: parsed.error.issues });
    const current = await prisma_1.prisma.role.findUnique({
        where: { id: req.params.id },
        select: { slug: true, isSystem: true },
    });
    if (!current)
        return res.status(404).json({ ok: false, message: "No encontrado" });
    if (current.isSystem || isAdminSlug(current.slug)) {
        return res.status(400).json({ ok: false, message: "No se puede editar rol de sistema" });
    }
    // impedir que intenten convertir otro rol en ADMIN
    if (parsed.data.slug && isAdminSlug(parsed.data.slug)) {
        return res.status(400).json({ ok: false, message: "Slug reservado" });
    }
    try {
        const role = await prisma_1.prisma.role.update({
            where: { id: req.params.id },
            data: { ...parsed.data },
            select: { id: true, name: true, slug: true, isSystem: true, permissions: true, createdAt: true },
        });
        res.json({ ok: true, role });
    }
    catch (err) {
        const { status, message } = mapCreateUpdateError(err);
        res.status(status).json({ ok: false, message });
    }
});
// === Eliminar (solo ADMIN, no roles de sistema) ===
router.delete("/:id", auth_1.authRequired, async (req, res) => {
    if (req.user.roleSlug !== "ADMIN")
        return res.status(403).json({ ok: false, message: "Solo ADMIN" });
    try {
        const current = await prisma_1.prisma.role.findUnique({
            where: { id: req.params.id },
            select: { id: true, slug: true, isSystem: true, _count: { select: { users: true } } },
        });
        if (!current)
            return res.status(404).json({ ok: false, message: "No encontrado" });
        if (current.isSystem || isAdminSlug(current.slug)) {
            return res.status(400).json({ ok: false, message: "No se puede eliminar rol de sistema" });
        }
        if (current._count.users > 0) {
            return res.status(409).json({
                ok: false,
                message: "No se puede eliminar: el rol tiene usuarios asignados.",
                detail: `Usuarios asociados: ${current._count.users}`,
            });
        }
        await prisma_1.prisma.role.delete({ where: { id: current.id } });
        res.json({ ok: true, message: "Rol eliminado" });
    }
    catch (err) {
        if (err instanceof client_1.Prisma.PrismaClientKnownRequestError) {
            // P2003 => restricción FK; P2025 => registro no encontrado
            if (err.code === "P2003") {
                return res.status(409).json({ ok: false, message: "No se puede eliminar por registros relacionados." });
            }
            if (err.code === "P2025") {
                return res.status(404).json({ ok: false, message: "Rol no encontrado" });
            }
        }
        console.error("DELETE /api/roles error:", err);
        res.status(500).json({ ok: false, message: "Error interno del servidor" });
    }
});
exports.default = router;
