import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { webLink } from "@/server/classwork";
import { prisma } from "@/server/db";
import { dayStr } from "@/server/homework";
import { assertSameOrigin, handle, throttle } from "@/server/http";
import { childFor } from "@/server/portal";
import { notifyUsers } from "@/server/push";

type Ctx = { params: Promise<{ id: string }> };

/** The class's published homework with this child's answer and the teacher's feedback. */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { tenantId, user } = await requireTenant(["parent", "student"]);
  const child = await childFor(tenantId, user, (await ctx.params).id);
  if (!child.sectionId) return NextResponse.json([]);
  const [rows, mine] = await Promise.all([
    prisma.homework.findMany({
      where: { tenantId, sectionId: child.sectionId, status: "published" },
      include: { subject: { select: { name: true } } },
      orderBy: [{ dueOn: "desc" }, { createdAt: "desc" }],
      take: 50,
    }),
    prisma.homeworkSubmission.findMany({ where: { tenantId, studentId: child.id } }),
  ]);
  const by = new Map(mine.map((s) => [s.homeworkId, s]));
  return NextResponse.json(
    rows.map((h) => {
      const s = by.get(h.id);
      return {
        id: h.id,
        title: h.title,
        subject: h.subject.name,
        description: h.description,
        due: dayStr(h.dueOn),
        text: s?.text ?? "",
        link: s?.link ?? "",
        submittedOn: s ? dayStr(s.submittedAt) : "",
        grade: s?.grade ?? "",
        feedback: s?.feedback ?? "",
        checked: !!s?.checkedAt,
      };
    }),
  );
});

const Body = z
  .object({
    homeworkId: z.string().min(1),
    text: z.string().trim().max(4000).default(""),
    link: webLink,
  })
  .refine((b) => b.text || b.link, { message: "Write an answer or add a link.", path: ["text"] });

/** Sends or replaces the answer, until the teacher has checked it. */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant(["parent", "student"]);
  const child = await childFor(tenantId, user, (await ctx.params).id);
  await throttle(`submit|${user.id}`, 30, 10 * 60_000);
  const b = Body.parse(await req.json());
  const hw = await prisma.homework.findFirst({
    where: {
      id: b.homeworkId,
      tenantId,
      sectionId: child.sectionId ?? "none",
      status: "published",
    },
  });
  if (!hw) throw new HttpError(404, "not_found", "Homework not found.");
  const key = { homeworkId_studentId: { homeworkId: hw.id, studentId: child.id } };
  const old = await prisma.homeworkSubmission.findUnique({ where: key });
  if (old?.checkedAt)
    throw new HttpError(409, "checked", "The teacher has already checked this answer.");
  await prisma.homeworkSubmission.upsert({
    where: key,
    create: { tenantId, homeworkId: hw.id, studentId: child.id, text: b.text, link: b.link },
    update: { text: b.text, link: b.link, submittedAt: new Date() },
  });
  await notifyUsers(tenantId, [hw.createdById], {
    title: "Homework received",
    body: `${child.name}: ${hw.title}`.slice(0, 140),
    url: "/teacher/submissions",
  });
  return NextResponse.json({ ok: true, message: "Sent to the teacher." });
});
