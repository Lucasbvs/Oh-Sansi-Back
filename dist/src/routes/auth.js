"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
/* Schemas */
const LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
});
const RegisterSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, "Nombre muy corto"),
    email: zod_1.z.string().email("Email inválido"),
    password: zod_1.z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
    ciudad: zod_1.z.nativeEnum(client_1.Ciudad).optional(),
    ci: zod_1.z.string().max(20).optional().nullable(),
    roleSlug: zod_1.z.enum(["ESTUDIANTE", "TUTOR"]).optional(),
});
/* Helpers */
function signToken(user) {
    return jsonwebtoken_1.default.sign({ sub: user.id, id: user.id, email: user.email, name: user.name, roleSlug: user.roleSlug }, process.env.JWT_SECRET, { expiresIn: "1d" });
}
function mapPrismaError(err) {
    if (err instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        if (err.code === "P2002" && err.meta?.target?.includes?.("email")) {
            return { status: 409, body: { ok: false, message: "Ya existe un usuario con este email" } };
        }
    }
    if (err instanceof client_1.Prisma.PrismaClientValidationError) {
        return { status: 400, body: { ok: false, message: "Error de validación en BD", detail: err.message } };
    }
    return { status: 500, body: { ok: false, message: "Error interno del servidor" } };
}
/* Rutas */
// POST /api/auth/login
router.post("/login", async (req, res) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ ok: false, message: "Datos inválidos" });
    const { email, password } = parsed.data;
    const user = await prisma_1.prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, name: true, passwordHash: true, role: { select: { slug: true } } },
    });
    if (!user)
        return res.status(401).json({ ok: false, message: "Credenciales inválidas" });
    const ok = await bcryptjs_1.default.compare(password, user.passwordHash);
    if (!ok)
        return res.status(401).json({ ok: false, message: "Credenciales inválidas" });
    const roleSlug = user.role?.slug ?? "UNKNOWN";
    const token = signToken({ id: user.id, email: user.email, name: user.name, roleSlug });
    res.json({
        ok: true,
        token,
        user: { id: user.id, name: user.name, email: user.email, role: roleSlug },
    });
});
// POST /api/auth/register
router.post("/register", async (req, res) => {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ ok: false, message: "Datos inválidos", errors: parsed.error.issues });
    }
    const { name, email, password, ciudad, ci, roleSlug } = parsed.data;
    try {
        const existingUser = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (existingUser)
            return res.status(409).json({ ok: false, message: "Ya existe un usuario con este email" });
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        const slug = roleSlug === "TUTOR" ? "TUTOR" : "ESTUDIANTE";
        const role = await prisma_1.prisma.role.findUnique({ where: { slug } });
        if (!role)
            return res.status(500).json({ ok: false, message: "Rol por defecto no encontrado" });
        const safeCiudad = ciudad ?? client_1.Ciudad.COCHABAMBA;
        const created = await prisma_1.prisma.user.create({
            data: {
                name,
                email,
                passwordHash,
                role: { connect: { id: role.id } },
                activo: true,
                documentoIdentidad: ci ?? null,
                ciudad: safeCiudad,
            },
        });
        const roleSlugSaved = slug;
        const token = signToken({ id: created.id, email: created.email, name: created.name, roleSlug: roleSlugSaved });
        res.status(201).json({
            ok: true,
            message: "Usuario creado exitosamente",
            token,
            user: { id: created.id, name: created.name, email: created.email, role: roleSlugSaved },
        });
    }
    catch (error) {
        console.error("Error en registro:", error);
        const { status, body } = mapPrismaError(error);
        res.status(status).json(body);
    }
});
/** GET /api/auth/me (requiere token) */
router.get("/me", auth_1.authRequired, async (req, res) => {
    try {
        const me = await prisma_1.prisma.user.findUnique({
            where: { id: req.user?.id },
            include: {
                role: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        permissions: true
                    }
                },
                tutor: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });
        if (!me)
            return res.status(404).json({ ok: false, message: "Usuario no encontrado" });
        res.json({
            ok: true,
            user: {
                id: me.id,
                name: me.name,
                email: me.email,
                documentoIdentidad: me.documentoIdentidad,
                ciudad: me.ciudad,
                activo: me.activo,
                tutorId: me.tutorId,
                role: me.role?.slug ?? "UNKNOWN",
                roleInfo: me.role,
            },
        });
    }
    catch (error) {
        console.error("Error en /me:", error);
        res.status(500).json({ ok: false, message: "Error interno del servidor" });
    }
});
exports.default = router;
