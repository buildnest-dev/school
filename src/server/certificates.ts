import { z } from "zod";
import { HttpError } from "./auth";
import { prisma } from "./db";
import { dayField, dayStr } from "./homework";

export const CERT_TYPES = ["bonafide", "character", "transfer"] as const;
export type CertType = (typeof CERT_TYPES)[number];
export const PREFIX: Record<CertType, string> = {
  bonafide: "BON",
  character: "CHR",
  transfer: "TC",
};
export const TITLE: Record<CertType, string> = {
  bonafide: "Bonafide Certificate",
  character: "Character Certificate",
  transfer: "Transfer Certificate",
};

/** Owner and principal decide on certificates. Parents may only request (never decide). */
export const CERT_DECIDE = ["school_owner", "principal"] as const;

const CONDUCT = ["excellent", "good", "satisfactory"] as const;

/** What the issuer must supply, per certificate type. */
export const issueDetails = {
  bonafide: z.object({}).strict(),
  character: z.object({ conduct: z.enum(CONDUCT) }).strict(),
  transfer: z
    .object({
      leavingDate: dayField,
      reasonForLeaving: z.string().trim().min(3).max(200),
      conduct: z.enum(CONDUCT),
      promotedTo: z.string().trim().max(60).optional(),
      remarks: z.string().trim().max(200).optional(),
    })
    .strict(),
} as const;

export interface Snapshot {
  schoolName: string;
  board: string | null;
  academicYear: string | null;
  studentName: string;
  admissionNo: string;
  classSection: string | null;
  dob: string | null;
  gender: string | null;
  guardianName: string | null;
  category: string | null;
  motherTongue: string | null;
  penNumber: string | null;
  purpose: string | null;
  [extra: string]: string | null;
}

/** Copies everything a certificate states about the student, as it is right now. */
export async function buildSnapshot(
  tenantId: string,
  studentId: string,
  purpose: string | null,
  extra: Record<string, string | undefined>,
): Promise<Snapshot> {
  const [tenant, student, board, year] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
    prisma.student.findFirstOrThrow({
      where: { id: studentId, tenantId },
      include: { guardian: true, section: { include: { class: true } } },
    }),
    prisma.tenantBoard.findFirst({
      where: { tenantId, isDefault: true },
      include: { board: true },
    }),
    prisma.academicYear.findFirst({ where: { tenantId, current: true } }),
  ]);
  return {
    schoolName: tenant.name,
    board: board?.board.name ?? null,
    academicYear: year?.label ?? null,
    studentName: student.name,
    admissionNo: student.admissionNo,
    classSection: student.section ? `${student.section.class.name} ${student.section.name}` : null,
    dob: student.dob ? dayStr(student.dob) : null,
    gender: student.gender,
    guardianName: student.guardian?.name ?? null,
    category: student.category,
    motherTongue: student.motherTongue,
    penNumber: student.penNumber,
    purpose,
    ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, v ?? null])),
  };
}

/** The printable text, built only from the stored snapshot. */
export function renderDocument(type: CertType, serialNo: string, issuedOn: string, d: Snapshot) {
  const child = d.gender === "female" ? "daughter" : d.gender === "male" ? "son" : "ward";
  const of = d.guardianName ? `, ${child} of ${d.guardianName},` : "";
  const cls = d.classSection ?? "this school";
  let statement: string;
  if (type === "bonafide")
    statement = `This is to certify that ${d.studentName}${of} is a bonafide student of ${d.schoolName}, studying in ${cls} (Admission No. ${d.admissionNo}) in the academic year ${d.academicYear ?? "-"}.${d.purpose ? ` This certificate is issued for ${d.purpose}.` : ""}`;
  else if (type === "character")
    statement = `This is to certify that ${d.studentName}${of} (Admission No. ${d.admissionNo}) is a student of ${d.schoolName}, and that the conduct and character of the student has been ${d.conduct}.${d.purpose ? ` Issued for ${d.purpose}.` : ""}`;
  else
    statement = `This is to certify that ${d.studentName}${of} (Admission No. ${d.admissionNo}) left ${d.schoolName} on ${d.leavingDate}, last studying in ${cls}. Reason for leaving: ${d.reasonForLeaving}. Conduct: ${d.conduct}. All dues to the school have been cleared.${d.promotedTo ? ` Promoted to: ${d.promotedTo}.` : ""}`;
  const lines: [string, string][] = [
    ["Certificate no.", serialNo],
    ["Date of issue", issuedOn],
    ["School", d.schoolName],
    ["Board", d.board ?? "-"],
    ["Student", d.studentName],
    ["Admission no.", d.admissionNo],
    ["Date of birth", d.dob ?? "-"],
    ["Class", d.classSection ?? "-"],
  ];
  if (type === "transfer") {
    lines.push(["Category", d.category ?? "-"], ["PEN", d.penNumber ?? "-"]);
    if (d.remarks) lines.push(["Remarks", d.remarks]);
  }
  return { title: TITLE[type], statement, lines };
}

