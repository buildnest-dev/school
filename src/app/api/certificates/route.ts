import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { certInclude, CERT_TYPES, certView } from "@/server/certificates";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";

const ROLES = ["school_owner", "principal", "parent"] as const;

/** Principal/owner: every request and certificate (?status=, ?type=, ?studentId=). Parent: their own children's only. */
export const GET = handle(async (req: Request) => {
  const { tenantId, user } = await requireTenant([...ROLES]);
  const q = new URL(req.url).searchParams;
  const status = q.get("status");
  const type = q.get("type");
  const rows = await prisma.certificate.findMany({
    where: {
      tenantId,
      ...(user.role === "parent" ? { student: { guardian: { userId: user.id } } } : {}),
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(q.get("studentId") ? { studentId: q.get("studentId")! } : {}),
    },
    include: certInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  const items = rows.map((c) => certView(c));
  return NextResponse.json({ items, total: items.length, page: 1, pageSize: items.length });
});

const Body = z.object({
  studentId: z.string().min(1),
  type: z.enum(CERT_TYPES),
  purpose: z.string().trim().min(3).max(200).optional(),
});

/**
 * Asks for a certificate. A parent can request a bonafide or character certificate for their own
 * child (with a purpose); a transfer certificate ends enrolment, so only the school can start one.
 * It becomes a certificate only when the principal issues it.
 */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...ROLES]);
  const b = Body.parse(await req.json());
  const parent = user.role === "parent";
  if (parent && b.type === "transfer")
    throw new HttpError(
      403,
      "forbidden",
      "Please ask the school office for a transfer certificate.",
    );
  if (parent && !b.purpose)
    throw new HttpError(422, "purpose", "Say what the certificate is needed for.");

  const student = await prisma.student.findFirst({
    where: {
      id: b.studentId,
      tenantId,
      ...(parent ? { guardian: { userId: user.id } } : {}),
    },
  });
  if (!student) throw new HttpError(404, "not_found", "Student not found.");
  if (b.type !== "character" && student.status !== "active")
    throw new HttpError(409, "not_active", "This certificate is only for current students.");
  const open = await prisma.certificate.findFirst({
    where: { tenantId, studentId: student.id, type: b.type, status: "requested" },
  });
  if (open)
    throw new HttpError(
      409,
      "already_requested",
      "A request for this certificate is already waiting.",
    );
  if (b.type === "transfer") {
    const done = await prisma.certificate.findFirst({
      where: { tenantId, studentId: student.id, type: "transfer", status: "issued" },
    });
    if (done)
      throw new HttpError(409, "already_issued", "A transfer certificate was already issued.");
  }
  const c = await prisma.certificate.create({
    data: {
      tenantId,
      studentId: student.id,
      type: b.type,
      status: "requested",
      purpose: b.purpose ?? null,
      requestedById: user.id,
      requestedByName: user.name,
    },
    include: certInclude,
  });
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: user.id,
      action: "certificate.request",
      entity: "certificate",
      entityId: c.id,
    },
  });
  return NextResponse.json(
    {
      ok: true,
      mode: "api",
      message: "Request sent to the school office.",
      certificate: certView(c),
    },
    { status: 201 },
  );
});
