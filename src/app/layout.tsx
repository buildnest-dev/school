import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { BRAND } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${BRAND} — One school management platform for every school`,
    template: `%s · ${BRAND}`,
  },
  description:
    "A unified operating system for schools: admissions, academics, attendance, fees, staff and parent communication, with a separate workspace for every institution.",
};

export const viewport: Viewport = { themeColor: "#0f2a2d", width: "device-width", initialScale: 1 };

/**
 * Runs before first paint. `.js` enables the animation "before" states in globals.css; if the app
 * bundle never marks GSAP as ready within 3s, `.js` is removed so no content stays hidden.
 */
const MOTION_GATE = `document.documentElement.classList.add('js');setTimeout(function(){if(!window.__gsapReady)document.documentElement.classList.remove('js')},3000);`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: MOTION_GATE }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
