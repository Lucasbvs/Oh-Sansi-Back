const express = require("express");
const { prisma } = require("../lib/prisma");
const { authRequired } = require("../middleware/auth");
const { requirePerm } = require("../middleware/perm");
const bcrypt = require("bcryptjs");
const { z } = require("zod");

const router = express.Router();

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
const CreateUserSchema = z.object({
    name: z.string().min(3, "Nombre muy corto"),
    email: z.string().email("Correo inválido"),
    password: z.string().min(6, "Mínimo 6 caracteres"),
    // en tu esquema Prisma ciudad es enum; desde el front suele enviarse el valor del enum
    ciudad: z.string().optional(), // e.g. "COCHABAMBA"
    ci: z.string().max(20).nullable().optional(), // documentoIdentidad
    roleId: z.string().uuid("roleId inválido"),
});

router.post("/", authRequired, requirePerm("users.create"), async (req, res) => {
    const parsed = CreateUserSchema.safeParse(req.body);
    if (!parsed.success) {
        return res
            .status(400)
            .json({ ok: false, message: "Datos inválidos", errors: parsed.error.issues });
    }
    const data = parsed.data;

    // Validaciones de existencia
    const [dupEmail, role] = await Promise.all([
        prisma.user.findUnique({ where: { email: data.email } }),
        prisma.role.findUnique({ where: { id: data.roleId } }),
    ]);
    if (dupEmail) {
        return res.status(409).json({ ok: false, message: "Correo ya registrado" });
    }
    if (!role) {
        return res.status(400).json({ ok: false, message: "Rol no válido" });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const created = await prisma.user.create({
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
router.get("/", authRequired, requirePerm("users.read"), async (_req, res) => {
    const items = await prisma.user.findMany({
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
router.get("/:id", authRequired, requirePerm("users.read"), async (req, res) => {
    const u = await prisma.user.findUnique({
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
const UpdateSchema = z.object({
    name: z.string().min(2).optional(),
    email: z.string().email().optional(),
    ciudad: z.string().max(50).nullable().optional(),
    ci: z.string().max(20).nullable().optional(),
    roleId: z.string().uuid().optional(),
    password: z.string().min(6).optional(),
});

router.put("/:id", authRequired, requirePerm("users.update"), async (req, res) => {
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
        const role = await prisma.role.findUnique({ where: { id: data.roleId } });
        if (!role)
            return res.status(400).json({ ok: false, message: "Rol no válido" });
        updateData.role = { connect: { id: data.roleId } };
    }
    if (data.password) {
        updateData.passwordHash = await bcrypt.hash(data.password, 10);
    }
    try {
        const u = await prisma.user.update({
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
router.delete("/:id", authRequired, requirePerm("users.delete"), async (req, res) => {
    if (req.user?.id === req.params.id) {
        return res.status(400).json({ ok: false, message: "No puedes eliminar tu propia cuenta" });
    }
    const u = await prisma.user.findUnique({
        where: { id: req.params.id },
        select: { id: true, role: { select: { slug: true, isSystem: true } } },
    });
    if (!u)
        return res.status(404).json({ ok: false, message: "No encontrado" });
    if (u.role?.isSystem || u.role?.slug === "ADMIN") {
        return res.status(400).json({ ok: false, message: "No se puede eliminar un usuario con rol de sistema" });
    }
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
});

module.exports = router;