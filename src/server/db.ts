import { PrismaClient } from "../generated/prisma/client";
import { isPostgres, makeAdapter } from "./adapter";

const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";

const globalForDb = globalThis as unknown as { prisma?: PrismaClient };

/** Shared Prisma client (one per process; reused across hot reloads in development). */
export const prisma: PrismaClient =
  globalForDb.prisma ??
  new PrismaClient({
    adapter: makeAdapter(url),
    // Prisma's default of 5 seconds is too short once the database is across a network.
    transactionOptions: { maxWait: 15_000, timeout: 30_000 },
  });

if (process.env.NODE_ENV !== "production") globalForDb.prisma = prisma;

/**
 * Text search that ignores case. PostgreSQL compares exactly unless told otherwise, while SQLite
 * already ignores case for plain letters, so the extra option is added only for PostgreSQL.
 */
export const like = (text: string): { contains: string } =>
  (isPostgres(url) ? { contains: text, mode: "insensitive" } : { contains: text }) as {
    contains: string;
  };

/**
 * Tenant isolation: every query for school data goes through this helper, which fixes `tenantId`
 * in the `where` clause (or `data` on create) so a handler cannot forget it. Only the models that
 * are owned by a tenant are exposed.
 */
export function tenantDb(tenantId: string) {
  const w = <T extends object>(where?: T) => ({ ...(where ?? {}), tenantId });
  return {
    tenantId,
    students: {
      list: (where: object = {}, opts: { skip?: number; take?: number } = {}) =>
        prisma.student.findMany({
          where: w(where),
          orderBy: { name: "asc" },
          include: { section: { include: { class: true } }, guardian: true },
          ...opts,
        }),
      count: (where: object = {}) => prisma.student.count({ where: w(where) }),
      get: (id: string) =>
        prisma.student.findFirst({
          where: w({ id }),
          include: { section: { include: { class: true } }, guardian: true },
        }),
    },
    classes: {
      list: () =>
        prisma.classLevel.findMany({
          where: w(),
          orderBy: { position: "asc" },
          include: { sections: true, subjects: true },
        }),
    },
    invoices: {
      list: (where: object = {}) =>
        prisma.invoice.findMany({
          where: w(where),
          orderBy: { dueOn: "asc" },
          include: { payments: true, student: true },
        }),
    },
    notices: {
      list: () => prisma.notice.findMany({ where: w(), orderBy: { createdAt: "desc" } }),
    },
  };
}
export type TenantDb = ReturnType<typeof tenantDb>;
