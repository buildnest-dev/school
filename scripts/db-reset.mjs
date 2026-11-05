// Recreates the local development SQLite database from prisma/schema.prisma and seeds it.
// Development only: deletes prisma/dev.db. Never point this at a real database.
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

rmSync("prisma/dev.db", { force: true });
rmSync("prisma/dev.db-journal", { force: true });
execSync("npx prisma db push", { stdio: "inherit" });
execSync("npx prisma db seed", { stdio: "inherit" });
