import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { staffOf } from "@/server/portal";

/** The (class, subject) pairs this teacher teaches, each with the coverage they last reported. */
async function pairsFor(tenantId: string, staffId: string) {
  const periods = await prisma.period.findMany({
    where: { tenantId, staffId },
    include: { subject: true, section: { include: { class: true } } },
  });
  const seen = new Map<string, { sectionId: string; subjectId: string; classLabel: string; subject: string }>();
  for (const p of periods) {
    const k = `${p.sectionId}|${p.subjectId}`;
    if (!seen.has(k))
      seen.set(k, {
        sectionId: p.sectionId,
        subjectId: p.subjectId,
        classLabel: `${p.section.class.name} ${p.section.name}`,
        subject: p.subject.name,
      });
  }
  return [...seen.values()].sort((a, b) =>
    `${a.classLabel} ${a.subject}`.localeCompare(`${b.classLabel} ${b.subject}`),
  );
}

export const GET = handle(async () => {
  const { tenantId, user } = await requireTenant(["teacher"]);
  const me = await staffOf(tenantId, user.id);
  if (!me) return NextResponse.json([]);
  const pairs = await pairsFor(tenantId, me.id);
  const saved = await prisma.syllabusProgress.findMany({
    where: { tenantId, sectionId: { in: pairs.map((p) => p.sectionId) } },
  });
  const pct = new Map(saved.map((s) => [`${s.sectionId}|${s.subjectId}`, s.pct]));
  return NextResponse.json(
    pairs.map((p) => ({ ...p, pct: pct.get(`${p.sectionId}|${p.subjectId}`) ?? 0 })),
  );
});

const Body = z.object({
  sectionId: z.string().min(1),
  subjectId: z.string().min(1),
  pct: z.number().int().min(0).max(100),
});

/** A teacher reports how much they have covered; only for a class and subject they teach. */
export const PUT = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant(["teacher"]);
  const me = await staffOf(tenantId, user.id);
  const b = Body.parse(await req.json());
  const teaches =
    me &&
    (await prisma.period.count({
      where: { tenantId, staffId: me.id, sectionId: b.sectionId, subjectId: b.subjectId },
    }));
  if (!teaches) throw new HttpError(403, "forbidden", "You do not teach this subject in this class.");
  await prisma.syllabusProgress.upsert({
    where: { sectionId_subjectId: { sectionId: b.sectionId, subjectId: b.subjectId } },
    create: { tenantId, sectionId: b.sectionId, subjectId: b.subjectId, pct: b.pct },
    update: { pct: b.pct },
  });
  return NextResponse.json({ ok: true, mode: "api", message: "Saved." });
});
