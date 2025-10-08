import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

type JwtPayload = {
  sub?: string;
  id?: string;
  email: string;
  role: string;
  name: string;
  iat?: number;
  exp?: number;
};

export function authRequired(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(" ")[1]; // "Bearer <token>"
  if (!token) {
    return res.status(401).json({ ok: false, message: "No autorizado" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;

    // Normalizamos: garantizamos que siempre exista user.id
    (req as any).user = {
      id: payload.id ?? payload.sub, // 👈 clave: usar id si existe, si no sub
      email: payload.email,
      role: payload.role,
      name: payload.name,
    };

    next();
  } catch {
    return res.status(401).json({ ok: false, message: "Token inválido" });
  }
}
