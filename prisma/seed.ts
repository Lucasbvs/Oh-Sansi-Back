import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const email = "admin@ohsansi.com";           
  const password = "OhSansi!2025";             
  const hash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { role: Role.ADMIN, name: "Admin", activo: true },
    create: { email, name: "Admin", passwordHash: hash, role: Role.ADMIN, activo: true },
  });

  console.log("Admin listo:", user.email, "password:", password);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
