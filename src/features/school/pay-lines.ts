export interface PayLine {
  label: string;
  rupees: number;
}

export const linesText = (lines: PayLine[]) =>
  lines.map((l) => `${l.label}: ${l.rupees}`).join("\n");

/** "Basic: 28000" on each line. Returns null when any line cannot be read. */
export function readLines(text: string): PayLine[] | null {
  const out: PayLine[] = [];
  for (const raw of text.split("\n")) {
    if (!raw.trim()) continue;
    const m = /^(.{1,60}?)\s*:\s*(\d{1,8})$/.exec(raw.trim());
    if (!m) return null;
    out.push({ label: m[1]!, rupees: Number(m[2]) });
  }
  return out;
}
