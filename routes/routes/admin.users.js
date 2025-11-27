"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
//src/routes/admin.users.ts
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const client_1 = require("@prisma/client"); // 👈 importa el enum
const router = (0, express_1.Router)();
const AdminCreateSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    ciudad: zod_1.z.nativeEnum(client_1.Ciudad), // 👈 usa enum, no string
    ci: zod_1.z.string().max(20).optional().nullable(),
    roleId: zod_1.z.string().uuid(),
});
router.post("/", auth_1.authRequired, async (req, res) => {
    if (req.user.roleSlug !== "ADMIN")
        return res.status(403).json({ ok: false, message: "Solo ADMIN" });
    const parsed = AdminCreateSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ ok: false, message: "Datos inválidos", errors: parsed.error.issues });
    const { name, email, password, ciudad, ci, roleId } = parsed.data;
    const exists = await prisma_1.prisma.user.findUnique({ where: { email } });
    if (exists)
        return res.status(409).json({ ok: false, message: "El correo ya está registrado" });
    const role = await prisma_1.prisma.role.findUnique({ where: { id: roleId } });
    if (!role)
        return res.status(400).json({ ok: false, message: "Rol no válido" });
    const passwordHash = await bcryptjs_1.default.hash(password, 10);
    const user = await prisma_1.prisma.user.create({
        data: {
            name,
            email,
            passwordHash,
            role: { connect: { id: roleId } },
            activo: true,
            documentoIdentidad: ci ?? null,
            ciudad, // 👈 ahora es del tipo enum Ciudad
        },
        select: {
            id: true,
            name: true,
            email: true,
            role: { select: { slug: true } },
            createdAt: true,
        },
    });
    return res.status(201).json({ ok: true, user: { ...user, role: user.role?.slug ?? "UNKNOWN" } });
});
exports.default = router;
