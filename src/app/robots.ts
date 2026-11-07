import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { classifyHost } from "@/server/hosts";

/** Only the public product site may be indexed; every other address asks crawlers to stay out. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers();
  const info = classifyHost(h.get("x-forwarded-host") ?? h.get("host"));
  if (info.kind === "public")
    return { rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/sign-in"] }] };
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
