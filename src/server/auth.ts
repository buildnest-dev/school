import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import type { Role, SessionUser } from "@/types";
import { isWrite } from "./context";
import { prisma } from "./db";
import { classifyHost, hostAllows, type HostInfo } from "./hosts";
import { decryptSecret } from "./secret";
import { approvalsMandatory, approvalsOn, platformStep, type StepResult } from "./approvals";
import { effectiveSubscription, isReadOnly } from "./subscription";
import { verifyCode } from "./totp";

const COOKIE = "sid";
const TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export interface Auth {
  user: SessionUser;
  sessionId: string;
  tenant?: { status: string; subscription: string };
  /** A platform user who has not turned on the authenticator app yet: they may only set it up. */
  mfaSetupRequired?: boolean;
}

/** The ZAQSA address this request came to. */
export async function currentHost(): Promise<HostInfo> {
  const h = await headers();
  return classifyHost(h.get("x-forwarded-host") ?? h.get("host"));
}

/** Constant-ish time: compare against a dummy hash when the user is unknown so timing does not reveal accounts. */
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

export async function login(
  email: string,
  password: string,
  tenantSlug?: string,
  code?: string,
  remember = false,
): Promise<true | null | "mfa_required" | "mfa_invalid" | Exclude<StepResult, "ok">> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: { memberships: { include: { tenant: true } } },
  });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok || !user.active) return null;
  const host = await currentHost();
  // The wrong address looks exactly like a wrong password, so it reveals nothing about accounts.
  if (user.isPlatformAdmin && !hostAllows(host, { platform: true })) return null;
  // ZAQSA team members also need an admin at admin.zaqsa.com to approve each sign-in.
  if (user.isPlatformAdmin && !approvalsOn() && approvalsMandatory()) return null;
  if (user.isPlatformAdmin && approvalsOn()) {
    const step = await platformStep(user, code, remember);
    if (step !== "ok") return step;
  }

  // Second step for people who turned on an authenticator app. A code works only once.
  if (!(user.isPlatformAdmin && approvalsOn()) && user.totpEnabled && user.totpCipher) {
    if (!code) return "mfa_required";
    const step = verifyCode(decryptSecret(user.totpCipher), code);
    if (step === null || step <= user.totpLastStep) return "mfa_invalid";
    await prisma.user.update({ where: { id: user.id }, data: { totpLastStep: step } });
  }

  let tenantId: string | null = null;
  if (!user.isPlatformAdmin) {
    const onTenantHost = host.kind === "school" || host.kind === "parents";
    const wantSlug = onTenantHost ? host.slug : tenantSlug;
    const m =
      (wantSlug ? user.memberships.find((x) => x.tenant.slug === wantSlug) : undefined) ??
      (onTenantHost ? undefined : user.memberships[0]);
    if (!m) return null;
    if (!hostAllows(host, { platform: false, role: m.role, slug: m.tenant.slug })) return null;
    const family = m.role === "parent" || m.role === "student";
    // Suspended: staff are locked out, families can still read their records.
    if (m.tenant.status === "suspended" && !family) return null;
    // Provisioned: the school is still being set up, so families cannot sign in yet.
    if (m.tenant.status === "provisioned" && family) return null;
    tenantId = m.tenantId;
  }

  await startSession(user.id, tenantId);
  return true;
}

/** Creates the server-side session and sets the host-only cookie. */
export async function startSession(userId: string, tenantId: string | null) {
  const token = randomBytes(32).toString("base64url");
  await prisma.session.create({
    data: {
      tokenHash: sha256(token),
      userId,
      tenantId,
      expiresAt: new Date(Date.now() + TTL_MS),
    },
  });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(COOKIE);
}

/** Resolves the signed-in user from the cookie. The tenant always comes from the server-side session. */
export async function getAuth(): Promise<Auth | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const s = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });
  if (!s || s.expiresAt < new Date() || !s.user.active) return null;
  const host = await currentHost();

  if (s.user.isPlatformAdmin) {
    if (!hostAllows(host, { platform: true })) return null;
    return {
      sessionId: s.id,
      user: {
        id: s.user.id,
        name: s.user.name,
        role: "platform_admin",
        tenantId: null,
        tenantName: null,
        title: "Platform administrator",
      },
    };
  }
  if (!s.tenantId) return null;
  const m = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId: s.userId, tenantId: s.tenantId } },
    include: { tenant: true },
  });
  if (!m) return null;
  const role = m.role as Role;
  if (!hostAllows(host, { platform: false, role, slug: m.tenant.slug })) return null;
  // A suspended school's staff are signed out at once; families can still read their records.
  if (m.tenant.status === "suspended" && role !== "parent" && role !== "student") return null;
  return {
    sessionId: s.id,
    tenant: {
      status: m.tenant.status,
      subscription: effectiveSubscription(m.tenant),
    },
    user: {
      id: s.user.id,
      name: s.user.name,
      role,
      tenantId: m.tenantId,
      tenantName: m.tenant.name,
      title: role.replace(/_/g, " "),
    },
  };
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Use at the top of every route: 401 when signed out, 403 when the role is not allowed. */
export async function requireAuth(roles?: Role[], opts?: { mfaExempt?: boolean }) {
  const a = await getAuth();
  if (!a) throw new HttpError(401, "unauthenticated", "Please sign in.");
  if (a.mfaSetupRequired && !opts?.mfaExempt)
    throw new HttpError(
      403,
      "mfa_setup_required",
      "Turn on the authenticator app to continue. Platform accounts must use it.",
    );
  if (roles && !roles.includes(a.user.role))
    throw new HttpError(403, "forbidden", "You do not have access to this.");
  return a;
}

/** Same as requireAuth but also guarantees a tenant (school) context. */
export async function requireTenant(roles?: Role[]) {
  const a = await requireAuth(roles);
  if (!a.user.tenantId)
    throw new HttpError(403, "forbidden", "This action needs a school account.");
  // Changes are blocked while a school is suspended or its subscription has lapsed; reading stays open.
  if (isWrite() && a.tenant) {
    if (a.tenant.status === "suspended")
      throw new HttpError(403, "school_suspended", "This school's account is suspended.");
    const family = a.user.role === "parent" || a.user.role === "student";
    // Families keep working (for example paying fees) even when the school's own plan has lapsed.
    if (!family && isReadOnly(a.tenant.subscription as Parameters<typeof isReadOnly>[0]))
      throw new HttpError(
        403,
        "read_only",
        "This school's subscription has lapsed. Records can be viewed and exported, but not changed.",
      );
  }
  return { ...a, tenantId: a.user.tenantId };
}
