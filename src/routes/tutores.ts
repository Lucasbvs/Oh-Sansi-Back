import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authRequired } from "../middleware/auth";
import { Prisma } from "@prisma/client";

const router = Router();


router.get("/", authRequired, async (req: any, res) => {
  try {
    console.log("🔍 Buscando tutores (usuarios con rol TUTOR)...");
    
    const tutores = await prisma.user.findMany({
      where: { 
        role: {
          slug: "TUTOR"
        },
        activo: true
      },
      select: {
        id: true,
        name: true,
        email: true,
        ciudad: true,
        _count: {
          select: {
            estudiantesTutorados: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    console.log(`📊 Encontrados ${tutores.length} tutores`);
    
    res.json({ 
      ok: true, 
      tutores: tutores.map(t => ({
        id: t.id,
        nombre: t.name,
        email: t.email,
        ciudad: t.ciudad,
        _count: t._count
      }))
    });
    
  } catch (error) {
    console.error("Error fetching tutores:", error);
    res.status(500).json({ ok: false, message: "Error interno del servidor" });
  }
});


router.post("/:tutorId/asignar", authRequired, async (req: any, res) => {
  try {
    const { tutorId } = req.params;
    const estudianteId = req.user.id;

    console.log(`🎯 Intentando asignar tutor ${tutorId} a estudiante ${estudianteId}`);

    // Verificar que el usuario es estudiante
    const estudiante = await prisma.user.findUnique({
      where: { id: estudianteId },
      include: { role: true }
    });

    if (!estudiante || estudiante.role?.slug !== "ESTUDIANTE") {
      return res.status(403).json({ ok: false, message: "Solo los estudiantes pueden asignarse tutores" });
    }

    // Verificar que el tutor existe y es realmente un TUTOR
    const tutor = await prisma.user.findUnique({
      where: { 
        id: tutorId,
        role: {
          slug: "TUTOR"
        }
      },
      include: {
        role: true
      }
    });

    if (!tutor) {
      return res.status(404).json({ ok: false, message: "Tutor no encontrado o no tiene el rol de TUTOR" });
    }

    console.log(`✅ Tutor válido encontrado: ${tutor.name}, Estudiante: ${estudiante.name}`);

    // Asignar tutor al estudiante
    await prisma.user.update({
      where: { id: estudianteId },
      data: { 
        tutorId: tutorId
      }
    });

    console.log(`✅ Tutor asignado correctamente: ${tutor.name} -> ${estudiante.name}`);

    res.json({ 
      ok: true, 
      message: "Tutor asignado correctamente",
      tutor: {
        id: tutor.id,
        nombre: tutor.name,
        email: tutor.email,
        ciudad: tutor.ciudad
      }
    });
  } catch (error) {
    console.error("Error asignando tutor:", error);
    
    // Manejo específico de errores de Prisma
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2003') {
        return res.status(400).json({ 
          ok: false, 
          message: "Error: El tutor no existe o no es válido" 
        });
      }
      if (error.code === 'P2025') {
        return res.status(404).json({ 
          ok: false, 
          message: "Estudiante no encontrado" 
        });
      }
    }
    
    res.status(500).json({ ok: false, message: "Error interno del servidor" });
  }
});


router.delete("/desasignar", authRequired, async (req: any, res) => {
  try {
    const estudianteId = req.user.id;

    // Verificar que el usuario es estudiante
    const estudiante = await prisma.user.findUnique({
      where: { id: estudianteId },
      include: { role: true }
    });

    if (!estudiante || estudiante.role?.slug !== "ESTUDIANTE") {
      return res.status(403).json({ ok: false, message: "Solo los estudiantes pueden desasignarse tutores" });
    }

    await prisma.user.update({
      where: { id: estudianteId },
      data: { tutorId: null }
    });

    res.json({ ok: true, message: "Tutor desasignado correctamente" });
  } catch (error) {
    console.error("Error desasignando tutor:", error);
    res.status(500).json({ ok: false, message: "Error interno del servidor" });
  }
});


router.get("/mi-tutor", authRequired, async (req: any, res) => {
  try {
    const estudianteId = req.user.id;

    const estudiante = await prisma.user.findUnique({
      where: { id: estudianteId },
      include: {
        tutor: {
          select: {
            id: true,
            name: true,
            email: true,
            ciudad: true
          }
        }
      }
    });

    if (!estudiante) {
      return res.status(404).json({ ok: false, message: "Estudiante no encontrado" });
    }

    res.json({ 
      ok: true, 
      tutor: estudiante.tutor ? {
        id: estudiante.tutor.id,
        nombre: estudiante.tutor.name,
        email: estudiante.tutor.email,
        ciudad: estudiante.tutor.ciudad
      } : null
    });
  } catch (error) {
    console.error("Error obteniendo tutor:", error);
    res.status(500).json({ ok: false, message: "Error interno del servidor" });
  }
});

export default router;