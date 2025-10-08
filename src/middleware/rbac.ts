import { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";

export const requireRoles = (...roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ ok: false, message: "No autorizado" });
    if (!roles.includes(user.role)) {
      return res.status(403).json({ ok: false, message: "Permisos insuficientes" });
    }
    next();
  };
};
