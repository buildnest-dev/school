import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { FEE_ROLES } from "@/server/fees";
import { assertSameOrigin, handle, throttle } from "@/server/http";
import { readProofImage } from "@/server/proofs";

const Body = z.object({
  studentId: z.string().min(1),
  amountRupees: z.number().positive().max(10_000_000),
  reference: z.string().trim().max(60).optional(),
  image: z.string().min(100).max(900_000),
});

const view = (p: {
  id: string;
  studentId: string;
  amountPaise: number;
  reference: string | null;
  status: string;
  reviewNote: string | null;
  createdAt: Date;
  student: { name: string; section: { name: string; class: { name: string } } | null };
}) => ({
  id: p.id,
  studentId: p.studentId,
  studentName: p.student.name,
  classSection: p.student.section
    ? `${p.student.section.class.name} ${p.student.section.name}`
    : "",
  amount: p.amountPaise / 100,
  reference: p.reference,
  status: p.status,
  reviewNote: p.reviewNote,
  submittedAt: p.createdAt.toISOString(),
});

const include = {
  student: { select: { name: true, section: { select: { name: true, class: true } } } },
} as const;
const omitImage = { image: false } as const;

/** POST: a parent sends the screenshot of a payment they made to the school's account. */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant(["parent"]);
  await throttle(`proof|${user.id}`, 10, 10 * 60_000);
  const b = Body.parse(await req.json());
  const image = readProofImage(b.image);
  const student = await prisma.student.findFirst({
    where: { id: b.studentId, tenantId, guardian: { userId: user.id } },
    select: { id: true },
  });
  if (!student) throw new HttpError(404, "not_found", "Student not found.");
  const row = await prisma.paymentProof.create({
    data: {
      tenantId,
      studentId: student.id,
      submittedBy: user.id,
      amountPaise: Math.round(b.amountRupees * 100),
      reference: b.reference || null,
      image: new Uint8Array(image),
    },
    omit: omitImage,
    include,
  });
  return NextResponse.json({ ok: true, proof: view(row) }, { status: 201 });
});

/**
 * GET: staff see the school's proofs (?status=pending by default); a parent sees only their own
 * children's. The screenshot itself is fetched separately.
 */
export const GET = handle(async (req: Request) => {
  const { tenantId, user } = await requireTenant([...FEE_ROLES, "parent"]);
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? (user.role === "parent" ? "" : "pending");
  const studentId = url.searchParams.get("studentId") ?? undefined;
  const rows = await prisma.paymentProof.findMany({
    where: {
      tenantId,
      ...(status ? { status } : {}),
      ...(studentId ? { studentId } : {}),
      ...(user.role === "parent" ? { student: { guardian: { userId: user.id } } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    omit: omitImage,
    include,
  });
  const items = rows.map(view);
  return NextResponse.json({ items, total: items.length, page: 1, pageSize: items.length });
});
