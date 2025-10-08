/*
  Warnings:

  - You are about to drop the column `fecha` on the `Competition` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Competition" DROP COLUMN "fecha",
ADD COLUMN     "fechaInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
