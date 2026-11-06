import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle, throttle } from "@/server/http";
import { personName, phone } from "@/server/validators";

const Body = z.object({
  name: personName,
  email: z.string().trim().toLowerCase().email(),
  phone: phone.optional(),
  organisation: z.string().trim().max(120).optional(),
  productKey: z.string().trim().max(30).optional(),
  message: z.string().trim().max(2000).optional(),
  /** Honeypot: real people leave this empty. */
  website: z.string().max(0).optional(),
});

/**
 * POST: a demo or quote request from the ZAQSA website. No login, so it is throttled per IP and has
 * a honeypot. It only creates a "new" lead; it reads nothing back.
 */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  await throttle(`lead|${req.headers.get("x-forwarded-for") ?? "local"}`, 5, 10 * 60_000);
  const { website: hp, ...b } = Body.parse(await req.json());
  void hp;
  if (b.productKey && !(await prisma.product.findUnique({ where: { key: b.productKey } })))
    return NextResponse.json(
      {
        code: "validation",
        message: "Unknown product.",
        fieldErrors: { productKey: ["Unknown product"] },
      },
      { status: 422 },
    );
  await prisma.lead.create({ data: { ...b, source: "website" } });
  return NextResponse.json(
    { ok: true, message: "Thank you. The ZAQSA team will contact you." },
    { status: 201 },
  );
});
