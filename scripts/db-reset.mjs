// Recreates the local development SQLite database from prisma/schema.prisma and seeds it.
// Development only: deletes prisma/dev.db. Never point this at a real database.
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

// Always the local SQLite file, even when .env.local points at a Neon database.
const env = {
  ...process.env,
  DATABASE_URL: "file:./prisma/dev.db",
  DIRECT_URL: "",
  DATABASE_URL_UNPOOLED: "",
  NEON_BRANCH: "",
};

rmSync("prisma/dev.db", { force: true });
rmSync("prisma/dev.db-journal", { force: true });
execSync("npx prisma db push", { stdio: "inherit", env });
execSync("npx prisma db seed", { stdio: "inherit", env });
