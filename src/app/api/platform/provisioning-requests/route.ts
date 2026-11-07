import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { requirePlatform } from "@/server/platform";

const Body = z.object({
  productKey: z.string().trim().min(2).max(30),
  organisation: z.string().trim().min(2).max(120),
  contactEmail: z.string().trim().toLowerCase().email(),
  leadId: z.string().optional(),
  note: z.string().trim().max(1000).optional(),
});

/** GET: activation requests, newest first. Filter with ?status=. */
export const GET = handle(async (req: Request) => {
  await requirePlatform(["sales", "customer_success", "finance"]);
  const status = new URL(req.url).searchParams.get("status");
  const items = await prisma.provisioningRequest.findMany({
    where: status ? { status: { in: status.split(",") } } : {},
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ items, total: items.length });
});

/**
 * POST: sales asks for a product workspace to be activated for an organisation. Nothing is created
 * here, and a payment alone never activates a product: a customer-success person verifies and
 * approves it first.
 */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { user } = await requirePlatform(["sales", "customer_success"]);
  const b = Body.parse(await req.json());
  const product = await prisma.product.findUnique({ where: { key: b.productKey } });
  if (!product || product.status !== "available")
    throw new HttpError(422, "bad_product", "That product is not available.");
  if (b.leadId && !(await prisma.lead.findUnique({ where: { id: b.leadId } })))
    throw new HttpError(422, "bad_lead", "Unknown lead.");
  const request = await prisma.provisioningRequest.create({
    data: { ...b, requestedById: user.id },
  });
  return NextResponse.json({ ok: true, mode: "api", request }, { status: 201 });
});
