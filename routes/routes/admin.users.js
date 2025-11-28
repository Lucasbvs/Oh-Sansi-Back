const express = require("express");
const { prisma } = require("../lib/prisma");
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const { authRequired } = require("../middleware/auth");
const { Ciudad } = require("@prisma/client");

const router = express.Router();

const AdminCreateSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  ciudad: z.nativeEnum(Ciudad),
  ci: z.string().max(20).optional().nullable(),
  roleId: z.string().uuid(),
});

router.post("/", authRequired, async (req, res) => {
  if (req.user.roleSlug !== "ADMIN")
    return res.status(403).json({ ok: false, message: "Solo ADMIN" });

  const parsed = AdminCreateSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ 
      ok: false, 
      message: "Datos inválidos", 
      errors: parsed.error.issues 
    });

  const { name, email, password, ciudad, ci, roleId } = parsed.data;

  try {
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
        ciudad,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: { select: { slug: true } },
        createdAt: true,
      },
    });

    return res.status(201).json({ 
      ok: true, 
      user: { 
        ...user, 
        role: user.role?.slug ?? "UNKNOWN" 
      } 
    });
  } catch (error) {
    console.error("Error creating admin user:", error);
    return res.status(500).json({ 
      ok: false, 
      message: "Error interno del servidor" 
    });
  }
});

// ✅ CORREGIDO: module.exports en lugar de exports.default
module.exports = router;