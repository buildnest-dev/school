import { NextResponse } from "next/server";
import { HttpError, requireTenant } from "@/server/auth";
import {
  assertNoDues,
  buildSnapshot,
  CERT_DECIDE,
  certInclude,
  type CertType,
  certView,
  isUnique,
  issueDetails,
  nextSerial,
} from "@/server/certificates";
import { prisma } from "@/server/db";
import { toDay, todayIST } from "@/server/homework";
import { assertSameOrigin, handle } from "@/server/http";

/**
 * Issues a requested certificate: copies the student's details into it, gives it a serial number
 * (e.g. TC/2026/0007) and the date. A transfer certificate also needs the leaving details, is
 * refused while fees or library items are pending, and then marks the student as transferred
 * and takes them off transport.
 */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...CERT_DECIDE]);
  const { id } = await ctx.params;
  const cert = await prisma.certificate.findFirst({ where: { id, tenantId } });
  if (!cert) throw new HttpError(404, "not_found", "Certificate not found.");
  if (cert.status !== "requested")
    throw new HttpError(409, "not_requested", `This request is already ${cert.status}.`);
  const type = cert.type as CertType;
  const text = await req.text();
  const details = issueDetails[type].parse(text ? JSON.parse(text) : {}) as Record<string, string>;

  const student = await prisma.student.findFirstOrThrow({
    where: { id: cert.studentId, tenantId },
  });
  if (type !== "character" && student.status !== "active")
    throw new HttpError(409, "not_active", "This certificate is only for current students.");
  if (type === "transfer") {
    const done = await prisma.certificate.findFirst({
      where: { tenantId, studentId: student.id, type, status: "issued" },
    });
    if (done)
      throw new HttpError(409, "already_issued", "A transfer certificate was already issued.");
    await assertNoDues(tenantId, student.id);
  }

  const today = todayIST();
  const data = JSON.stringify(await buildSnapshot(tenantId, student.id, cert.purpose, details));
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await prisma.$transaction(async (tx) => {
        const serialNo = await nextSerial(tenantId, type, Number(today.slice(0, 4)));
        const claim = await tx.certificate.updateMany({
          where: { id, tenantId, status: "requested" },
          data: {
            status: "issued",
            serialNo,
            issuedOn: toDay(today),
            issuedByName: user.name,
            data,
          },
        });
        if (claim.count !== 1)
          throw new HttpError(409, "not_requested", "This request was already decided.");
        if (type === "transfer") {
          await tx.student.update({ where: { id: student.id }, data: { status: "transferred" } });
          await tx.studentTransport.deleteMany({ where: { studentId: student.id, tenantId } });
        }
        await tx.auditLog.create({
          data: {
            tenantId,
            userId: user.id,
            action: "certificate.issue",
            entity: "certificate",
            entityId: id,
          },
        });
      });
      break;
    } catch (e) {
      if (!isUnique(e) || attempt === 2) throw e;
    }
  }
  const done = await prisma.certificate.findFirstOrThrow({ where: { id }, include: certInclude });
  return NextResponse.json({
    ok: true,
    mode: "api",
    message: "Certificate issued.",
    certificate: certView(done, true),
  });
});
