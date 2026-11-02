/** Temporary product name: change it here and it updates everywhere. */
export const BRAND = "SchoolOS";

export const NAV_LINKS = [
  { label: "Platform", href: "/#concept" },
  { label: "Solutions", href: "/#roles" },
  { label: "Features", href: "/#features" },
  { label: "Resources", href: "/#resources" },
] as const;

/** Destinations that do not exist yet. They route to a clearly marked placeholder page. */
export const PLACEHOLDER_PAGES = {
  guides: "Guides",
  faq: "FAQ",
  help: "Help centre",
  contact: "Contact",
  privacy: "Privacy Policy",
  terms: "Terms of Service",
} as const;
export type PlaceholderSlug = keyof typeof PLACEHOLDER_PAGES;
export const placeholderHref = (slug: PlaceholderSlug) => `/placeholder/${slug}`;

export const ROUTES = { signIn: "/sign-in", getStarted: "/get-started", demo: "/#demo" } as const;
