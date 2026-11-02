// Generates docs/SCREEN_INVENTORY.md from src/config/screens.ts (the single source of truth).
// Run: npm run docs:inventory
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")),
  "..",
);
const src = fs.readFileSync(path.join(root, "src/config/screens.ts"), "utf8");
const js = ts.transpileModule(src, {
  compilerOptions: { module: "commonjs", target: "es2020" },
}).outputText;
const mod = { exports: {} };
new Function("module", "exports", "require", js)(mod, mod.exports, () => ({}));
const { SCREENS, AREA_ROOT, ROLE_LABEL } = mod.exports;

const AREA_TITLE = {
  platform: "SaaS platform administration",
  school: "School administration (owner, principal, accountant, librarian, transport)",
  teacher: "Teacher workspace",
  parent: "Parent portal",
  student: "Student portal",
};
const STATUS = { implemented: "Implemented (mock data)", partial: "Partial", planned: "Planned" };
const counts = { implemented: 0, partial: 0, planned: 0 };
let out = `# Screen inventory\n\n_Generated from \`src/config/screens.ts\` by \`npm run docs:inventory\`. Do not edit by hand._\n\n`;
out += `**Status legend.** Implemented = working UI against the development mock with the documented service contract. Partial = works but covers only part of the feature, or uses sample data. Planned = route exists and shows an honest "not built yet" page.\n\n`;
for (const s of SCREENS) counts[s.status]++;
out += `**Totals:** ${SCREENS.length} screens: ${counts.implemented} implemented, ${counts.partial} partial, ${counts.planned} planned.\n\n`;
out += `The public marketing site (\`/\`, \`/placeholder/*\`, \`/sign-in\`, \`/get-started\`) lives outside this table; \`/get-started\` (registration/onboarding) is a placeholder.\n\n`;
for (const area of Object.keys(AREA_TITLE)) {
  out += `## ${AREA_TITLE[area]}\n\nRoot: \`${AREA_ROOT[area]}\`\n\n| Route | Screen | Roles | Status | Catalogue § |\n|---|---|---|---|---|\n`;
  for (const s of SCREENS.filter((x) => x.area === area)) {
    out += `| \`${AREA_ROOT[area]}${s.path ? "/" + s.path : ""}\` | ${s.title} | ${s.roles.map((r) => ROLE_LABEL[r]).join(", ")} | ${STATUS[s.status]} | ${s.features.join(", ")} |\n`;
  }
  out += "\n";
}
fs.writeFileSync(path.join(root, "docs/SCREEN_INVENTORY.md"), out);
console.log(`wrote docs/SCREEN_INVENTORY.md (${SCREENS.length} screens)`);
