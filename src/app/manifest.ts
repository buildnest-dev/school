import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { classifyHost } from "@/server/hosts";

/**
 * Lets the school and parent sites be installed on a phone like an app. The public product site is
 * a normal website: it is marked "browser" so phones do not offer to install it.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const h = await headers();
  const host = classifyHost(h.get("x-forwarded-host") ?? h.get("host"));
  return {
    name: "ZAQSA School",
    short_name: "School",
    description: "Attendance, homework, fees and notices for your school.",
    start_url: "/sign-in",
    scope: "/",
    display: host.kind === "public" ? "browser" : "standalone",
    orientation: "portrait",
    background_color: "#f7f3ec",
    theme_color: "#12282c",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
