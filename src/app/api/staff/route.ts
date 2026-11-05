import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import {
  assertStaffContactFree,
  nextEmployeeNo,
  STAFF_ROLES,
  staffFields,
  staffView,
} from "@/server/staff";

const MANAGE = ["school_owner", "principal"] as const;

/** Staff directory of this school. Optional filters: ?role=teacher&status=active. */
export const GET = handle(async (req: Request) => {
  const { tenantId } = await requireTenant([...MANAGE]);
  const q = new URL(req.url).searchParams;
  const role = q.get("role");
  const status = q.get("status");
  const rows = await prisma.staff.findMany({
    where: {
      tenantId,
      ...(role && (STAFF_ROLES as readonly string[]).includes(role) ? { role } : {}),
      ...(status === "active" || status === "inactive" ? { status } : {}),
    },
    orderBy: { name: "asc" },
  });
  const items = rows.map(staffView);
  return NextResponse.json({ items, total: items.length, page: 1, pageSize: items.length });
});

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...MANAGE]);
  const b = staffFields.parse(await req.json());
  await assertStaffContactFree(tenantId, b);
  // The employee number is derived from the last one; the unique index rejects a race, so retry.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const s = await prisma.staff.create({
        data: {
          tenantId,
          employeeNo: await nextEmployeeNo(tenantId),
          name: b.name,
          role: b.role,
          designation: b.designation,
          department: b.department,
          qualification: b.qualification,
          phone: b.phone,
          email: b.email,
          joinedOn: b.joinedOn ? new Date(`${b.joinedOn}T00:00:00.000Z`) : null,
        },
      });
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId: user.id,
          action: "staff.create",
          entity: "staff",
          entityId: s.id,
        },
      });
      return NextResponse.json(
        { ok: true, mode: "api", message: "Staff member added.", staff: staffView(s) },
        { status: 201 },
      );
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002" || attempt === 2) throw e;
    }
  }
  throw new Error("unreachable");
});
