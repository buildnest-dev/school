import { createRequire } from "node:module";
import { PrismaPg } from "@prisma/adapter-pg";

/** True for a PostgreSQL connection string (production); anything else is the dev SQLite file. */
export const isPostgres = (url: string) => /^postgres(ql)?:/.test(url);

/**
 * Picks the database driver from DATABASE_URL. PostgreSQL is imported normally so it is bundled for
 * Vercel; the SQLite driver (a native module used for development and tests only) is loaded on
 * demand so a deployment never has to load it.
 */
export function makeAdapter(url: string) {
  if (isPostgres(url)) return new PrismaPg({ connectionString: url });
  const load = createRequire(import.meta.url);
  const { PrismaBetterSqlite3 } = load(
    "@prisma/adapter-better-sqlite3",
  ) as typeof import("@prisma/adapter-better-sqlite3");
  return new PrismaBetterSqlite3({ url });
}
