require("dotenv").config();
const express = require("express");
const cors = require("cors");

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

// Monta todas tus APIs CORREGIDAS (.default)
app.use("/api/auth", require("./routes/routes/auth").default);
app.use("/api/users", require("./routes/routes/users").default);
app.use("/api/admin/users", require("./routes/routes/admin.users").default);
app.use("/api/competitions", require("./routes/routes/competitions").default);
app.use("/api/inscriptions", require("./routes/routes/inscriptions").default);
app.use("/api/evaluations", require("./routes/routes/evaluaciones").default);
app.use("/api/roles", require("./routes/routes/roles").default);
app.use("/api/tutores", require("./routes/routes/tutores").default);

// (opcional) tu raíz
app.get("/", (_req, res) => res.send("Backend OH SANSI funcionando 🚀"));

// 404 JSON (evita el HTML "Cannot GET ...")
app.use((_req, res) => res.status(404).json({ ok: false, message: "Not Found" }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✅ Backend OH SANSI en http://localhost:${PORT}`));