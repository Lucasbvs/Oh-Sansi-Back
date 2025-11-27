"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRoles = void 0;
const requireRoles = (...roles) => {
    return (req, res, next) => {
        const user = req.user;
        if (!user)
            return res.status(401).json({ ok: false, message: "No autorizado" });
        if (!roles.includes(user.role)) {
            return res.status(403).json({ ok: false, message: "Permisos insuficientes" });
        }
        next();
    };
};
exports.requireRoles = requireRoles;
