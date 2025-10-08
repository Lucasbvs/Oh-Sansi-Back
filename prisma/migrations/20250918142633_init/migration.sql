-- CreateTable
CREATE TABLE "public"."Competencia" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "nivel" TEXT NOT NULL,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Competencia_pkey" PRIMARY KEY ("id")
);
