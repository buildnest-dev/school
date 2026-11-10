import { classifyHost } from "./hosts";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { HttpError } from "./auth";
import { prisma } from "./db";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** At least 10 characters with a letter and a digit; 72 is bcrypt's limit. */
export const strongPassword = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(72, "Use at most 72 characters")
  .regex(/[A-Za-z]/, "Include a letter")
  .regex(/\d/, "Include a digit");

/** The Brevo transactional e-mail request for a message, or null when no key/sender is set. */
export function brevoRequest(
  m: { to: string; subject: string; body: string },
  env: { BREVO_API_KEY?: string; MAIL_FROM?: string; MAIL_FROM_NAME?: string },
) {
  if (!env.BREVO_API_KEY || !env.MAIL_FROM) return null;
  return {
    url: "https://api.brevo.com/v3/smtp/email",
    init: {
      method: "POST",
      headers: { "api-key": env.BREVO_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: env.MAIL_FROM_NAME ?? "ZAQSA", email: env.MAIL_FROM },
        to: [{ email: m.to }],
        subject: m.subject,
        textContent: m.body,
      }),
    },
  };
}

/**
 * Sends an e-mail. Every message is first stored in the Outbox (the record of what was sent). When
 * BREVO_API_KEY and MAIL_FROM are set it is also sent through Brevo and marked sent or failed; a
 * delivery failure never breaks the request that triggered it. Without them it stays "stored".
 */
export async function sendMail(m: {
  tenantId?: string;
  to: string;
  subject: string;
  body: string;
}) {
  const row = await prisma.outbox.create({
    data: { tenantId: m.tenantId, toEmail: m.to, subject: m.subject, body: m.body },
  });
  const { BREVO_API_KEY, MAIL_FROM, MAIL_FROM_NAME } = process.env;
  const req = brevoRequest(m, { BREVO_API_KEY, MAIL_FROM, MAIL_FROM_NAME });
  if (!req) return;
  try {
    const res = await fetch(req.url, { ...req.init, signal: AbortSignal.timeout(10_000) });
    let why = "";
    if (!res.ok) {
      // Brevo says what is wrong (unverified sender, blocked address, bad key); keep that.
      const j = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
      why = [j.code, j.message].filter(Boolean).join(": ");
    }
    await prisma.outbox.update({
      where: { id: row.id },
      data: res.ok
        ? { status: "sent", sentAt: new Date(), body: "(sent; text not kept)" }
        : {
            status: "failed",
            error: `Brevo answered ${res.status}${why ? ` (${why})` : ""}`.slice(0, 300),
          },
    });
  } catch (e) {
    await prisma.outbox.update({
      where: { id: row.id },
      data: {
        status: "failed",
        error: e instanceof Error ? e.message.slice(0, 200) : "send failed",
      },
    });
  }
}

/** Creates a one-time token and returns the plain value (only ever sent by e-mail). */
export async function createToken(userId: string, purpose: "reset" | "invite", hours: number) {
  const token = randomBytes(32).toString("base64url");
  await prisma.passwordToken.create({
    data: {
      userId,
      purpose,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + hours * 3600_000),
    },
  });
  return token;
}

export const hashToken = sha256;

export const loginRoles = [
  "teacher",
  "accountant",
  "librarian",
  "transport",
  "vice_principal",
  "admission_officer",
  "hr",
  "reception",
  "school_owner",
  "parent",
  "student",
] as const;
export type LoginRole = (typeof loginRoles)[number];

/**
 * Gives a person a login for one school with the given role. A new e-mail gets a user with an
 * unusable password and an invite e-mail (they choose their own password); an e-mail that already
 * has a user (for example a parent with a child in another school) just gains this membership.
 * The response is the same either way, so it cannot be used to find out who has an account.
 */
export async function createLogin(
  tenantId: string,
  schoolName: string,
  p: { email: string; name: string; role: LoginRole; origin: string },
) {
  const email = p.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({
    where: { email },
    include: { memberships: { where: { tenantId } } },
  });
  if (existing?.memberships.length)
    throw new HttpError(409, "has_login", "This e-mail already has a login at this school.");

  let user = existing;
  let invited = false;
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name: p.name,
        passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), 10),
      },
      include: { memberships: { where: { tenantId } } },
    });
    invited = true;
  }
  await prisma.membership.create({ data: { userId: user.id, tenantId, role: p.role } });

  if (invited) {
    const token = await createToken(user.id, "invite", 48);
    await sendMail({
      tenantId,
      to: email,
      subject: `Your ${schoolName} account`,
      body: `Hello ${p.name},\n\nAn account was created for you at ${schoolName}. Set your password here (valid for 48 hours):\n${p.origin}/reset-password?token=${token}\n`,
    });
  }
  return { userId: user.id };
}

/**
 * The address a link in an e-mail should point to. In production it must be one of our own
 * addresses (never a Host header an attacker chose); anywhere else the request's own address is used.
 */
export const originOf = (req: Request) => {
  const u = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? u.host;
  if (process.env.NODE_ENV === "production" && classifyHost(host).kind === "other") {
    const fallback = process.env.APP_ORIGIN;
    if (fallback) return fallback.replace(/\/$/, "");
    return `https://school.${process.env.ZAQSA_BASE_DOMAIN ?? "zaqsa.com"}`;
  }
  return `${u.protocol}//${host.split(",")[0]!.trim()}`;
};
