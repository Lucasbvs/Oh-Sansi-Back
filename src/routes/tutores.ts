// src/routes/tutores.ts
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authRequired } from "../middleware/auth";
import { Prisma } from "@prisma/client";

const router = Router();

// Obtener todos los tutores
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

// Obtener estudiantes del tutor
router.get("/mis-estudiantes", authRequired, async (req: any, res) => {
  try {
    const tutorId = req.user.id;

    const tutor = await prisma.user.findUnique({
      where: { id: tutorId },
      include: { role: true }
    });

    if (!tutor || tutor.role?.slug !== "TUTOR") {
      return res.status(403).json({ ok: false, message: "Solo los tutores pueden ver sus estudiantes" });
    }

    const estudiantes = await prisma.user.findMany({
      where: { 
        tutorId: tutorId,
        activo: true
      },
      select: {
        id: true,
        name: true,
        email: true,
        ciudad: true,
        documentoIdentidad: true,
        createdAt: true,
        inscripciones: {
          include: {
            competition: {
              select: {
                id: true,
                nombre: true,
                area: true,
                nivel: true
              }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.json({ 
      ok: true, 
      estudiantes: estudiantes.map(e => ({
        id: e.id,
        nombre: e.name,
        email: e.email,
        ciudad: e.ciudad,
        ci: e.documentoIdentidad,
        fechaRegistro: e.createdAt,
        competencias: e.inscripciones.map(i => ({
          id: i.competition.id,
          nombre: i.competition.nombre,
          area: i.competition.area,
          nivel: i.competition.nivel
        }))
      }))
    });
    
  } catch (error) {
    console.error("Error fetching estudiantes del tutor:", error);
    res.status(500).json({ ok: false, message: "Error interno del servidor" });
  }
});

// ✅ ASIGNAR TUTOR - CORREGIDO
router.post("/:tutorId/asignar", authRequired, async (req: any, res) => {
  try {
    const { tutorId } = req.params;
    const estudianteId = req.user.id;

    console.log(`🎯 Intentando asignar tutor ${tutorId} a estudiante ${estudianteId}`);

    // Verificar que el usuario es estudiante
    const estudiante = await prisma.user.findUnique({
      where: { id: estudianteId },
      include: { 
        role: true,
        tutor: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!estudiante) {
      return res.status(404).json({ ok: false, message: "Estudiante no encontrado" });
    }

    if (!estudiante.role || estudiante.role?.slug !== "ESTUDIANTE") {
      return res.status(403).json({ 
        ok: false, 
        message: "Solo los estudiantes pueden asignarse tutores" 
      });
    }

    if (estudiante.tutorId) {
      return res.status(400).json({ 
        ok: false, 
        message: "Ya tienes un tutor asignado. Debes desasignarlo primero." 
      });
    }

    // Verificar que el tutor existe
    const tutor = await prisma.user.findUnique({
      where: { 
        id: tutorId,
        activo: true
      },
      include: {
        role: true
      }
    });

    if (!tutor) {
      return res.status(404).json({ ok: false, message: "Tutor no encontrado" });
    }

    if (!tutor.role || tutor.role?.slug !== "TUTOR") {
      return res.status(400).json({ 
        ok: false, 
        message: "El usuario seleccionado no es un tutor válido" 
      });
    }

    // Asignar tutor al estudiante
    const estudianteActualizado = await prisma.user.update({
      where: { id: estudianteId },
      data: { 
        tutorId: tutorId
      },
      include: {
        tutor: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    console.log(`✅ Tutor asignado correctamente`);

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
    console.error("❌ Error asignando tutor:", error);
    
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
    
    res.status(500).json({ 
      ok: false, 
      message: "Error interno del servidor al asignar tutor"
    });
  }
});

// Desasignar tutor
router.delete("/desasignar", authRequired, async (req: any, res) => {
  try {
    const estudianteId = req.user.id;

    const estudiante = await prisma.user.findUnique({
      where: { id: estudianteId },
      include: { 
        role: true,
        tutor: true
      }
    });

    if (!estudiante) {
      return res.status(404).json({ ok: false, message: "Estudiante no encontrado" });
    }

    if (!estudiante.role || estudiante.role?.slug !== "ESTUDIANTE") {
      return res.status(403).json({ ok: false, message: "Solo los estudiantes pueden desasignarse tutores" });
    }

    if (!estudiante.tutorId) {
      return res.status(400).json({ 
        ok: false, 
        message: "No tienes un tutor asignado para desasignar" 
      });
    }

    await prisma.user.update({
      where: { id: estudianteId },
      data: { tutorId: null }
    });

    res.json({ 
      ok: true, 
      message: "Tutor desasignado correctamente" 
    });
  } catch (error) {
    console.error("Error desasignando tutor:", error);
    res.status(500).json({ 
      ok: false, 
      message: "Error interno del servidor"
    });
  }
});

// Obtener mi tutor
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

// Lectura de asignaciones (Admin, Tutor, Estudiante)
router.get("/asignaciones-lectura", authRequired, async (req: any, res) => {
  try {
    const userRole = req.user.role;
    const userPerms = userRole?.permissions;
    const canReadTutorias = userPerms?.tutorias?.read;
    
    const isAllowed = req.user.roleSlug === "ADMIN" || 
                     req.user.roleSlug === "TUTOR" || 
                     req.user.roleSlug === "ESTUDIANTE" || 
                     canReadTutorias;

    if (!isAllowed) {
      return res.status(403).json({ ok: false, message: "No tiene permisos para ver las asignaciones de tutorías" });
    }

    const estudiantes = await prisma.user.findMany({
      where: { 
        role: {
          slug: "ESTUDIANTE"
        },
        activo: true
      },
      include: {
        tutor: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        inscripciones: {
          include: {
            competition: {
              select: {
                id: true,
                nombre: true,
                area: true
              }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    const asignaciones = estudiantes.map(estudiante => ({
      estudiante: {
        id: estudiante.id,
        nombre: estudiante.name,
        email: estudiante.email,
        ciudad: estudiante.ciudad,
        ci: estudiante.documentoIdentidad
      },
      tutor: estudiante.tutor ? {
        id: estudiante.tutor.id,
        nombre: estudiante.tutor.name,
        email: estudiante.tutor.email
      } : null,
      competencias: estudiante.inscripciones.map(i => ({
        id: i.competition.id,
        nombre: i.competition.nombre,
        area: i.competition.area
      })),
      sinTutor: !estudiante.tutor
    }));

    res.json({ 
      ok: true, 
      asignaciones,
      totalEstudiantes: estudiantes.length,
      estudiantesSinTutor: estudiantes.filter(e => !e.tutor).length
    });
    
  } catch (error) {
    console.error("Error fetching asignaciones lectura:", error);
    res.status(500).json({ ok: false, message: "Error interno del servidor" });
  }
});

export default router;