import { Router } from "express";
import { prisma } from "../lib/prisma";
import { z } from "zod";
import { Estado, Nivel, Role, Area, Prisma } from "@prisma/client";
import { authRequired } from "../middleware/auth";
import { requireRoles } from "../middleware/rbac";

const router = Router();

/** GET /api/competitions  */
router.get("/", async (req, res) => {
  const q        = (req.query.q as string) || "";
  const estado   = (req.query.estado as keyof typeof Estado) || "";
  const nivel    = (req.query.nivel as keyof typeof Nivel) || "";
  const area     = (req.query.area as keyof typeof Area) || "";
  const page     = Math.max(1, parseInt((req.query.page as string) || "1"));
  const pageSize = Math.min(100, Math.max(1, parseInt((req.query.pageSize as string) || "20")));
  const skip     = (page - 1) * pageSize;

  const where: any = {};
  if (q) {
    where.OR = [
      { nombre: { contains: q, mode: "insensitive" } },
    ];
  }
  if (estado) where.estado = estado;
  if (nivel)  where.nivel  = nivel;
  if (area)   where.area   = area;

  const [items, total] = await Promise.all([
    prisma.competition.findMany({
      where,
      orderBy: { fechaInicio: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.competition.count({ where }),
  ]);

  res.json({ items, total, page, pageSize });
});

const NAME_RE = /^[A-Za-zÁÉÍÓÚÜáéíóúüÑñ\s]{1,45}$/;

const BodySchema = z.object({
  nombre: z.string().max(45).regex(NAME_RE, "Solo letras y espacios (máx 45)"),
  nivel: z.nativeEnum(Nivel),
  estado: z.nativeEnum(Estado),
  area: z.nativeEnum(Area),
  participantes: z.number().int().min(1).max(4),
  fechaInicio: z.coerce.date(),
});

/** GET /api/competitions/:id */
router.get("/:id", async (req, res) => {
  try {
    const item = await prisma.competition.findUnique({
      where: { id: req.params.id },
    });
    if (!item) return res.status(404).json({ ok:false, message:"No encontrada" });
    res.json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok:false, message:"Error al obtener la competencia" });
  }
});


/** POST crear */
router.post(
  "/",
  authRequired,
  requireRoles(Role.ADMIN, Role.RESPONSABLEACADEMICO),
  async (req, res) => {
    const parsed = BodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok:false, message:"Datos inválidos" });

    const dto = parsed.data;

    const created = await prisma.competition.create({ 
      data: {
        nombre: dto.nombre,
        nivel: dto.nivel,
        estado: dto.estado,
        area: dto.area,
        participantes: dto.participantes,
        fechaInicio: dto.fechaInicio,
      } satisfies Prisma.CompetitionCreateInput,
     });
    res.status(201).json({ ok:true, competition: created });
  }
);

/** PUT editar */
router.put(
  "/:id",
  authRequired,
  requireRoles(Role.ADMIN, Role.RESPONSABLEACADEMICO),
  async (req, res) => {
    const parsed = BodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok:false, message:"Datos inválidos" });

    try {
      const dto = parsed.data;
      const updated = await prisma.competition.update({
        where: { id: req.params.id },
        data: {
          nombre: dto.nombre,
          nivel: dto.nivel,
          estado: dto.estado,
          area: dto.area,
          participantes: dto.participantes,
          fechaInicio: dto.fechaInicio,
        }satisfies Prisma.CompetitionUpdateInput,
      });
      res.json({ ok:true, competition: updated });
    } catch {
      res.status(404).json({ ok:false, message:"No encontrada" });
    }
  }
);

/** DELETE /api/competitions/:id */
router.delete(
  "/:id",
  authRequired,
  requireRoles(Role.ADMIN, Role.RESPONSABLEACADEMICO),
  async (req, res) => {
    try {
      await prisma.competition.delete({ where: { id: req.params.id } });
      res.json({ ok:true });
    } catch {
      res.status(404).json({ ok:false, message:"No encontrada" });
    }
  }
);


export default router;