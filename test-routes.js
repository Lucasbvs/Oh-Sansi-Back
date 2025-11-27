// test-routes.js
console.log("🔍 Probando carga de TODAS las rutas...");

const archivos = [
  "auth",
  "users", 
  "admin.users",
  "competitions",
  "inscriptions",
  "evaluaciones",
  "roles",
  "tutores"
];

archivos.forEach(archivo => {
  try {
    console.log(`Probando ${archivo}...`);
    const modulo = require(`./routes/routes/${archivo}`);
    console.log(`✅ ${archivo} carga correctamente`);
  } catch (error) {
    console.log(`❌ Error en ${archivo}:`, error.message);
  }
});

console.log("🎯 Diagnóstico completo");