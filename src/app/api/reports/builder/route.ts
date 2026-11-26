import { NextResponse } from "next/server";
import { HttpError, requireTenant } from "@/server/auth";
import { handle } from "@/server/http";
import { DATASETS } from "@/server/datasets";

/** GET: the datasets this role may export; with ?dataset= its columns and rows. */
export const GET = handle(async (req: Request) => {
  const { tenantId, user } = await requireTenant();
  const allowed = DATASETS.filter((d) => (d.roles as readonly string[]).includes(user.role));
  if (!allowed.length) throw new HttpError(403, "forbidden", "Reports are not open to your role.");
  const key = new URL(req.url).searchParams.get("dataset");
  const list = allowed.map((d) => ({ key: d.key, title: d.title }));
  if (!key) return NextResponse.json({ datasets: list, columns: [], rows: [] });
  const set = allowed.find((d) => d.key === key);
  if (!set) throw new HttpError(404, "not_found", "Report not found.");
  return NextResponse.json({
    datasets: list,
    columns: set.columns,
    rows: await set.rows(tenantId),
  });
});
