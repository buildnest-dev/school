import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client";

const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";

const globalForDb = globalThis as unknown as { prisma?: PrismaClient };

/** Shared Prisma client (one per process; reused across hot reloads in development). */
export const prisma: PrismaClient =
  globalForDb.prisma ?? new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

if (process.env.NODE_ENV !== "production") globalForDb.prisma = prisma;

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
          include: { sections: true },
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
