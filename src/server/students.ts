import { HttpError } from "./auth";
import { prisma } from "./db";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Next admission number for the school: ADM-<year>-<0001...>. The unique index guards against races. */
export async function nextAdmissionNo(tx: Tx, tenantId: string) {
  const year = new Date().getUTCFullYear();
  const prefix = `ADM-${year}-`;
  const last = await tx.student.findFirst({
    where: { tenantId, admissionNo: { startsWith: prefix } },
    orderBy: { admissionNo: "desc" },
    select: { admissionNo: true },
  });
  const n = last ? Number(last.admissionNo.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(n).padStart(4, "0")}`;
}

/** Location ids must exist and the district must belong to the state. */
export async function checkLocation(stateId?: string, districtId?: string) {
  if (districtId && !stateId)
    throw new HttpError(422, "state_required", "Choose the state before the district.");
  if (stateId && !(await prisma.state.findUnique({ where: { id: stateId } })))
    throw new HttpError(422, "bad_state", "Unknown state.");
  if (districtId && !(await prisma.district.findFirst({ where: { id: districtId, stateId } })))
    throw new HttpError(422, "bad_district", "That district is not in the chosen state.");
}

/** Maps a Student row (with relations) to the public detail shape. Never returns the full Aadhaar. */
export function studentDetail(s: {
  id: string;
  admissionNo: string;
  name: string;
  dob: Date | null;
  gender: string | null;
  bloodGroup: string | null;
  category: string | null;
  motherTongue: string | null;
  religion: string | null;
  aadhaarLast4: string | null;
  penNumber: string | null;
  apaarId: string | null;
  stateId: string | null;
  districtId: string | null;
  address: string | null;
  status: string;
  section: { id: string; name: string; class: { name: string } } | null;
  guardian: { name: string; relation: string; phone: string | null; email: string | null } | null;
}) {
  return {
    id: s.id,
    admissionNo: s.admissionNo,
    name: s.name,
    dob: s.dob?.toISOString().slice(0, 10) ?? null,
    gender: s.gender,
    bloodGroup: s.bloodGroup,
    category: s.category,
    motherTongue: s.motherTongue,
    religion: s.religion,
    aadhaarMasked: s.aadhaarLast4 ? `XXXX XXXX ${s.aadhaarLast4}` : null,
    penNumber: s.penNumber,
    apaarId: s.apaarId,
    stateId: s.stateId,
    districtId: s.districtId,
    address: s.address,
    status: s.status,
    sectionId: s.section?.id ?? null,
    classSection: s.section ? `${s.section.class.name} ${s.section.name}` : null,
    guardian: s.guardian,
  };
}

export const studentInclude = {
  section: { include: { class: true } },
  guardian: true,
} as const;

/** Refuses a new admission when it would take the school past its plan's student limit. */
export async function assertRoomForStudents(tenantId: string, adding = 1) {
  const t = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { maxStudents: true },
  });
  if (t.maxStudents == null) return;
  const have = await prisma.student.count({ where: { tenantId, status: "active" } });
  if (have + adding > t.maxStudents)
    throw new HttpError(
      409,
      "LIMIT_EXCEEDED",
      `This plan allows ${t.maxStudents} active students (${have} now). Ask ZAQSA to raise the limit.`,
    );
}
