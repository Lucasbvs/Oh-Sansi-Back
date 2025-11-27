"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRequired = authRequired;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../lib/prisma");
async function authRequired(req, res, next) {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token)
        return res.status(401).json({ ok: false, message: "No autorizado" });
    try {
        const payload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        // obtenemos slug/permissions frescos
        const dbUser = await prisma_1.prisma.user.findUnique({
            where: { id: payload.id ?? payload.sub },
            select: { id: true, email: true, name: true, role: { select: { slug: true, permissions: true } } }
        });
        if (!dbUser)
            return res.status(401).json({ ok: false, message: "Token inválido" });
        req.user = {
            id: dbUser.id,
            email: dbUser.email,
            name: dbUser.name,
            roleSlug: dbUser.role?.slug ?? "UNKNOWN",
            role: dbUser.role ?? null,
        };
        next();
    }
    catch {
        return res.status(401).json({ ok: false, message: "Token inválido" });
    }
}
