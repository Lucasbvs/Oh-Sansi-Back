import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";

export type PermKey =
  | "competitions.read" | "competitions.create" | "competitions.update" | "competitions.delete"
  | "users.read" | "users.create" | "users.update" | "users.delete"
  | "inscriptions.read" | "inscriptions.create" | "inscriptions.delete"
  | "evaluaciones.read" | "evaluaciones.create" | "evaluaciones.update" | "evaluaciones.delete"  // ← AGREGAR
  | "navbar.roles" | "navbar.usuarios" | "navbar.competencias" | "navbar.home";

type Perms = {
  navbar?: Record<string, boolean>;
  competitions?: Partial<Record<"read"|"create"|"update"|"delete", boolean>>;
  users?: Partial<Record<"read"|"create"|"update"|"delete", boolean>>;
  inscriptions?: Partial<Record<"read"|"create"|"delete", boolean>>;
  evaluaciones?: Partial<Record<"read"|"create"|"update"|"delete", boolean>>;  // ← AGREGAR
};

export async function hasPermission(req: Request, perm: PermKey): Promise<boolean> {
  const user = (req as any).user;
  if (!user?.id) return false;

  // ADMIN: full access
  if (user.roleSlug === "ADMIN") return true;

  let role = user.role ?? null;
  if (!role) {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: { select: { slug: true, permissions: true } } }
    });
    role = dbUser?.role ?? null;
  }
  if (!role) return false;

  const [group, action] = perm.split(".");
  const p = role.permissions as Perms | null;
  if (!p) return false;

  if (group === "navbar") return Boolean(p.navbar?.[action]);
  if (group === "competitions") return Boolean(p.competitions?.[action as keyof Perms["competitions"]]);
  if (group === "users") return Boolean(p.users?.[action as keyof Perms["users"]]);
  if (group === "inscriptions") return Boolean(p.inscriptions?.[action as keyof Perms["inscriptions"]]);
  if (group === "evaluaciones") return Boolean(p.evaluaciones?.[action as keyof Perms["evaluaciones"]]);  // ← AGREGAR
  return false;
}

export function requirePerm(perm: PermKey) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ok = await hasPermission(req, perm);
      if (!ok) return res.status(403).json({ ok: false, message: "Permisos insuficientes" });
      next();
    } catch {
      res.status(500).json({ ok: false, message: "Error de permisos" });
    }
  };
}