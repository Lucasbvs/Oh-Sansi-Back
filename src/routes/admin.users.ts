import { Router } from "express";
import { prisma } from "../lib/prisma";
import bcrypt from "bcrypt";
import { z } from "zod";
import { authRequired } from "../middleware/auth";
import { requireRoles } from "../middleware/rbac";
import { Role } from "@prisma/client";

const router = Router();

const AdminCreateSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  ciudad: z.string().max(50).optional().nullable(),
  ci: z.string().max(20).optional().nullable(),
  role: z.nativeEnum(Role), // 👈 cualquier rol del enum
});

/** POST /api/admin/users  (solo ADMIN) */
router.post("/", authRequired, requireRoles(Role.ADMIN), async (req, res) => {
  const parsed = AdminCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, message: "Datos inválidos", errors: parsed.error.issues });
  }

  const { name, email, password, ciudad, ci, role } = parsed.data;

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ ok: false, message: "El correo ya está registrado" });

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role,
      activo: true,
      documentoIdentidad: ci ?? null,
      ciudad: ciudad ?? null,
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  return res.status(201).json({ ok: true, user });
});

export default router;
