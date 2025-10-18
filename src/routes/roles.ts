// src/routes/roles.ts
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { z } from "zod";
import { authRequired } from "../middleware/auth";
import { requirePerm } from "../middleware/perm";
import { Prisma } from "@prisma/client";

const router = Router();

const PermsSchema = z.object({
  navbar: z
    .object({
      home: z.boolean().optional(),
      competencias: z.boolean().optional(),
      usuarios: z.boolean().optional(),
      roles: z.boolean().optional(), // reservado solo para ADMIN en UI
    })
    .optional(),
  competitions: z
    .object({
      read: z.boolean().optional(),
      create: z.boolean().optional(),
      update: z.boolean().optional(),
      delete: z.boolean().optional(),
    })
    .optional(),
  users: z
    .object({
      read: z.boolean().optional(),
      create: z.boolean().optional(),
      update: z.boolean().optional(),
      delete: z.boolean().optional(),
    })
    .optional(),
}).optional();

const RoleBody = z.object({
  name: z.string().min(2).max(40),
  slug: z.string().regex(/^[A-Z0-9_]+$/).min(3).max(40),
  permissions: PermsSchema,
});

const isAdminSlug = (s?: string | null) => s === "ADMIN";

/* =========================
   Helpers
   ========================= */
function mapCreateUpdateError(err: unknown): { status: number; message: string } {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002 => unique constraint violation
    if (err.code === "P2002") {
      const target = (err.meta as any)?.target ?? [];
      if (Array.isArray(target)) {
        if (target.includes("slug")) return { status: 409, message: "Ya existe un rol con ese slug" };
        if (target.includes("name")) return { status: 409, message: "Ya existe un rol con ese nombre" };
      }
      return { status: 409, message: "Registro duplicado" };
    }
  }
  return { status: 500, message: "Error interno del servidor" };
}

/* =========================
   Rutas
   ========================= */

// === Listar (cualquiera con users.read) ===
router.get("/", authRequired, requirePerm("users.read"), async (_req, res) => {
  const roles = await prisma.role.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      isSystem: true,
      permissions: true,
      createdAt: true,
      _count: { select: { users: true } },
    },
  });
  res.json({ ok: true, roles });
});

// === Obtener uno por id (cualquiera con users.read) ===
router.get("/:id", authRequired, requirePerm("users.read"), async (req, res) => {
  const r = await prisma.role.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      name: true,
      slug: true,
      isSystem: true,
      permissions: true,
      createdAt: true,
      _count: { select: { users: true } },
    },
  });
  if (!r) return res.status(404).json({ ok: false, message: "No encontrado" });
  res.json({ ok: true, role: r });
});

// === Crear (solo ADMIN) ===
router.post("/", authRequired, async (req: any, res) => {
  if (req.user.roleSlug !== "ADMIN") return res.status(403).json({ ok: false, message: "Solo ADMIN" });

  const parsed = RoleBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, message: "Datos inválidos", errors: parsed.error.issues });
  }

  const { name, slug, permissions } = parsed.data;
  if (isAdminSlug(slug)) return res.status(400).json({ ok: false, message: "Slug reservado" });

  try {
    const role = await prisma.role.create({
      data: { name, slug, isSystem: false, permissions: permissions ?? {} },
      select: { id: true, name: true, slug: true, isSystem: true, permissions: true, createdAt: true },
    });
    res.status(201).json({ ok: true, role });
  } catch (err) {
    const { status, message } = mapCreateUpdateError(err);
    res.status(status).json({ ok: false, message });
  }
});

// === Editar (solo ADMIN, no roles de sistema) ===
router.put("/:id", authRequired, async (req: any, res) => {
  if (req.user.roleSlug !== "ADMIN") return res.status(403).json({ ok: false, message: "Solo ADMIN" });

  const parsed = RoleBody.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: "Datos inválidos", errors: parsed.error.issues });

  const current = await prisma.role.findUnique({
    where: { id: req.params.id },
    select: { slug: true, isSystem: true },
  });
  if (!current) return res.status(404).json({ ok: false, message: "No encontrado" });
  if (current.isSystem || isAdminSlug(current.slug)) {
    return res.status(400).json({ ok: false, message: "No se puede editar rol de sistema" });
  }

  // impedir que intenten convertir otro rol en ADMIN
  if (parsed.data.slug && isAdminSlug(parsed.data.slug)) {
    return res.status(400).json({ ok: false, message: "Slug reservado" });
  }

  try {
    const role = await prisma.role.update({
      where: { id: req.params.id },
      data: { ...parsed.data },
      select: { id: true, name: true, slug: true, isSystem: true, permissions: true, createdAt: true },
    });
    res.json({ ok: true, role });
  } catch (err) {
    const { status, message } = mapCreateUpdateError(err);
    res.status(status).json({ ok: false, message });
  }
});

// === Eliminar (solo ADMIN, no roles de sistema) ===
router.delete("/:id", authRequired, async (req: any, res) => {
  if (req.user.roleSlug !== "ADMIN") return res.status(403).json({ ok: false, message: "Solo ADMIN" });

  try {
    const current = await prisma.role.findUnique({
      where: { id: req.params.id },
      select: { id: true, slug: true, isSystem: true, _count: { select: { users: true } } },
    });

    if (!current) return res.status(404).json({ ok: false, message: "No encontrado" });
    if (current.isSystem || isAdminSlug(current.slug)) {
      return res.status(400).json({ ok: false, message: "No se puede eliminar rol de sistema" });
    }

    if (current._count.users > 0) {
      return res.status(409).json({
        ok: false,
        message: "No se puede eliminar: el rol tiene usuarios asignados.",
        detail: `Usuarios asociados: ${current._count.users}`,
      });
    }

    await prisma.role.delete({ where: { id: current.id } });
    res.json({ ok: true, message: "Rol eliminado" });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      // P2003 => restricción FK; P2025 => registro no encontrado
      if (err.code === "P2003") {
        return res.status(409).json({ ok: false, message: "No se puede eliminar por registros relacionados." });
      }
      if (err.code === "P2025") {
        return res.status(404).json({ ok: false, message: "Rol no encontrado" });
      }
    }
    console.error("DELETE /api/roles error:", err);
    res.status(500).json({ ok: false, message: "Error interno del servidor" });
  }
});

export default router;
