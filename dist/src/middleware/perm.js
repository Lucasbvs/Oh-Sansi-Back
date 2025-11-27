"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasPermission = hasPermission;
exports.requirePerm = requirePerm;
const prisma_1 = require("../lib/prisma");
async function hasPermission(req, perm) {
    const user = req.user;
    if (!user?.id)
        return false;
    // ADMIN: full access
    if (user.roleSlug === "ADMIN")
        return true;
    let role = user.role ?? null;
    if (!role) {
        const dbUser = await prisma_1.prisma.user.findUnique({
            where: { id: user.id },
            select: { role: { select: { slug: true, permissions: true } } }
        });
        role = dbUser?.role ?? null;
    }
    if (!role)
        return false;
    const [group, action] = perm.split(".");
    const p = role.permissions;
    if (!p)
        return false;
    if (group === "navbar")
        return Boolean(p.navbar?.[action]);
    if (group === "competitions")
        return Boolean(p.competitions?.[action]);
    if (group === "users")
        return Boolean(p.users?.[action]);
    if (group === "inscriptions")
        return Boolean(p.inscriptions?.[action]);
    if (group === "evaluaciones")
        return Boolean(p.evaluaciones?.[action]); // ← AGREGAR
    return false;
}
function requirePerm(perm) {
    return async (req, res, next) => {
        try {
            const ok = await hasPermission(req, perm);
            if (!ok)
                return res.status(403).json({ ok: false, message: "Permisos insuficientes" });
            next();
        }
        catch {
            res.status(500).json({ ok: false, message: "Error de permisos" });
        }
    };
}
