// Data every installation needs, whether it is the demo database or production: the states and
// districts of India, the education boards with their grade scales, and the ZAQSA product catalog.
import { ALL_BOARDS } from "../src/data/boards";
import { STATES_AND_DISTRICTS, UT_NAMES } from "../src/data/india-geo";
import type { PrismaClient } from "../src/generated/prisma/client";

export async function reference(prisma: PrismaClient) {
  for (const [name, districts] of Object.entries(STATES_AND_DISTRICTS)) {
    const state = await prisma.state.upsert({
      where: { name },
      update: {},
      create: { name, kind: UT_NAMES.has(name) ? "ut" : "state" },
    });
    for (const d of districts) {
      await prisma.district.upsert({
        where: { stateId_name: { stateId: state.id, name: d } },
        update: {},
        create: { name: d, stateId: state.id },
      });
    }
  }
  for (const b of ALL_BOARDS) {
    await prisma.board.upsert({
      where: { code: b.code },
      update: { name: b.name, gradeScale: JSON.stringify(b.scale) },
      create: {
        code: b.code,
        name: b.name,
        kind: b.kind,
        stateCode: b.stateName ?? null,
        gradeScale: JSON.stringify(b.scale),
      },
    });
  }
}

export async function productCatalog(prisma: PrismaClient) {
  const catalog = [
    [
      "school",
      "School OS",
      "software",
      "Admissions, attendance, fees, exams and parent portal for schools.",
      "available",
    ],
    [
      "hospital",
      "Hospital OS",
      "software",
      "Patient registration, OPD/IPD, laboratory, pharmacy and billing.",
      "coming_soon",
    ],
    [
      "business",
      "Business OS",
      "software",
      "Customers, inventory, billing, purchases and expenses for small businesses.",
      "coming_soon",
    ],
    [
      "campaign",
      "Campaign OS",
      "software",
      "Teams, volunteers, events, budgets and approved communications.",
      "coming_soon",
    ],
    [
      "social",
      "Social Media OS",
      "software",
      "Content calendar, approvals and publishing across brands.",
      "coming_soon",
    ],
    [
      "web",
      "Web Development",
      "service",
      "Websites built, launched and maintained by ZAQSA.",
      "available",
    ],
    [
      "app",
      "App Development",
      "service",
      "Android and iOS apps from brief to store release.",
      "available",
    ],
    [
      "ai",
      "AI Automation",
      "service",
      "Workflows and assistants that remove repetitive work.",
      "available",
    ],
    [
      "marketing",
      "Digital Marketing",
      "service",
      "Campaigns, branding and social presence.",
      "available",
    ],
  ] as const;
  for (const [i, [key, name, kind, summary, status]] of catalog.entries())
    await prisma.product.upsert({
      where: { key },
      update: {},
      create: { key, name, kind, summary, status, position: i },
    });
}
