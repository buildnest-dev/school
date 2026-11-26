import { NextResponse } from "next/server";
import { modulesFor, moduleRights } from "@/config/modules";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { handle } from "@/server/http";
import { readable } from "@/server/registers";

/** The registers this person can open, each with how many records still sit at the first stage. */
export const GET = handle(async () => {
  const { tenantId, user } = await requireTenant();
  const items = await Promise.all(
    modulesFor(user.role).map(async (def) => {
      const where = await readable(tenantId, user, def, moduleRights(def, user.role));
      const waiting = await prisma.schoolRecord.count({
        where: { AND: [where, { status: def.statuses[0] }] },
      });
      return { key: def.key, waiting };
    }),
  );
  return NextResponse.json(items);
});
