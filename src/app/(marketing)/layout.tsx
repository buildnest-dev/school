import type { ReactNode } from "react";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

/** Public marketing shell. The authenticated product will live in a separate route group. */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="bg-ink fixed top-[-60px] left-4 z-[100] rounded-sm px-4 py-2.5 text-white transition-[top] focus:top-3"
      >
        Skip to main content
      </a>
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}
