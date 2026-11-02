import Link from "next/link";
import { BRAND, PLACEHOLDER_PAGES, placeholderHref, type PlaceholderSlug } from "@/lib/site";
import { Container } from "@/components/ui/primitives";
import { BrandLogo } from "./brand-logo";

const linkClass =
  "inline-block py-1.5 transition-colors hover:text-white hover:underline hover:decoration-accent-light hover:underline-offset-4";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Platform", href: "/#concept" },
      { label: "Features", href: "/#features" },
      { label: "Product tour", href: "/#showcase" },
      { label: "Book a Demo", href: "/#demo" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { label: "By role", href: "/#roles" },
      { label: "Academic year", href: "/#academic-year" },
      { label: "Multi-campus groups", href: "/#campuses" },
      { label: "Trust & control", href: "/#trust" },
    ],
  },
] as const;

const RESOURCE_SLUGS: PlaceholderSlug[] = ["guides", "faq", "help", "contact"];

export function SiteFooter() {
  return (
    <footer className="on-dark text-on-dark bg-[#0a1f21] pt-18 text-[0.92rem]">
      <Container className="grid gap-8 pb-12 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div className="sm:col-span-2 lg:col-span-1">
          <BrandLogo onDark />
          <p className="mt-4 max-w-[38ch]">
            One school management platform for independent schools and school groups, with a
            separate workspace for every institution.
          </p>
          <p className="mt-4">
            Contact:{" "}
            <span className="border-on-dark border-b border-dashed text-white">
              [email address to be added]
            </span>
          </p>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="mb-4 font-sans text-xs font-bold tracking-[0.12em] text-white uppercase">
              {col.title}
            </h2>
            <ul>
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className={linkClass}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
        <nav aria-label="Resources" id="resources">
          <h2 className="mb-4 font-sans text-xs font-bold tracking-[0.12em] text-white uppercase">
            Resources
          </h2>
          <ul>
            {RESOURCE_SLUGS.map((slug) => (
              <li key={slug}>
                <Link href={placeholderHref(slug)} className={linkClass}>
                  {PLACEHOLDER_PAGES[slug]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Container>
      <Container className="border-ink-line flex flex-wrap justify-between gap-4 border-t py-6 text-sm">
        <p>
          © {new Date().getFullYear()} {BRAND}. All rights reserved.
        </p>
        <ul className="flex gap-6">
          {(["privacy", "terms"] as const).map((slug) => (
            <li key={slug}>
              <Link href={placeholderHref(slug)} className={linkClass}>
                {PLACEHOLDER_PAGES[slug]}
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </footer>
  );
}