export const certInclude = {
  student: {
    select: {
      id: true,
      name: true,
      section: { select: { name: true, class: { select: { name: true } } } },
    },
  },
} as const;

type Row = {
  id: string;
  type: string;
  status: string;
  purpose: string | null;
  requestedByName: string;
  serialNo: string | null;
  issuedOn: Date | null;
  issuedByName: string | null;
  decisionNote: string | null;
  createdAt: Date;
  data: string | null;
  student: {
    id: string;
    name: string;
    section?: { name: string; class: { name: string } } | null;
  };
};

export function certView(c: Row, withDocument = false) {
  const base = {
    id: c.id,
    type: c.type,
    title: TITLE[c.type as CertType] ?? c.type,
    status: c.status,
    studentId: c.student.id,
    student: c.student.name,
    classSection: c.student.section
      ? `${c.student.section.class.name} ${c.student.section.name}`
      : "",
    purpose: c.purpose,
    requestedBy: c.requestedByName,
    requestedOn: dayStr(c.createdAt),
    serialNo: c.serialNo,
    issuedOn: c.issuedOn ? dayStr(c.issuedOn) : null,
    issuedBy: c.issuedByName,
    decisionNote: c.decisionNote,
  };
  if (!withDocument || !c.data || !c.serialNo || !c.issuedOn) return base;
  return {
    ...base,
    document: renderDocument(
      c.type as CertType,
      c.serialNo,
      dayStr(c.issuedOn),
      JSON.parse(c.data),
    ),
  };
}

/** Everything that must be settled before a student can leave: fees, library books and fines. */
export async function assertNoDues(tenantId: string, studentId: string) {
  const invoices = await prisma.invoice.findMany({
    where: { tenantId, studentId },
    include: { payments: true },
  });
  const owed = invoices.reduce(
    (s, i) => s + Math.max(0, i.amountPaise - i.payments.reduce((p, x) => p + x.amountPaise, 0)),
    0,
  );
  if (owed > 0)
    throw new HttpError(
      409,
      "fees_due",
      `Fees of Rs ${owed / 100} are still unpaid; clear them before a transfer certificate.`,
    );
  const loans = await prisma.loan.findMany({
    where: { tenantId, studentId, OR: [{ returnedOn: null }, { fineStatus: "due" }] },
  });
  if (loans.length > 0)
    throw new HttpError(
      409,
      "library_due",
      "Library books or fines are still pending; clear them before a transfer certificate.",
    );
}

export const isUnique = (e: unknown) => (e as { code?: string }).code === "P2002";

/** Next serial for this school, type and year: e.g. TC/2026/0007. */
export async function nextSerial(tenantId: string, type: CertType, year: number) {
  const prefix = `${PREFIX[type]}/${year}/`;
  const last = await prisma.certificate.findFirst({
    where: { tenantId, serialNo: { startsWith: prefix } },
    orderBy: { serialNo: "desc" },
    select: { serialNo: true },
  });
  const n = last?.serialNo ? Number(last.serialNo.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(n).padStart(4, "0")}`;
}
