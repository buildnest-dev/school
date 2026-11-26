/** Temporary product name: change it here and it updates everywhere. */
export const BRAND = "SchoolOS";

export const NAV_LINKS = [
  { label: "Platform", href: "/#concept" },
  { label: "Solutions", href: "/#roles" },
  { label: "Features", href: "/#features" },
  { label: "Resources", href: "/#resources" },
] as const;

/** The plain information pages linked from the footer. Their text is in lib/data/info-pages.ts. */
export const INFO_TITLES = {
  guides: "Guides",
  faq: "FAQ",
  help: "Help centre",
  contact: "Contact",
  privacy: "Privacy Policy",
  terms: "Terms of Service",
} as const;
export type InfoSlug = keyof typeof INFO_TITLES;
export const infoHref = (slug: InfoSlug) => `/info/${slug}`;

export const ROUTES = { signIn: "/sign-in", getStarted: "/get-started", demo: "/#demo" } as const;
