import { Router } from "express";
import { prisma } from "../lib/prisma";
import bcrypt from "bcrypt";
import { z } from "zod";
import { authRequired } from "../middleware/auth";
import { Ciudad } from "@prisma/client"; // 👈 importa el enum

const router = Router();

const AdminCreateSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  ciudad: z.nativeEnum(Ciudad), // 👈 usa enum, no string
  ci: z.string().max(20).optional().nullable(),
  roleId: z.string().uuid(),
});

router.post("/", authRequired, async (req: any, res) => {
  if (req.user.roleSlug !== "ADMIN")
    return res.status(403).json({ ok: false, message: "Solo ADMIN" });

  const parsed = AdminCreateSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ ok: false, message: "Datos inválidos", errors: parsed.error.issues });

  const { name, email, password, ciudad, ci, roleId } = parsed.data;

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists)
    return res.status(409).json({ ok: false, message: "El correo ya está registrado" });

  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role)
    return res.status(400).json({ ok: false, message: "Rol no válido" });

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
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

export default router;
