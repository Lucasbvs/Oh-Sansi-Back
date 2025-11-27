"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/index.ts
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const auth_1 = __importDefault(require("./routes/auth"));
const competitions_1 = __importDefault(require("./routes/competitions"));
const users_1 = __importDefault(require("./routes/users"));
const admin_users_1 = __importDefault(require("./routes/admin.users"));
const roles_1 = __importDefault(require("./routes/roles"));
const inscriptions_1 = __importDefault(require("./routes/inscriptions"));
const tutores_1 = __importDefault(require("./routes/tutores"));
const evaluaciones_1 = __importDefault(require("./routes/evaluaciones")); // ← AGREGAR
const app = (0, express_1.default)();
// CORS
app.use((0, cors_1.default)({
    origin: ["http://localhost:3000"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express_1.default.json());
// Rutas
app.use("/api/auth", auth_1.default);
app.use("/api/users", users_1.default);
app.use("/api/competitions", competitions_1.default);
app.use("/api/admin/users", admin_users_1.default);
app.use("/api/roles", roles_1.default);
app.use("/api/inscriptions", inscriptions_1.default);
app.use("/api/tutores", tutores_1.default);
app.use("/api/evaluaciones", evaluaciones_1.default); // ← AGREGAR
// health
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use((_req, res) => res.status(404).json({ ok: false, message: "Not Found" }));
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API en http://localhost:${PORT}`));
