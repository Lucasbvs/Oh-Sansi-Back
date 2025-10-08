/*
  Warnings:

  - The values [competidor] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `createdAt` on the `Competition` table. All the data in the column will be lost.
  - You are about to alter the column `nombre` on the `Competition` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to drop the `Area` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Payment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_AreaToCompetition` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `area` to the `Competition` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."Role_new" AS ENUM ('superadmin', 'admin', 'responsable', 'evaluador', 'estudiante');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "public"."User" ALTER COLUMN "role" TYPE "public"."Role_new" USING ("role"::text::"public"."Role_new");
ALTER TYPE "public"."Role" RENAME TO "Role_old";
ALTER TYPE "public"."Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
ALTER TABLE "public"."User" ALTER COLUMN "role" SET DEFAULT 'estudiante';
COMMIT;

-- DropForeignKey
ALTER TABLE "public"."Payment" DROP CONSTRAINT "Payment_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."_AreaToCompetition" DROP CONSTRAINT "_AreaToCompetition_A_fkey";

-- DropForeignKey
ALTER TABLE "public"."_AreaToCompetition" DROP CONSTRAINT "_AreaToCompetition_B_fkey";

-- AlterTable
ALTER TABLE "public"."Competition" DROP COLUMN "createdAt",
ADD COLUMN     "area" VARCHAR(100) NOT NULL,
ADD COLUMN     "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "nombre" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "estado" SET DEFAULT 'Activo';

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "departamentoProcedencia" VARCHAR(50),
ADD COLUMN     "documentoIdentidad" VARCHAR(20),
ALTER COLUMN "role" SET DEFAULT 'estudiante';

-- DropTable
DROP TABLE "public"."Area";

-- DropTable
DROP TABLE "public"."Payment";

-- DropTable
DROP TABLE "public"."_AreaToCompetition";

-- DropEnum
DROP TYPE "public"."Currency";

-- DropEnum
DROP TYPE "public"."PaymentStatus";

-- CreateTable
CREATE TABLE "public"."Inscripcion" (
    "id" TEXT NOT NULL,
    "fechaInscripcion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gradoEscolaridad" VARCHAR(30),
    "tutorAcademico" VARCHAR(150),
    "userId" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,

    CONSTRAINT "Inscripcion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Inscripcion_userId_idx" ON "public"."Inscripcion"("userId");

-- CreateIndex
CREATE INDEX "Inscripcion_competitionId_idx" ON "public"."Inscripcion"("competitionId");

-- AddForeignKey
ALTER TABLE "public"."Inscripcion" ADD CONSTRAINT "Inscripcion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Inscripcion" ADD CONSTRAINT "Inscripcion_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "public"."Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
