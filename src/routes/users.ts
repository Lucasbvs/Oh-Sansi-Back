// src/routes/users.ts
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authRequired } from "../middleware/auth";
import { requirePerm } from "../middleware/perm";
import bcrypt from "bcrypt";
import { z } from "zod";

const router = Router();

/** Normaliza un user para el front */
function mapUser(u: any) {
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

/** GET /api/users  (listar) */
router.get(
  "/",
  authRequired,
  requirePerm("users.read"),
  async (_req, res) => {
    const items = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
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
      take: 500,
    });

    res.json(items.map(mapUser));
  }
);

/** GET /api/users/:id  (obtener uno) */
router.get(
  "/:id",
  authRequired,
  requirePerm("users.read"),
  async (req, res) => {
    const u = await prisma.user.findUnique({
      where: { id: req.params.id },
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

    if (!u) return res.status(404).json({ ok: false, message: "No encontrado" });
    res.json({ ok: true, user: mapUser(u) });
  }
);

/** PUT /api/users/:id  (actualizar) */
const UpdateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  ciudad: z.string().max(50).nullable().optional(),
  ci: z.string().max(20).nullable().optional(),
  roleId: z.string().uuid().optional(),
  password: z.string().min(6).optional(), // si viene, cambia password
});

router.put(
  "/:id",
  authRequired,
  requirePerm("users.update"),
  async (req, res) => {
    const parsed = UpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, message: "Datos inválidos", errors: parsed.error.issues });
    }

    const data = parsed.data;

    // si intenta editarse a sí mismo a ADMIN/roles de sistema, no bloquear; los bloqueos van al eliminar
    const updateData: any = {
      name: data.name,
      email: data.email,
      documentoIdentidad: data.ci ?? null,
      ciudad: data.ciudad ?? null,
    };

    if (data.roleId) {
      // validar rol existe
      const role = await prisma.role.findUnique({ where: { id: data.roleId } });
      if (!role) return res.status(400).json({ ok: false, message: "Rol no válido" });
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

      res.json({ ok: true, user: mapUser(u) });
    } catch {
      return res.status(404).json({ ok: false, message: "No encontrado" });
    }
  }
);

/** DELETE /api/users/:id  (eliminar) */
router.delete(
  "/:id",
  authRequired,
  requirePerm("users.delete"),
  async (req: any, res) => {
    // No permitir auto-eliminarse ni eliminar ADMIN/sistema
    if (req.user?.id === req.params.id) {
      return res.status(400).json({ ok: false, message: "No puedes eliminar tu propia cuenta" });
    }

    const u = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, role: { select: { slug: true, isSystem: true } } },
    });
    if (!u) return res.status(404).json({ ok: false, message: "No encontrado" });
    if (u.role?.isSystem || u.role?.slug === "ADMIN") {
      return res.status(400).json({ ok: false, message: "No se puede eliminar un usuario con rol de sistema" });
    }

    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  }
);

export default router;
