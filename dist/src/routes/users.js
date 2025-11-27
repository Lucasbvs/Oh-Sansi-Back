"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const perm_1 = require("../middleware/perm");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const zod_1 = require("zod");
const router = (0, express_1.Router)();
/** Normaliza un user para el front */
function mapUser(u) {
    return {
        id: u.id,
        name: u.name,
        email: u.email,
        ciudad: u.ciudad ?? null,
        ci: u.documentoIdentidad ?? null,
        createdAt: u.createdAt,
        role: u.role?.slug ?? "UNKNOWN",
        roleId: u.roleId,
        roleIsSystem: !!u.role?.isSystem,
    };
}
/* ===================== CREATE ===================== */
const CreateUserSchema = zod_1.z.object({
    name: zod_1.z.string().min(3, "Nombre muy corto"),
    email: zod_1.z.string().email("Correo inválido"),
    password: zod_1.z.string().min(6, "Mínimo 6 caracteres"),
    // en tu esquema Prisma ciudad es enum; desde el front suele enviarse el valor del enum
    ciudad: zod_1.z.string().optional(), // e.g. "COCHABAMBA"
    ci: zod_1.z.string().max(20).nullable().optional(), // documentoIdentidad
    roleId: zod_1.z.string().uuid("roleId inválido"),
});
router.post("/", auth_1.authRequired, (0, perm_1.requirePerm)("users.create"), async (req, res) => {
    const parsed = CreateUserSchema.safeParse(req.body);
    if (!parsed.success) {
        return res
            .status(400)
            .json({ ok: false, message: "Datos inválidos", errors: parsed.error.issues });
    }
    const data = parsed.data;
    // Validaciones de existencia
    const [dupEmail, role] = await Promise.all([
        prisma_1.prisma.user.findUnique({ where: { email: data.email } }),
        prisma_1.prisma.role.findUnique({ where: { id: data.roleId } }),
    ]);
    if (dupEmail) {
        return res.status(409).json({ ok: false, message: "Correo ya registrado" });
    }
    if (!role) {
        return res.status(400).json({ ok: false, message: "Rol no válido" });
    }
    const passwordHash = await bcryptjs_1.default.hash(data.password, 10);
    const created = await prisma_1.prisma.user.create({
        data: {
            name: data.name,
            email: data.email,
            passwordHash,
            ciudad: data.ciudad ?? undefined,
            documentoIdentidad: data.ci ?? null,
            role: { connect: { id: data.roleId } },
        },
        select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
            documentoIdentidad: true,
            ciudad: true,
            roleId: true,
            role: { select: { slug: true, isSystem: true } },
        },
    });
    return res.status(201).json({ ok: true, user: mapUser(created) });
});
/* ===================== READ (LIST) ===================== */
router.get("/", auth_1.authRequired, (0, perm_1.requirePerm)("users.read"), async (_req, res) => {
    const items = await prisma_1.prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        select: {
            id: true, name: true, email: true, createdAt: true,
            documentoIdentidad: true, ciudad: true,
            roleId: true,
            role: { select: { slug: true, isSystem: true } },
        },
        take: 500,
    });
    res.json(items.map(mapUser));
});
/* ===================== READ (ONE) ===================== */
router.get("/:id", auth_1.authRequired, (0, perm_1.requirePerm)("users.read"), async (req, res) => {
    const u = await prisma_1.prisma.user.findUnique({
        where: { id: req.params.id },
        select: {
            id: true, name: true, email: true, createdAt: true,
            documentoIdentidad: true, ciudad: true,
            roleId: true,
            role: { select: { slug: true, isSystem: true } },
        },
    });
    if (!u)
        return res.status(404).json({ ok: false, message: "No encontrado" });
    res.json({ ok: true, user: mapUser(u) });
});
/* ===================== UPDATE ===================== */
const UpdateSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
    email: zod_1.z.string().email().optional(),
    ciudad: zod_1.z.string().max(50).nullable().optional(),
    ci: zod_1.z.string().max(20).nullable().optional(),
    roleId: zod_1.z.string().uuid().optional(),
    password: zod_1.z.string().min(6).optional(),
});
router.put("/:id", auth_1.authRequired, (0, perm_1.requirePerm)("users.update"), async (req, res) => {
    const parsed = UpdateSchema.safeParse(req.body);
    if (!parsed.success) {
        return res
            .status(400)
            .json({ ok: false, message: "Datos inválidos", errors: parsed.error.issues });
    }
    const data = parsed.data;
    const updateData = {
        name: data.name,
        email: data.email,
        documentoIdentidad: data.ci ?? null,
        ciudad: data.ciudad ?? null,
    };
    if (data.roleId) {
        const role = await prisma_1.prisma.role.findUnique({ where: { id: data.roleId } });
        if (!role)
            return res.status(400).json({ ok: false, message: "Rol no válido" });
        updateData.role = { connect: { id: data.roleId } };
    }
    if (data.password) {
        updateData.passwordHash = await bcryptjs_1.default.hash(data.password, 10);
    }
    try {
        const u = await prisma_1.prisma.user.update({
            where: { id: req.params.id },
            data: updateData,
            select: {
                id: true, name: true, email: true, createdAt: true,
                documentoIdentidad: true, ciudad: true,
                roleId: true,
                role: { select: { slug: true, isSystem: true } },
            },
        });
        res.json({ ok: true, user: mapUser(u) });
    }
    catch {
        return res.status(404).json({ ok: false, message: "No encontrado" });
    }
});
/* ===================== DELETE ===================== */
router.delete("/:id", auth_1.authRequired, (0, perm_1.requirePerm)("users.delete"), async (req, res) => {
    if (req.user?.id === req.params.id) {
        return res.status(400).json({ ok: false, message: "No puedes eliminar tu propia cuenta" });
    }
    const u = await prisma_1.prisma.user.findUnique({
        where: { id: req.params.id },
        select: { id: true, role: { select: { slug: true, isSystem: true } } },
    });
    if (!u)
        return res.status(404).json({ ok: false, message: "No encontrado" });
    if (u.role?.isSystem || u.role?.slug === "ADMIN") {
        return res.status(400).json({ ok: false, message: "No se puede eliminar un usuario con rol de sistema" });
    }
    await prisma_1.prisma.user.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
});
exports.default = router;
