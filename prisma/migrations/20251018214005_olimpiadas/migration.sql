-- CreateEnum
CREATE TYPE "Nivel" AS ENUM ('PRINCIPIANTE', 'INTERMEDIO', 'AVANZADO');

-- CreateEnum
CREATE TYPE "Area" AS ENUM ('MATEMATICA', 'FISICA', 'ROBOTICA', 'QUIMICA', 'PROGRAMACION');

-- CreateEnum
CREATE TYPE "Ciudad" AS ENUM ('PANDO', 'LAPAZ', 'COCHABAMBA', 'BENI', 'SANTACRUZ', 'ORURO', 'POTOSI', 'CHUQUISACA', 'TARIJA');

-- CreateEnum
CREATE TYPE "Modalidad" AS ENUM ('PRESENCIAL', 'VIRTUAL');

-- CreateEnum
CREATE TYPE "Etapa" AS ENUM ('INSCRIPCION', 'DESARROLLO', 'EVALUACION', 'CORRECCION', 'PREMIACION');

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "permissions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ciudad" "Ciudad" NOT NULL DEFAULT 'COCHABAMBA',
    "documentoIdentidad" VARCHAR(20),
    "roleId" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competition" (
    "id" TEXT NOT NULL,
    "nombre" VARCHAR(45) NOT NULL,
    "nivel" "Nivel" NOT NULL,
    "area" "Area" NOT NULL,
    "participantes" INTEGER NOT NULL DEFAULT 1,
    "modalidad" "Modalidad" NOT NULL DEFAULT 'PRESENCIAL',
    "formaCalificacion" VARCHAR(400) NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Competition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EtapaCompetencia" (
    "id" TEXT NOT NULL,
    "etapa" "Etapa" NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3),
    "competitionId" TEXT NOT NULL,

    CONSTRAINT "EtapaCompetencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fase" (
    "id" TEXT NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "competitionId" TEXT NOT NULL,

    CONSTRAINT "Fase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inscripcion" (
    "id" TEXT NOT NULL,
    "fechaInscripcion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gradoEscolaridad" VARCHAR(30),
    "tutorAcademico" VARCHAR(150),
    "userId" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,

    CONSTRAINT "Inscripcion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Role_slug_key" ON "Role"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "EtapaCompetencia_competitionId_idx" ON "EtapaCompetencia"("competitionId");

-- CreateIndex
CREATE INDEX "EtapaCompetencia_etapa_competitionId_idx" ON "EtapaCompetencia"("etapa", "competitionId");

-- CreateIndex
CREATE INDEX "Fase_competitionId_idx" ON "Fase"("competitionId");

-- CreateIndex
CREATE INDEX "Inscripcion_userId_idx" ON "Inscripcion"("userId");

-- CreateIndex
CREATE INDEX "Inscripcion_competitionId_idx" ON "Inscripcion"("competitionId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EtapaCompetencia" ADD CONSTRAINT "EtapaCompetencia_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fase" ADD CONSTRAINT "Fase_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscripcion" ADD CONSTRAINT "Inscripcion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscripcion" ADD CONSTRAINT "Inscripcion_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
