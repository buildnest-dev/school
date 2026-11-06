/**
 * One-time setup for a real (production) database. Unlike seed.ts it holds no demo school and no
 * demo logins: it loads the reference data and the product catalog, and creates the first ZAQSA
 * super admin. The password is generated here and written to a local file, never printed.
 *
 *   ADMIN_EMAIL=you@example.com ADMIN_NAME="Your Name" npx tsx prisma/production-setup.ts
 *
 * Run it with DATABASE_URL pointing at the production database (a postgres:// address). It does
 * nothing destructive and can be run again: an existing admin keeps their password.
 */
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import { makeAdapter, isPostgres } from "../src/server/adapter";
import { PrismaClient } from "../src/generated/prisma/client";
import { productCatalog, reference } from "./reference";

const url = process.env.DATABASE_URL ?? "";
if (!isPostgres(url)) throw new Error("DATABASE_URL must be the production PostgreSQL address.");
const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
const name = (process.env.ADMIN_NAME ?? "").trim();
if (!email || !name) throw new Error("Set ADMIN_EMAIL and ADMIN_NAME.");

const prisma = new PrismaClient({ adapter: makeAdapter(url) });

async function main() {
  await reference(prisma);
  await productCatalog(prisma);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({ where: { email }, data: { isPlatformAdmin: true } });
    console.log("Reference data loaded. The admin already existed; their password is unchanged.");
    return;
  }
  const password = randomBytes(12).toString("base64url") + "#9a";
  await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: await bcrypt.hash(password, 10),
      isPlatformAdmin: true,
    },
  });
  mkdirSync(".secrets", { recursive: true });
  writeFileSync(
    ".secrets/admin-credentials.txt",
    `Sign in at /sign-in\nEmail: ${email}\nPassword: ${password}\nChange this password after your first sign-in.\n`,
  );
  console.log(
    "Reference data loaded and the admin created. Credentials: .secrets/admin-credentials.txt",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
