import { z } from "zod";
import { HttpError } from "./auth";
import { prisma } from "./db";
import { CATEGORIES, dob, guardianInput, personName } from "./validators";

export const MAX_IMPORT_ROWS = 2000;
export const MAX_IMPORT_BYTES = 1_000_000;

/** Reads CSV text (quoted fields, doubled quotes, CRLF) into rows of cells. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

/** 15/08/2014 or 2014-08-15 become 2014-08-15; anything else is left for validation to reject. */
const isoDate = (v: string) => {
  const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(v.trim());
  return m ? `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}` : v.trim();
};

const Row = z.object({
  name: personName,
  dob,
  gender: z.enum(["male", "female", "other"]),
  category: z.enum(CATEGORIES).optional(),
  address: z.string().trim().max(300).optional(),
  guardian: guardianInput,
});

export type ImportRow = z.infer<typeof Row> & { sectionId: string; line: number };
export type ImportError = { line: number; problems: string[] };

const REQUIRED = [
  "name",
  "dob",
  "gender",
  "class",
  "section",
  "guardian_name",
  "guardian_relation",
  "guardian_phone",
];

/** Checks every row without saving anything. Valid rows are ready to commit; bad ones say why. */
export async function checkStudentCsv(tenantId: string, csv: string) {
  if (csv.length > MAX_IMPORT_BYTES)
    throw new HttpError(413, "too_large", "The file is too large. Split it into smaller files.");
  const table = parseCsv(csv);
  const head = (table.shift() ?? []).map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const missing = REQUIRED.filter((h) => !head.includes(h));
  if (missing.length)
    throw new HttpError(422, "bad_header", `The first row must include: ${missing.join(", ")}.`);
  if (table.length === 0) throw new HttpError(422, "empty", "The file has no student rows.");
  if (table.length > MAX_IMPORT_ROWS)
    throw new HttpError(422, "too_many_rows", `At most ${MAX_IMPORT_ROWS} rows per file.`);

  const sections = await prisma.section.findMany({
    where: { tenantId },
    include: { class: true },
  });
  const sectionKey = new Map(
    sections.map((s) => [`${s.class.name.toLowerCase()}|${s.name.toLowerCase()}`, s.id]),
  );
  const existing = await prisma.student.findMany({
    where: { tenantId, status: "active" },
    select: { name: true, dob: true },
  });
  const seen = new Set(
    existing.map((s) => `${s.name.toLowerCase()}|${s.dob?.toISOString().slice(0, 10)}`),
  );

  const rows: ImportRow[] = [];
  const errors: ImportError[] = [];
  table.forEach((cells, idx) => {
    const line = idx + 2; // line 1 is the header
    const get = (k: string) => (cells[head.indexOf(k)] ?? "").trim();
    const problems: string[] = [];
    const sectionId = sectionKey.get(
      `${get("class").toLowerCase()}|${get("section").toLowerCase()}`,
    );
    if (!sectionId)
      problems.push(`Class "${get("class")}" section "${get("section")}" does not exist.`);
    const category = CATEGORIES.find((c) => c.toLowerCase() === get("category").toLowerCase());
    const parsed = Row.safeParse({
      name: get("name"),
      dob: isoDate(get("dob")),
      gender: get("gender").toLowerCase(),
      category: get("category") ? category : undefined,
      address: get("address") || undefined,
      guardian: {
        name: get("guardian_name"),
        relation: get("guardian_relation").toLowerCase(),
        phone: get("guardian_phone"),
        email: get("guardian_email") || undefined,
      },
    });
    if (get("category") && !category)
      problems.push("Category must be General, OBC, SC, ST or EWS.");
    if (!parsed.success)
      for (const i of parsed.error.issues) problems.push(`${i.path.join(".")}: ${i.message}`);
    if (parsed.success) {
      const key = `${parsed.data.name.toLowerCase()}|${parsed.data.dob}`;
      if (seen.has(key))
        problems.push("A student with this name and date of birth already exists.");
      seen.add(key);
    }
    if (problems.length || !parsed.success || !sectionId) errors.push({ line, problems });
    else rows.push({ ...parsed.data, sectionId, line });
  });
  return { rows, errors, total: table.length };
}
