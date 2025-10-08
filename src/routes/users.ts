import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authRequired } from "../middleware/auth";
import { Role } from "@prisma/client";

const router = Router();

/** GET /api/users (solo ADMIN) */
router.get("/", authRequired, async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    take: 200,
  });
  res.json(users);
});

export default router;
