/**
 * The demonstration school. Its address names are listed here so the screens can tell. On it, parts
 * whose backend is not built yet show sample data instead of "Coming soon", so a visitor can see the
 * whole product. Any other school never sees sample data.
 */
export const DEMO_SLUGS = ["demoschool"];

export function isDemoHost(): boolean {
  if (typeof window === "undefined") return false;
  const slug = window.location.hostname.split(".")[0] ?? "";
  return DEMO_SLUGS.includes(slug);
}
