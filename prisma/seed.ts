import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  // 1) Rol ADMIN
  const adminRole = await prisma.role.upsert({
    where: { slug: "ADMIN" },
    create: {
      name: "Administrador",
      slug: "ADMIN",
      isSystem: true,
      permissions: {
        navbar: { home: true, competencias: true, usuarios: true, roles: true },
        competitions: { read: true, create: true, update: true, delete: true },
        users: { read: true, create: true, update: true, delete: true },
      },
    },
    update: {}, // no cambies nada si ya existe
  });

  // 2) Usuario admin
  const email = "admin@ohsansi.com";
  const exists = await prisma.user.findUnique({ where: { email } });
  if (!exists) {
    const passwordHash = await bcrypt.hash("OhSansi!2025", 10);
    await prisma.user.create({
      data: {
        name: "Admin",
        email,
        passwordHash,
        ciudad: "COCHABAMBA",
        role: { connect: { id: adminRole.id } },
      },
    });
    console.log("✅ Usuario admin creado:", email);
  } else {
    console.log("ℹ️  Usuario admin ya existe:", email);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
