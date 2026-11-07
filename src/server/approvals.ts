import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { prisma } from "./db";
import { firestoreStore, firestoreConfigured } from "./approval-store";

/**
 * Second step for ZAQSA team members. After the right email and password the person cannot sign in
 * until an admin at admin.zaqsa.com approves the request. The requests live in the shared Firestore
 * collection `login_requests` (the admin site reads and decides them). Approving gives the admin a
 * six-digit code to read out; the person types it here. Each code works once.
 *
 * Switched on by FIREBASE_SERVICE_ACCOUNT (the same service account JSON the admin site uses);
 * without it (local development and tests) team members sign in with the password alone.
 */
const MAX_ATTEMPTS = 5;
/** After a request is rejected (or its code is guessed wrong five times) the person must wait. */
const COOLDOWN_MS = 5 * 60_000;
const DEVICE_COOKIE = "zdev";
const DEVICE_TTL_MS = 30 * 24 * 3600_000;

export interface ApprovalRequest {
  id: string;
  status: string;
  codeHash?: string;
  expiresAt?: Date;
  attempts: number;
  createdAt: Date;
  decidedAt?: Date;
}

/** Where requests are kept. Firestore in production; tests give it an in-memory one. */
export interface ApprovalStore {
  create(r: {
    email: string;
    name: string;
    device: string;
    ip: string;
    remember: boolean;
  }): Promise<string>;
  /** This person's most recent requests, newest first. */
  recent(email: string): Promise<ApprovalRequest[]>;
  /** Closes older waiting or approved requests when the person starts again. */
  supersede(email: string): Promise<void>;
  /** A wrong code: counts it, and locks the request at the limit. */
  failAttempt(id: string, max: number): Promise<void>;
  /** Marks an approved, unexpired request used. True only for the one caller that wins. */
  consume(id: string): Promise<boolean>;
}

let store: ApprovalStore | null = null;
export const setApprovalStore = (s: ApprovalStore | null) => void (store = s);
const getStore = () => store ?? firestoreStore();

export const approvalsOn = () => store !== null || firestoreConfigured();

export const hashCode = (id: string, code: string) =>
  createHash("sha256").update(`${id}:${code}`).digest("hex");

/** Minutes this person must still wait after a rejected or locked request; 0 when they may ask. */
export function cooldownMinutes(recent: ApprovalRequest[], now = Date.now()) {
  const last = recent
    .filter((r) => ["denied", "rejected", "locked"].includes(r.status) && r.decidedAt)
    .sort((a, b) => b.decidedAt!.getTime() - a.decidedAt!.getTime())[0];
  if (!last?.decidedAt) return 0;
  const left = last.decidedAt.getTime() + COOLDOWN_MS - now;
  return left > 0 ? Math.ceil(left / 60_000) : 0;
}

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

async function deviceTrusted(userId: string) {
  const token = (await cookies()).get(DEVICE_COOKIE)?.value;
  if (!token) return false;
  const d = await prisma.trustedDevice.findUnique({ where: { tokenHash: hashToken(token) } });
  return !!d && d.userId === userId && d.expiresAt > new Date();
}

async function rememberDevice(userId: string) {
  const token = randomBytes(32).toString("base64url");
  await prisma.trustedDevice.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      userAgent: (await headers()).get("user-agent")?.slice(0, 200) ?? null,
      expiresAt: new Date(Date.now() + DEVICE_TTL_MS),
    },
  });
  (await cookies()).set(DEVICE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DEVICE_TTL_MS / 1000,
  });
}

export type StepResult = "ok" | "approval_invalid" | "approval_required" | `approval_cooldown:${number}`;

/**
 * The approval step of a team sign-in, after the password was right. A remembered browser skips it.
 * Otherwise the first try files a request for an admin, and the next try carries the admin's code.
 */
export async function platformStep(
  user: { id: string; email: string; name: string },
  code: string | undefined,
  remember: boolean,
): Promise<StepResult> {
  if (await deviceTrusted(user.id)) return "ok";
  const s = getStore();
  const recent = await s.recent(user.email);
  const wait = cooldownMinutes(recent);
  if (wait > 0) return `approval_cooldown:${wait}`;

  if (!code) {
    const h = await headers();
    await s.supersede(user.email);
    await s.create({
      email: user.email,
      name: user.name,
      device: (h.get("user-agent") ?? "unknown").slice(0, 200),
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
      remember,
    });
    return "approval_required";
  }

  const open = recent.find(
    (r) => r.status === "approved" && r.codeHash && r.expiresAt && r.expiresAt > new Date(),
  );
  if (!open) return "approval_invalid";
  if (hashCode(open.id, code.trim()) !== open.codeHash) {
    await s.failAttempt(open.id, MAX_ATTEMPTS);
    return "approval_invalid";
  }
  if (!(await s.consume(open.id))) return "approval_invalid";
  if (remember) await rememberDevice(user.id);
  return "ok";
}
