import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RESOURCE_PATHS } from "@/services/endpoints";
import { SCREENS } from "@/config/screens";

const read = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf8");

describe("backend handoff docs stay in sync with the code", () => {
  it("API_INTEGRATION.md lists every proposed resource path", () => {
    const doc = read("docs/API_INTEGRATION.md");
    for (const p of Object.values(RESOURCE_PATHS)) expect(doc, p).toContain(`\`${p}\``);
  });

  it("SCREEN_INVENTORY.md lists every screen (run `npm run docs:inventory` if this fails)", () => {
    const doc = read("docs/SCREEN_INVENTORY.md");
    for (const s of SCREENS) expect(doc, s.id).toContain(`| ${s.title}`);
  });

  it("every API-adapter-only secret-free: .env.example has placeholders only", () => {
    const env = read(".env.example");
    expect(env).not.toMatch(/(secret|password|token)\s*=\s*\S+/i);
    expect(env).toMatch(/NEXT_PUBLIC_API_BASE_URL=\s*$/m);
  });
});
