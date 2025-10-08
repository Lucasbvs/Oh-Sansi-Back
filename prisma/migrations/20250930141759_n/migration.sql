/*
  Warnings:

  - You are about to drop the column `documentoIdentidad` on the `User` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "public"."Role" ADD VALUE 'TUTOR';

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "documentoIdentidad",
ADD COLUMN     "ciudad" VARCHAR(20);
