import { hostsFor } from "./platform";

/**
 * Adds a school's two addresses to the Vercel project, so nobody has to do it by hand.
 * Needs VERCEL_TOKEN and VERCEL_PROJECT_ID (VERCEL_TEAM_ID too when the project is in a team).
 * Without them nothing is called (local development and tests).
 */
export type DomainResult = "added" | "already_added" | "failed" | "not_configured";

export const domainsConfigured = () => !!process.env.VERCEL_TOKEN && !!process.env.VERCEL_PROJECT_ID;

async function addDomain(name: string): Promise<DomainResult> {
  const token = process.env.VERCEL_TOKEN;
  const project = process.env.VERCEL_PROJECT_ID;
  if (!token || !project) return "not_configured";
  const team = process.env.VERCEL_TEAM_ID;
  const url =
    `https://api.vercel.com/v10/projects/${encodeURIComponent(project)}/domains` +
    (team ? `?teamId=${encodeURIComponent(team)}` : "");
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ name }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return "added";
    const body = (await res.json().catch(() => ({}))) as { error?: { code?: string } };
    const code = body.error?.code ?? "";
    // Adding a domain the project already has is not an error for us.
    if (res.status === 409 || code.includes("already") || code === "domain_already_in_use")
      return "already_added";
    console.error("vercel domain add failed", name, res.status, code);
    return "failed";
  } catch (e) {
    console.error("vercel domain add error", name, e instanceof Error ? e.message : e);
    return "failed";
  }
}

/** Adds both addresses of a school. Never throws: a failure is reported so it can be retried. */
export async function addSchoolDomains(slug: string) {
  const hosts = hostsFor(slug);
  const [school, parents] = await Promise.all([addDomain(hosts.school), addDomain(hosts.parents)]);
  return { school, parents };
}
