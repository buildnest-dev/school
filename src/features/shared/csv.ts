/** One CSV cell. A leading =, +, - or @ is prefixed so a spreadsheet does not run it as a formula. */
export function csvCell(value: unknown) {
  let s = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const toCsv = (rows: unknown[][]) => rows.map((r) => r.map(csvCell).join(",")).join("\r\n");

export function downloadCsv(filename: string, rows: unknown[][]) {
  // The byte-order mark makes Excel read Hindi and the rupee sign correctly.
  const url = URL.createObjectURL(
    new Blob(["﻿" + toCsv(rows)], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
