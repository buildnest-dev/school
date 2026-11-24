import type { Metadata, Viewport } from "next";
import { Nunito_Sans, Playfair_Display } from "next/font/google";
import type { ReactNode } from "react";
import { BRAND } from "@/lib/site";
import "./globals.css";

const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap" });
const nunito = Nunito_Sans({ subsets: ["latin"], variable: "--font-nunito", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: `${BRAND} — One school management platform for every school`,
    template: `%s · ${BRAND}`,
  },
  description:
    "A unified operating system for schools: admissions, academics, attendance, fees, staff and parent communication, with a separate workspace for every institution.",
  icons: { apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "School", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#3a1d12", width: "device-width", initialScale: 1 };

/**
 * Runs before first paint. `.js` enables the animation "before" states in globals.css; if the app
 * bundle never marks GSAP as ready within 3s, `.js` is removed so no content stays hidden.
 */
const MOTION_GATE = `document.documentElement.classList.add('js');setTimeout(function(){if(!window.__gsapReady)document.documentElement.classList.remove('js')},3000);`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${nunito.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: MOTION_GATE }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
