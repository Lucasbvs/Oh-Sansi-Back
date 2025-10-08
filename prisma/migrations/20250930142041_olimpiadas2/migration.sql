/*
  Warnings:

  - You are about to drop the column `departamentoProcedencia` on the `User` table. All the data in the column will be lost.
  - Made the column `ciudad` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "departamentoProcedencia",
ALTER COLUMN "ciudad" SET NOT NULL;
