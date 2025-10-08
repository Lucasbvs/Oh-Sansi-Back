/*
  Warnings:

  - The values [Activo,Archivado,Borrador] on the enum `Estado` will be removed. If these variants are still used in the database, this will fail.
  - The values [Principiante,Intermedio,Avanzado] on the enum `Nivel` will be removed. If these variants are still used in the database, this will fail.
  - The values [superadmin,admin,responsable,evaluador,estudiante] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.
  - You are about to alter the column `nombre` on the `Competition` table. The data in that column could be lost. The data in that column will be cast from `VarChar(100)` to `VarChar(45)`.
  - Added the required column `updateAt` to the `Competition` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `area` on the `Competition` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "public"."Area" AS ENUM ('MATEMATICA', 'FISICA', 'ROBOTICA', 'QUIMICA', 'PROGRAMACION');

-- AlterEnum
BEGIN;
CREATE TYPE "public"."Estado_new" AS ENUM ('INSCRIPCION', 'DESARROLLO', 'EVALUACION', 'MODIFICACIONES', 'FINALIZACION');
ALTER TABLE "public"."Competition" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "public"."Competition" ALTER COLUMN "estado" TYPE "public"."Estado_new" USING ("estado"::text::"public"."Estado_new");
ALTER TYPE "public"."Estado" RENAME TO "Estado_old";
ALTER TYPE "public"."Estado_new" RENAME TO "Estado";
DROP TYPE "public"."Estado_old";
ALTER TABLE "public"."Competition" ALTER COLUMN "estado" SET DEFAULT 'INSCRIPCION';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "public"."Nivel_new" AS ENUM ('PRINCIPIANTE', 'INTERMEDIO', 'AVANZADO');
ALTER TABLE "public"."Competition" ALTER COLUMN "nivel" TYPE "public"."Nivel_new" USING ("nivel"::text::"public"."Nivel_new");
ALTER TYPE "public"."Nivel" RENAME TO "Nivel_old";
ALTER TYPE "public"."Nivel_new" RENAME TO "Nivel";
DROP TYPE "public"."Nivel_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "public"."Role_new" AS ENUM ('ADMIN', 'RESPONSABLEACADEMICO', 'EVALUADOR', 'ESTUDIANTE');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "public"."User" ALTER COLUMN "role" TYPE "public"."Role_new" USING ("role"::text::"public"."Role_new");
ALTER TYPE "public"."Role" RENAME TO "Role_old";
ALTER TYPE "public"."Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
ALTER TABLE "public"."User" ALTER COLUMN "role" SET DEFAULT 'ESTUDIANTE';
COMMIT;

-- AlterTable
ALTER TABLE "public"."Competition" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updateAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "nombre" SET DATA TYPE VARCHAR(45),
ALTER COLUMN "estado" SET DEFAULT 'INSCRIPCION',
ALTER COLUMN "participantes" SET DEFAULT 1,
DROP COLUMN "area",
ADD COLUMN     "area" "public"."Area" NOT NULL;

-- AlterTable
ALTER TABLE "public"."User" ALTER COLUMN "role" SET DEFAULT 'ESTUDIANTE';
