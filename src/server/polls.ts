export const POLL_MANAGE = ["school_owner", "principal", "vice_principal"] as const;

export function seesPoll(audience: string, role: string) {
  if (audience === "all") return true;
  if (audience === "parents") return role === "parent";
  if (audience === "students") return role === "student";
  return role !== "parent" && role !== "student";
}
