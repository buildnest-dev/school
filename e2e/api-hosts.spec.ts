import { expect, request as pwRequest, test } from "@playwright/test";

/** Which sign-ins each ZAQSA address accepts. Addresses are simulated with x-forwarded-host. */
const PASSWORD = "ChangeMe#2026";
const base = "http://localhost:3000";
const PUBLIC = "school.zaqsa.com";
const TEAM = "team.schools.zaqsa.com";
const STAFF = "demo-school.school.zaqsa.com";
const FAMILY = "demo-school.parents.zaqsa.com";
const OTHER_STAFF = "other-school.school.zaqsa.com";

const ctx = (host: string) =>
  pwRequest.newContext({ baseURL: base, extraHTTPHeaders: { "x-forwarded-host": host } });
const login = async (host: string, email: string) => {
  const c = await ctx(host);
  const res = await c.post("/api/auth/login", { data: { email, password: PASSWORD } });
  return { c, status: res.status() };
};

test("staff and teachers sign in on their school address, families do not", async () => {
  expect((await login(STAFF, "principal@demo.test")).status).toBe(200);
  expect((await login(STAFF, "teacher@demo.test")).status).toBe(200);
  expect((await login(STAFF, "parent@demo.test")).status).toBe(401);
  expect((await login(STAFF, "student@demo.test")).status).toBe(401);
  expect((await login(STAFF, "platform@demo.test")).status).toBe(401);
});

test("parents and students sign in on the parents address, staff do not", async () => {
  expect((await login(FAMILY, "parent@demo.test")).status).toBe(200);
  expect((await login(FAMILY, "student@demo.test")).status).toBe(200);
  expect((await login(FAMILY, "principal@demo.test")).status).toBe(401);
  expect((await login(FAMILY, "teacher@demo.test")).status).toBe(401);
});

test("a person of another school cannot sign in, and a session does not cross schools", async () => {
  expect((await login(OTHER_STAFF, "principal@demo.test")).status).toBe(401);
  const { c } = await login(STAFF, "principal@demo.test");
  expect((await c.get("/api/me")).status()).toBe(200);
  // The same cookie shown to another school's address, the parents address, or the team address.
  for (const host of [OTHER_STAFF, FAMILY, TEAM]) {
    const res = await c.get("/api/me", { headers: { "x-forwarded-host": host } });
    expect(res.status(), host).toBe(401);
  }
});

test("platform users sign in only on the team address and are not asked for an authenticator", async () => {
  expect((await login(PUBLIC, "platform@demo.test")).status).toBe(404);
  expect((await login(FAMILY, "platform@demo.test")).status).toBe(401);
  expect((await login(TEAM, "principal@demo.test")).status).toBe(401);
  const { c, status } = await login(TEAM, "platform@demo.test");
  expect(status).toBe(200);
  const me = await (await c.get("/api/me")).json();
  expect(me.mfaSetupRequired).toBeUndefined();
  expect((await c.get("/api/platform/schools")).status()).toBe(200);
  // The same session on a school address means nothing.
  expect((await c.get("/api/me", { headers: { "x-forwarded-host": STAFF } })).status()).toBe(401);
});

test("the public address serves only the site and the demo request", async () => {
  const c = await ctx(PUBLIC);
  expect((await c.get("/")).status()).toBe(200);
  const signIn = await c.get("/sign-in", { maxRedirects: 0 });
  expect(signIn.status()).toBe(307);
  expect((await c.get("/platform", { maxRedirects: 0 })).status()).toBe(307);
  expect(
    (await c.post("/api/auth/login", { data: { email: "a@b.co", password: "x" } })).status(),
  ).toBe(404);
  expect((await c.get("/api/students")).status()).toBe(404);
  const robots = await (await c.get("/robots.txt")).text();
  expect(robots).toContain("Allow: /");
  expect(robots).not.toMatch(/Disallow: \/\s*$/m);
  expect((await c.get("/")).headers()["x-robots-tag"]).toBeUndefined();
});

test("the demo form creates a lead and is spam protected", async () => {
  const c = await pwRequest.newContext({
    baseURL: base,
    extraHTTPHeaders: {
      "x-forwarded-host": PUBLIC,
      "x-forwarded-for": `10.9.${Date.now() % 250}.${process.pid % 250}`,
    },
  });
  const ok = await c.post("/api/public/leads", {
    data: {
      name: "Host Test",
      email: `host.${Date.now()}@lead-test.example`,
      organisation: "Test School",
      productKey: "school",
    },
  });
  expect(ok.status()).toBe(201);
  const bot = await c.post("/api/public/leads", {
    data: {
      name: "Bot",
      email: "bot@lead-test.example",
      organisation: "X",
      productKey: "school",
      website: "http://spam",
    },
  });
  expect(bot.status()).toBe(422); // the hidden field must stay empty
});

test("every address except the public one is hidden from search engines", async () => {
  for (const host of [TEAM, STAFF, FAMILY]) {
    const c = await ctx(host);
    const res = await c.get("/sign-in");
    expect(res.headers()["x-robots-tag"], host).toContain("noindex");
    const robots = await (await c.get("/robots.txt")).text();
    expect(robots, host).toMatch(/Disallow: \//);
  }
});

test("a signed-in address sends visitors away from the other areas", async () => {
  const staff = await ctx(STAFF);
  const r = await staff.get("/platform", { maxRedirects: 0 });
  expect(r.status()).toBe(307);
  expect(r.headers()["location"]).toContain("/sign-in");
  const team = await ctx(TEAM);
  expect((await team.get("/school", { maxRedirects: 0 })).status()).toBe(307);
});
