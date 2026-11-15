import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { ADMIN, STAFF_ROLES, dayOf, dayStr, isoDay, listOf } from "@/server/extras";
import { assertSameOrigin, handle } from "@/server/http";

/** The principal sees every request; anyone else sees their own. */
export const GET = handle(async (req: Request) => {
  const { tenantId, user } = await requireTenant([...STAFF_ROLES]);
  const status = new URL(req.url).searchParams.get("filter[status]");
  const all = (ADMIN as readonly string[]).includes(user.role);
  const rows = await prisma.leaveRequest.findMany({
    where: { tenantId, ...(all ? {} : { userId: user.id }), ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(
    listOf(
      rows.map((l) => ({
        id: l.id,
        staffName: l.staffName,
        from: dayStr(l.fromDate),
        to: dayStr(l.toDate),
        type: l.type,
        status: l.status,
      })),
    ),
  );
});

const Body = z.object({
  from: isoDay,
  to: isoDay,
  type: z.string().trim().min(2).max(40),
  reason: z.string().trim().max(500).default(""),
});

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...STAFF_ROLES]);
  const b = Body.parse(await req.json());
  if (b.to < b.from)
    throw new HttpError(422, "bad_dates", "The last day cannot be before the first day.");
  const l = await prisma.leaveRequest.create({
    data: {
      tenantId,
      userId: user.id,
      staffName: user.name,
      fromDate: dayOf(b.from),
      toDate: dayOf(b.to),
      type: b.type,
      reason: b.reason || null,
    },
  });
  return NextResponse.json(
    { ok: true, mode: "api", id: l.id, message: "Leave request sent." },
    { status: 201 },
  );
});
