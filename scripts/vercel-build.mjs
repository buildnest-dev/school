// Build step for Vercel: generates the PostgreSQL client, then builds the app.
// `next build` loads every route to read its settings, which creates the database client. With no
// DATABASE_URL set yet it would fall back to the local SQLite file and fail against the PostgreSQL
// client, so a placeholder address is used for the build only. Nothing connects to it; the real
// DATABASE_URL set in Vercel is what the running site uses.
import { execSync } from "node:child_process";

const env = { ...process.env };
if (!/^postgres(ql)?:/.test(env.DATABASE_URL ?? ""))
  env.DATABASE_URL = "postgresql://build:build@localhost:5432/build";
const run = (cmd) => execSync(cmd, { stdio: "inherit", env });

run("node scripts/make-pg-schema.mjs");
run("npx prisma generate --schema prisma/schema.postgres.prisma");
run("npx next build");
