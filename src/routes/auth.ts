// src/routes/auth.ts
import { Router } from "express";
import { prisma } from "../lib/prisma";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { authRequired } from "../middleware/auth";
import { Prisma, Ciudad } from "@prisma/client";

const router = Router();

/* Schemas */
const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const RegisterSchema = z.object({
  name: z.string().min(2, "Nombre muy corto"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  ciudad: z.nativeEnum(Ciudad).optional(),  // 👈 enum opcional
  ci: z.string().max(20).optional().nullable(),
  roleSlug: z.enum(["ESTUDIANTE", "TUTOR"]).optional(), // registro público
});

/* Helpers */
function signToken(user: { id: string; email: string; name: string; roleSlug: string }) {
  return jwt.sign(
    { sub: user.id, id: user.id, email: user.email, name: user.name, roleSlug: user.roleSlug },
    process.env.JWT_SECRET as string,
    { expiresIn: "1d" }
  );
}

function mapPrismaError(err: unknown) {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002" && (err.meta as any)?.target?.includes?.("email")) {
      return { status: 409, body: { ok: false, message: "Ya existe un usuario con este email" } };
    }
  }
  if (err instanceof Prisma.PrismaClientValidationError) {
    return { status: 400, body: { ok: false, message: "Error de validación en BD", detail: err.message } };
  }
  return { status: 500, body: { ok: false, message: "Error interno del servidor" } };
}

/* Rutas */

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Datos inválidos" });

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, passwordHash: true, role: { select: { slug: true } } },
  });
  if (!user) return res.status(401).json({ ok: false, message: "Credenciales inválidas" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ ok: false, message: "Credenciales inválidas" });

  const roleSlug = user.role?.slug ?? "UNKNOWN";
  const token = signToken({ id: user.id, email: user.email, name: user.name, roleSlug });

  res.json({
    ok: true,
    token,
    user: { id: user.id, name: user.name, email: user.email, role: roleSlug },
  });
});

// POST /api/auth/register  (público: sólo ESTUDIANTE o TUTOR)
router.post("/register", async (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, message: "Datos inválidos", errors: parsed.error.issues });
  }

  const { name, email, password, ciudad, ci, roleSlug } = parsed.data;

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(409).json({ ok: false, message: "Ya existe un usuario con este email" });

    const passwordHash = await bcrypt.hash(password, 10);

    const slug = roleSlug === "TUTOR" ? "TUTOR" : "ESTUDIANTE";
    const role = await prisma.role.findUnique({ where: { slug } });
    if (!role) return res.status(500).json({ ok:false, message:"Rol por defecto no encontrado" });

    // Si no hay default en Prisma, definimos uno aquí para no mandar null
    const safeCiudad: Ciudad = ciudad ?? Ciudad.COCHABAMBA;

    const created = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: { connect: { id: role.id } },
        activo: true,
        documentoIdentidad: ci ?? null,
        ciudad: safeCiudad, // 👈 enum, no null
      },
      select: { id: true, name: true, email: true, role: { select: { slug: true } } },
    });

    const roleSlugSaved = created.role?.slug ?? "UNKNOWN";
    const token = signToken({ id: created.id, email: created.email, name: created.name, roleSlug: roleSlugSaved });

    res.status(201).json({
      ok: true,
      message: "Usuario creado exitosamente",
      token,
      user: { id: created.id, name: created.name, email: created.email, role: roleSlugSaved },
    });
  } catch (error) {
    console.error("Error en registro:", error);
    const { status, body } = mapPrismaError(error);
    res.status(status).json(body);
  }
});

/** GET /api/auth/me (requiere token) */
router.get("/me", authRequired, async (req: any, res) => {
  try {
    const me = await prisma.user.findUnique({
      where: { id: req.user?.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: { select: { id: true, name: true, slug: true, permissions: true } },
      },
    });
    if (!me) return res.status(404).json({ ok: false, message: "Usuario no encontrado" });

    res.json({
      ok: true,
      user: {
        id: me.id,
        name: me.name,
        email: me.email,
        role: me.role?.slug ?? "UNKNOWN",
        roleInfo: me.role,
      },
    });
  } catch {
    res.status(500).json({ ok: false, message: "Error interno del servidor" });
  }
});

export default router;
