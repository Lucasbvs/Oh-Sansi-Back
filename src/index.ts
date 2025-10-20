// src/index.ts
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import authRoutes from "./routes/auth";
import competitionsRoutes from "./routes/competitions";
import usersRoutes from "./routes/users";
import adminUsersRoutes from "./routes/admin.users";
import rolesRoutes from "./routes/roles";
import inscriptionsRoutes from "./routes/inscriptions";

const app = express();

// CORS
app.use(cors({
  origin: ["http://localhost:3000"],
  credentials: true,
  methods: ["GET","POST","PUT","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
}));
app.use(express.json());

// Rutas
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/competitions", competitionsRoutes);
app.use("/api/admin/users", adminUsersRoutes);
app.use("/api/roles", rolesRoutes);
app.use("/api/inscriptions", inscriptionsRoutes);

// health
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// 404 JSON
app.use((_req, res) => res.status(404).json({ ok:false, message:"Not Found" }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API en http://localhost:${PORT}`));
