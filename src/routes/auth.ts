import { Router } from "express";
import { prisma } from "../lib/prisma";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { authRequired } from "../middleware/auth";
import { Prisma, Role } from "@prisma/client";

const router = Router();

/* =========================
   Schemas
   ========================= */

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const RegisterSchema = z.object({
  name: z.string().min(2, "Nombre muy corto"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  ciudad: z.string().max(50).optional().nullable(),
  ci: z.string().max(20).optional().nullable(),
  role: z.enum(["ESTUDIANTE", "TUTOR"]).optional(), // solo estos roles en registro público
});

/* =========================
   Helpers
   ========================= */

function signToken(user: { id: string; email: string; role: Role; name: string }) {
  // Incluimos sub e id para máxima compatibilidad con el middleware /me
  return jwt.sign(
    { sub: user.id, id: user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET as string,
    { expiresIn: "1d" }
  );
}

function mapPrismaError(err: unknown) {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002 -> violación de única (p.ej., email duplicado)
    if (err.code === "P2002" && (err.meta as any)?.target?.includes?.("email")) {
      return { status: 409, body: { ok: false, message: "Ya existe un usuario con este email" } };
    }
  }
  if (err instanceof Prisma.PrismaClientValidationError) {
    // Error de validación de datos (campo inexistente, tipo erróneo, etc.)
    return { status: 400, body: { ok: false, message: "Error de validación en BD", detail: err.message } };
  }
  return { status: 500, body: { ok: false, message: "Error interno del servidor" } };
}

/* =========================
   Rutas
   ========================= */

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Datos inválidos" });

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ ok: false, message: "Credenciales inválidas" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ ok: false, message: "Credenciales inválidas" });

  const token = signToken({ id: user.id, email: user.email, role: user.role, name: user.name });

  res.json({
    ok: true,
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

// POST /api/auth/register  (público: sólo ESTUDIANTE o TUTOR)
router.post("/register", async (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      message: "Datos inválidos",
      errors: parsed.error.issues,
    });
  }

  const { name, email, password, ciudad, ci, role } = parsed.data;

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({
        ok: false,
        message: "Ya existe un usuario con este email",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Forzamos el rol permitido (default: ESTUDIANTE)
    const safeRole: Role = role === "TUTOR" ? Role.TUTOR : Role.ESTUDIANTE;

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: safeRole,
        activo: true,
        documentoIdentidad: ci ?? null, // CI
        ciudad: ciudad ?? null,         // usa el campo correcto del schema
      },
      select: { id: true, name: true, email: true, role: true },
    });

    const token = signToken({ id: user.id, email: user.email, role: user.role, name: user.name });

    res.status(201).json({
      ok: true,
      message: "Usuario creado exitosamente",
      token,
      user,
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
    const id = req.user?.id ?? req.user?.sub;
    const email = req.user?.email;

    if (!id && !email) {
      return res.status(401).json({ ok: false, message: "Token inválido" });
    }

    const me = await prisma.user.findUnique({
      where: id ? { id } : { email },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!me) return res.status(404).json({ ok: false, message: "Usuario no encontrado" });

    res.json({ ok: true, user: me });
  } catch (e) {
    res.status(500).json({ ok: false, message: "Error interno del servidor" });
  }
});

export default router;
