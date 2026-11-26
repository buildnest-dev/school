import type { SessionUser } from "@/types";
import { HttpError } from "./auth";
import { prisma } from "./db";
import { childFor } from "./portal";
import { assertCanAssign } from "./teaching";

export const MAX_FILE_BYTES = 1024 * 1024;

const KINDS: Record<string, (b: Buffer) => boolean> = {
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) => b.subarray(0, 8).toString("hex") === "89504e470d0a1a0a",
  "application/pdf": (b) => b.subarray(0, 5).toString("latin1") === "%PDF-",
};

/** Base64 text to bytes, only for a real JPEG, PNG or PDF of at most 1 MB. */
export function readFile(base64: string): { bytes: Buffer; mime: string } {
  const body = base64.replace(/^data:[\w/+.-]+;base64,/, "");
  if (!/^[A-Za-z0-9+/=\s]+$/.test(body))
    throw new HttpError(422, "bad_file", "The file could not be read.");
  const bytes = Buffer.from(body, "base64");
  if (bytes.length > MAX_FILE_BYTES)
    throw new HttpError(422, "file_too_big", "The file is larger than 1 MB.");
  const mime = Object.keys(KINDS).find((k) => bytes.length > 8 && KINDS[k]!(bytes));
  if (!mime) throw new HttpError(422, "bad_file", "Upload a PDF, JPEG or PNG file.");
  return { bytes, mime };
}

const OFFICE = ["school_owner", "principal", "vice_principal", "admission_officer"];

/**
 * May this person see (or change) the files of one student or one study material? Anything they
 * may not see is a 404, so ids cannot be probed.
 */
export async function assertFileAccess(
  tenantId: string,
  user: SessionUser,
  entity: "student" | "material",
  entityId: string,
  write: boolean,
) {
  const notFound = new HttpError(404, "not_found", "File not found.");
  const family = user.role === "parent" || user.role === "student";
  if (entity === "student") {
    if (OFFICE.includes(user.role)) {
      if (await prisma.student.findFirst({ where: { id: entityId, tenantId } })) return;
      throw notFound;
    }
    // A parent may read and send their own child's documents; a student may only read.
    if (family && (!write || user.role === "parent")) {
      await childFor(tenantId, user, entityId);
      return;
    }
    throw notFound;
  }
  const material = await prisma.studyMaterial.findFirst({ where: { id: entityId, tenantId } });
  if (!material) throw notFound;
  if (family) {
    if (write) throw notFound;
    const mine = await prisma.student.findFirst({
      where: {
        tenantId,
        sectionId: material.sectionId,
        status: "active",
        ...(user.role === "parent" ? { guardian: { userId: user.id } } : { userId: user.id }),
      },
    });
    if (mine) return;
    throw notFound;
  }
  if (!["school_owner", "principal", "teacher"].includes(user.role)) throw notFound;
  await assertCanAssign(tenantId, user, material.sectionId, material.subjectId);
}
