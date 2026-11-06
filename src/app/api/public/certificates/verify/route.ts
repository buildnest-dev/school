import { NextResponse } from "next/server";
import { type CertType, TITLE } from "@/server/certificates";
import { prisma } from "@/server/db";
import { dayStr } from "@/server/homework";
import { handle, throttle } from "@/server/http";

/** "Aarav Verma" -> "Aarav V." : enough to match a paper certificate, not enough to look anyone up. */
const mask = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]![0]}.` : (parts[0] ?? "");
};

/**
 * Public check of a certificate: GET ?school=<slug>&serial=<no>. Anyone holding a paper
 * certificate (an employer, another school) can confirm it is genuine. It needs the school and the
 * exact serial number, is rate-limited, shows only a masked name, and answers 200 with valid:false
 * for anything it cannot confirm, so it cannot be used to discover which serials exist.
 */
export const GET = handle(async (req: Request) => {
  throttle(`cert|${req.headers.get("x-forwarded-for") ?? "local"}`, 30, 10 * 60_000);
  const q = new URL(req.url).searchParams;
  const school = q.get("school")?.trim() ?? "";
  const serial = q.get("serial")?.trim() ?? "";
  const none = NextResponse.json({ valid: false });
  if (!school || !serial || serial.length > 40) return none;
  const tenant = await prisma.tenant.findFirst({
    where: { slug: school, status: { in: ["live", "suspended"] } },
    select: { id: true, name: true },
  });
  if (!tenant) return none;
  const c = await prisma.certificate.findFirst({
    where: { tenantId: tenant.id, serialNo: serial, status: { in: ["issued", "cancelled"] } },
    include: { student: { select: { name: true } } },
  });
  if (!c || !c.issuedOn) return none;
  if (c.status === "cancelled")
    return NextResponse.json({ valid: false, reason: "cancelled", school: tenant.name });
  return NextResponse.json({
    valid: true,
    school: tenant.name,
    title: TITLE[c.type as CertType],
    serialNo: c.serialNo,
    issuedOn: dayStr(c.issuedOn),
    student: mask(c.student.name),
  });
});
