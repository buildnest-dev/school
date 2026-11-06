import { NextResponse } from "next/server";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { adminRow, EnquiryBody, STAGES } from "@/server/admissions";
import { assertSameOrigin, handle } from "@/server/http";

const ROLES = ["school_owner", "principal", "vice_principal", "admission_officer"] as const;

export const GET = handle(async (req: Request) => {
  const { tenantId } = await requireTenant([...ROLES]);
  const sp = new URL(req.url).searchParams;
  const page = Math.max(1, Number(sp.get("page") ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(sp.get("pageSize") ?? 10) || 10));
  const q = sp.get("q")?.trim();
  const stage = sp.get("filter[stage]");
  const where = {
    tenantId,
    ...(stage && (STAGES as readonly string[]).includes(stage) ? { stage } : {}),
    ...(q ? { OR: [{ studentName: { contains: q } }, { guardianName: { contains: q } }] } : {}),
  };
  const [rows, total, classes] = await Promise.all([
    prisma.admission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.admission.count({ where }),
    prisma.classLevel.findMany({ where: { tenantId }, select: { id: true, name: true } }),
  ]);
  const names = new Map(classes.map((c) => [c.id, c.name]));
  return NextResponse.json({
    items: rows.map((r) => adminRow(r, names.get(r.applyingForId ?? "") ?? "")),
    total,
    page,
    pageSize,
  });
});

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...ROLES]);
  const b = EnquiryBody.parse(await req.json());
  if (b.applyingForId) {
    const c = await prisma.classLevel.findFirst({ where: { id: b.applyingForId, tenantId } });
    if (!c) throw new HttpError(422, "bad_class", "Unknown class.");
  }
  const a = await prisma.admission.create({
    data: { ...b, dob: b.dob ? new Date(b.dob) : null, tenantId },
  });
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: user.id,
      action: "admission.create",
      entity: "admission",
      entityId: a.id,
    },
  });
  return NextResponse.json(
    { ok: true, mode: "api", id: a.id, message: "Enquiry added." },
    { status: 201 },
  );
});
