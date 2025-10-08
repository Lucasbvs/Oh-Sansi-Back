// index.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");

// Routers
const competitionsRouter = require("./routes/competitions"); // <-- nuevo

const app = express();

app.use(cors({
  origin: ["http://localhost:3000"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());

// Salud
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Monta tus APIs
app.use("/api/competitions", competitionsRouter);

// (opcional) tu raíz
app.get("/", (_req, res) => res.send("Backend funcionando 🚀"));

// 404 JSON (evita el HTML "Cannot GET ...")
app.use((_req, res) => res.status(404).json({ ok: false, message: "Not Found" }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API en http://localhost:${PORT}`));
