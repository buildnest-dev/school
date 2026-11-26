import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { CLASS_STAFF, studentsFor } from "@/server/classwork";
import { prisma } from "@/server/db";
import { dayOf, dayStr, isoDay } from "@/server/extras";
import { assertSameOrigin, handle } from "@/server/http";

/** Achievements of the students this person may see, and the list of those students. */
export const GET = handle(async () => {
  const { tenantId, user } = await requireTenant([...CLASS_STAFF]);
  const students = await studentsFor(tenantId, user);
  const rows = await prisma.achievement.findMany({
    where: { tenantId, studentId: { in: students.map((s) => s.id) } },
    orderBy: { awardedOn: "desc" },
    take: 300,
  });
  const name = new Map(students.map((s) => [s.id, `${s.name} · ${s.classLabel}`]));
  return NextResponse.json({
    students: students.map((s) => ({ id: s.id, name: s.name, classLabel: s.classLabel })),
    items: rows.map((a) => ({
      id: a.id,
      student: name.get(a.studentId) ?? "Student",
      title: a.title,
      category: a.category,
      awardedOn: dayStr(a.awardedOn),
      note: a.note,
    })),
  });
});

const Body = z.object({
  studentId: z.string().min(1),
  title: z.string().trim().min(3).max(120),
  category: z.enum(["academic", "sports", "arts", "service", "other"]),
  awardedOn: isoDay,
  note: z.string().trim().max(500).default(""),
});

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...CLASS_STAFF]);
  const b = Body.parse(await req.json());
  if (!(await studentsFor(tenantId, user)).some((s) => s.id === b.studentId))
    throw new HttpError(404, "not_found", "Student not found.");
  await prisma.achievement.create({
    data: { tenantId, ...b, awardedOn: dayOf(b.awardedOn), createdById: user.id },
  });
  return NextResponse.json({ ok: true, mode: "api", message: "Added." }, { status: 201 });
});
