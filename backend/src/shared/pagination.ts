import { z } from "zod";

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid identifier.");

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const pageMeta = (total: number, page: number, limit: number) => ({
  total,
  page,
  limit,
  pages: Math.max(1, Math.ceil(total / limit)),
});
