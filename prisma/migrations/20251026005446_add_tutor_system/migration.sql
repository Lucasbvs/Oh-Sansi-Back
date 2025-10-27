-- AlterTable
ALTER TABLE "public"."Inscripcion" ADD COLUMN     "tutorId" TEXT;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "tutorId" TEXT;

-- CreateTable
CREATE TABLE "public"."Tutor" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT,
    "especialidad" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tutor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tutor_email_key" ON "public"."Tutor"("email");

-- CreateIndex
CREATE INDEX "Inscripcion_tutorId_idx" ON "public"."Inscripcion"("tutorId");

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "public"."Tutor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Inscripcion" ADD CONSTRAINT "Inscripcion_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "public"."Tutor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
