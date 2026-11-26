import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { CERT_DECIDE, type CertType, TITLE } from "@/server/certificates";
import { prisma } from "@/server/db";
import { dayStr } from "@/server/homework";
import { handle } from "@/server/http";

/** The school checks one of its own certificate numbers: GET ?serial=<no>. */
export const GET = handle(async (req: Request) => {
  const { tenantId } = await requireTenant([...CERT_DECIDE]);
  const serial = new URL(req.url).searchParams.get("serial")?.trim() ?? "";
  const c = serial
    ? await prisma.certificate.findFirst({
        where: { tenantId, serialNo: serial, status: "issued" },
        include: { student: { select: { name: true } } },
      })
    : null;
  if (!c?.issuedOn) return NextResponse.json({ valid: false });
  return NextResponse.json({
    valid: true,
    summary: `${TITLE[c.type as CertType]} for ${c.student.name}, issued on ${dayStr(c.issuedOn)}.`,
  });
});
