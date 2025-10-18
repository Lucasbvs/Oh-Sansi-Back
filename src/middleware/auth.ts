// src/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";

type JwtPayload = {
  sub?: string;
  id?: string;
  email: string;
  name: string;
  roleSlug?: string;
  iat?: number;
  exp?: number;
};

export async function authRequired(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ ok: false, message: "No autorizado" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;

    // obtenemos slug/permissions frescos
    const dbUser = await prisma.user.findUnique({
      where: { id: payload.id ?? payload.sub },
      select: { id: true, email: true, name: true, role: { select: { slug: true, permissions: true } } }
    });

    if (!dbUser) return res.status(401).json({ ok: false, message: "Token inválido" });

    (req as any).user = {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      roleSlug: dbUser.role?.slug ?? "UNKNOWN",
      role: dbUser.role ?? null,
    };
    next();
  } catch {
    return res.status(401).json({ ok: false, message: "Token inválido" });
  }
}
