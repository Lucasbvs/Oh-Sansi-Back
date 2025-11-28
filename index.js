require("dotenv").config();
const express = require("express");
const cors = require("cors");

// Importar todas las rutas DESDE LA CARPETA CORRECTA
const authRoutes = require("./routes/routes/auth");
const competitionsRoutes = require("./routes/routes/competitions");
const usersRoutes = require("./routes/routes/users");
const adminUsersRoutes = require("./routes/routes/admin.users");
const rolesRoutes = require("./routes/routes/roles");
const inscriptionsRoutes = require("./routes/routes/inscriptions");
const tutoresRoutes = require("./routes/routes/tutores");
const evaluacionesRoutes = require("./routes/routes/evaluaciones");

const app = express();

// CORS
app.use(cors({
  origin: ["http://localhost:3000"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());

// DEBUG: Verificar y cargar cada ruta individualmente
console.log("🔍 Verificando rutas...");

try {
  console.log("1. Cargando auth...");
  const authRoutes = require("./routes/routes/auth");
  app.use("/api/auth", authRoutes);
  console.log("   ✅ authRoutes cargado");

  console.log("2. Cargando competitions...");
  const competitionsRoutes = require("./routes/routes/competitions");
  app.use("/api/competitions", competitionsRoutes);
  console.log("   ✅ competitionsRoutes cargado");

  console.log("3. Cargando users...");
  const usersRoutes = require("./routes/routes/users");
  app.use("/api/users", usersRoutes);
  console.log("   ✅ usersRoutes cargado");

  console.log("4. Cargando admin.users...");
  const adminUsersRoutes = require("./routes/routes/admin.users");
  app.use("/api/admin/users", adminUsersRoutes);
  console.log("   ✅ adminUsersRoutes cargado");

  console.log("5. Cargando roles...");
  const rolesRoutes = require("./routes/routes/roles");
  app.use("/api/roles", rolesRoutes);
  console.log("   ✅ rolesRoutes cargado");

  console.log("6. Cargando inscriptions...");
  const inscriptionsRoutes = require("./routes/routes/inscriptions");
  app.use("/api/inscriptions", inscriptionsRoutes);
  console.log("   ✅ inscriptionsRoutes cargado");

  console.log("7. Cargando tutores...");
  const tutoresRoutes = require("./routes/routes/tutores");
  app.use("/api/tutores", tutoresRoutes);
  console.log("   ✅ tutoresRoutes cargado");

  console.log("8. Cargando evaluaciones...");
  const evaluacionesRoutes = require("./routes/routes/evaluaciones");
  app.use("/api/evaluaciones", evaluacionesRoutes);
  console.log("   ✅ evaluacionesRoutes cargado");
  
  console.log("🎯 Todas las rutas cargadas correctamente");
} catch (error) {
  console.error("❌ Error en ruta específica:", error.message);
  console.error("Stack trace:", error.stack);
  process.exit(1);
}

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ 
    ok: true, 
    message: "Backend OH SANSI funcionando correctamente",
    timestamp: new Date().toISOString()
  });
});

// 404 - Manejo de rutas no encontradas
app.use((_req, res) => {
  res.status(404).json({ 
    ok: false, 
    message: "Ruta no encontrada" 
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Backend OH SANSI ejecutándose en http://localhost:${PORT}`);
});

module.exports = app;