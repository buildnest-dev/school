import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { handle } from "@/server/http";

/** Amounts are stored in paise; the API returns rupees (the shape the frontend already uses). */
export const GET = handle(async (req: Request) => {
  const { tenantId } = await requireTenant(["school_owner", "principal", "accountant"]);
  const sp = new URL(req.url).searchParams;
  const page = Math.max(1, Number(sp.get("page") ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(sp.get("pageSize") ?? 10) || 10));
  const q = sp.get("q")?.trim();
  const where = {
    tenantId,
    ...(q ? { OR: [{ number: { contains: q } }, { student: { name: { contains: q } } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { dueOn: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { payments: true, student: { include: { section: { include: { class: true } } } } },
    }),
    prisma.invoice.count({ where }),
  ]);
  const now = new Date();
  const items = rows.map((i) => {
    const paid = i.payments.reduce((s, p) => s + p.amountPaise, 0);
    const status =
      paid >= i.amountPaise ? "paid" : i.dueOn < now ? "overdue" : paid > 0 ? "partial" : "pending";
    return {
      id: i.id,
      number: i.number,
      studentName: i.student.name,
      classSection: i.student.section
        ? `${i.student.section.class.name} ${i.student.section.name}`
        : "",
      term: i.title,
      amount: i.amountPaise / 100,
      paid: paid / 100,
      due: i.dueOn.toISOString().slice(0, 10),
      status,
    };
  });
  return NextResponse.json({ items, total, page, pageSize });
});
