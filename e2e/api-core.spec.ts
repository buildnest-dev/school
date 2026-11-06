import { expect, request as pwRequest, test, type APIRequestContext } from "@playwright/test";

/** ZAQSA core: catalog, leads, provisioning requests, support desk and team roles. */
const PASSWORD = "ChangeMe#2026";
const base = "http://localhost:3000";

async function as(email: string): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({ baseURL: base });
  const res = await ctx.post("/api/auth/login", { data: { email, password: PASSWORD } });
  expect(res.status(), `login ${email}`).toBe(200);
  return ctx;
}

test.describe.configure({ mode: "serial" });

const run = Date.now().toString(36);
let anon: APIRequestContext;
let admin: APIRequestContext;
let sales: APIRequestContext;
let support: APIRequestContext;
let product: APIRequestContext;
let principal: APIRequestContext;
let teacher: APIRequestContext;
let parent: APIRequestContext;
let other: APIRequestContext;
let leadId = "";
let requestId = "";
let ticketId = "";

test.beforeAll(async () => {
  anon = await pwRequest.newContext({ baseURL: base });
  [admin, sales, support, product, principal, teacher, parent, other] = await Promise.all([
    as("platform@demo.test"),
    as("sales@demo.test"),
    as("support@demo.test"),
    as("product@demo.test"),
    as("principal@demo.test"),
    as("teacher@demo.test"),
    as("parent@demo.test"),
    as("principal@other.test"),
  ]);
});

test("the public catalog lists software and services", async () => {
  const res = await anon.get("/api/public/products");
  expect(res.status()).toBe(200);
  const body = await res.json();
  const keys = body.items.map((p: { key: string }) => p.key);
  expect(keys).toEqual(expect.arrayContaining(["school", "hospital", "web", "ai"]));
  expect(body.items.find((p: { key: string }) => p.key === "school").status).toBe("available");
});

test("a website visitor can request a demo, with abuse checks", async () => {
  const lead = {
    name: "Anita Rao",
    email: `anita.${run}@lead-test.example`,
    organisation: "Sunrise School",
    productKey: "school",
    message: "We would like a demo.",
  };
  expect((await anon.post("/api/public/leads", { data: lead })).status()).toBe(201);
  expect(
    (await anon.post("/api/public/leads", { data: { ...lead, productKey: "nope" } })).status(),
  ).toBe(422);
  expect((await anon.post("/api/public/leads", { data: { ...lead, email: "bad" } })).status()).toBe(
    422,
  );
  // The honeypot rejects bots.
  expect(
    (await anon.post("/api/public/leads", { data: { ...lead, website: "http://spam" } })).status(),
  ).toBe(422);
});

test("only the right ZAQSA roles see and work leads", async () => {
  expect((await anon.get("/api/platform/leads")).status()).toBe(401);
  expect((await principal.get("/api/platform/leads")).status()).toBe(403);
  expect((await support.get("/api/platform/leads")).status()).toBe(403);

  const list = await (await sales.get(`/api/platform/leads?q=anita.${run}`)).json();
  expect(list.items).toHaveLength(1);
  expect(list.items[0].stage).toBe("new");
  leadId = list.items[0].id;

  const moved = await sales.patch(`/api/platform/leads/${leadId}`, {
    data: { stage: "demo", assignToMe: true, notes: "Demo on Friday" },
  });
  expect(moved.status()).toBe(200);
  expect((await moved.json()).lead).toMatchObject({ stage: "demo", notes: "Demo on Friday" });
  expect((await moved.json()).lead.ownerId).toBeTruthy();
  expect(
    (await sales.patch(`/api/platform/leads/${leadId}`, { data: { stage: "bogus" } })).status(),
  ).toBe(422);
  expect(
    (await support.patch(`/api/platform/leads/${leadId}`, { data: { stage: "won" } })).status(),
  ).toBe(403);
});

test("a product manager edits the catalog; others cannot", async () => {
  expect(
    (
      await sales.patch("/api/platform/products/hospital", { data: { name: "X Hospital" } })
    ).status(),
  ).toBe(403);
  const ok = await product.patch("/api/platform/products/business", {
    data: { summary: "Billing, stock and expenses for shops and agencies." },
  });
  expect(ok.status()).toBe(200);
  expect(
    (await product.patch("/api/platform/products/nope", { data: { name: "Nope" } })).status(),
  ).toBe(404);
});

test("activation needs verification and approval, and cannot skip steps", async () => {
  const create = await sales.post("/api/platform/provisioning-requests", {
    data: {
      productKey: "school",
      organisation: "Sunrise School",
      contactEmail: `anita.${run}@lead-test.example`,
      leadId,
    },
  });
  expect(create.status()).toBe(201);
  requestId = (await create.json()).request.id;
  expect(
    (
      await sales.post("/api/platform/provisioning-requests", {
        data: {
          productKey: "hospital",
          organisation: "City Hospital",
          contactEmail: "a@b.example",
        },
      })
    ).status(),
  ).toBe(422); // coming soon, not sellable yet

  const patch = (c: APIRequestContext, body: object) =>
    c.patch(`/api/platform/provisioning-requests/${requestId}`, { data: body });
  expect((await patch(sales, { status: "approved" })).status()).toBe(403); // sales cannot approve
  expect((await patch(admin, { status: "approved" })).status()).toBe(409); // cannot skip verifying
  expect((await patch(sales, { status: "verifying" })).status()).toBe(200);
  expect((await patch(admin, { status: "approved" })).status()).toBe(200);
  // A school cannot be marked provisioned without the workspace being linked.
  expect((await patch(admin, { status: "provisioned" })).status()).toBe(422);
  const school = await (await admin.get("/api/platform/schools?q=demo-school")).json();
  const done = await patch(admin, { status: "provisioned", tenantId: school.items[0].id });
  expect(done.status()).toBe(200);
  expect((await done.json()).request.status).toBe("provisioned");
  expect((await patch(admin, { status: "rejected" })).status()).toBe(409); // final
});

test("team roles limit what each person can reach", async () => {
  // Sales can read the school list (commercial) but not change schools or read tickets.
  expect((await sales.get("/api/platform/schools")).status()).toBe(200);
  expect(
    (await sales.patch("/api/platform/schools/any", { data: { plan: "growth" } })).status(),
  ).toBe(403);
  expect((await sales.get("/api/platform/tickets")).status()).toBe(403);
  expect((await support.post("/api/platform/schools", { data: {} })).status()).toBe(403);
  // The overview shows counts to each role, and nothing to a school user.
  const ov = await sales.get("/api/platform/overview");
  expect(ov.status()).toBe(200);
  expect((await ov.json()).yourRole).toBe("sales");
  expect((await principal.get("/api/platform/overview")).status()).toBe(403);
  // A plain platform user is a super admin.
  expect((await (await admin.get("/api/platform/overview")).json()).yourRole).toBe("super_admin");
});

test("school staff open tickets and the support desk answers", async () => {
  expect((await anon.post("/api/support/tickets", { data: {} })).status()).toBe(401);
  expect(
    (
      await parent.post("/api/support/tickets", {
        data: { subject: "Fee receipt wrong", body: "The receipt shows the wrong amount." },
      })
    ).status(),
  ).toBe(403);
  expect(
    (await principal.post("/api/support/tickets", { data: { subject: "x", body: "y" } })).status(),
  ).toBe(422);

  const made = await teacher.post("/api/support/tickets", {
    data: {
      subject: `Cannot upload marks ${run}`,
      body: "The marks page shows an error when I save.",
      category: "problem",
      priority: "high",
    },
  });
  expect(made.status()).toBe(201);
  const t = (await made.json()).ticket;
  ticketId = t.id;
  expect(t.number).toBeGreaterThan(1000);
  expect(t.status).toBe("open");

  // Only the requester and the owner/principal see it; another school never does.
  expect((await teacher.get(`/api/support/tickets/${ticketId}`)).status()).toBe(200);
  expect((await principal.get(`/api/support/tickets/${ticketId}`)).status()).toBe(200);
  expect((await other.get(`/api/support/tickets/${ticketId}`)).status()).toBe(404);
  const mine = await (await teacher.get("/api/support/tickets")).json();
  expect(mine.items.map((i: { id: string }) => i.id)).toContain(ticketId);
  const theirs = await (await other.get("/api/support/tickets")).json();
  expect(theirs.items.map((i: { id: string }) => i.id)).not.toContain(ticketId);

  // The desk: only support and customer success; sales and product cannot.
  expect((await product.get("/api/platform/tickets")).status()).toBe(403);
  const queue = await (await support.get("/api/platform/tickets?priority=high")).json();
  const row = queue.items.find((i: { id: string }) => i.id === ticketId);
  expect(row.school.slug).toBe("demo-school");

  const note = await support.post(`/api/platform/tickets/${ticketId}/messages`, {
    data: { body: "Looks like a validation bug; checking logs.", internal: true },
  });
  expect(note.status()).toBe(201);
  const reply = await support.post(`/api/platform/tickets/${ticketId}/messages`, {
    data: { body: "Please try again now; we fixed it." },
  });
  expect(reply.status()).toBe(201);

  const full = await (await support.get(`/api/platform/tickets/${ticketId}`)).json();
  expect(full.status).toBe("pending");
  expect(full.assigneeId).toBeTruthy();
  expect(full.messages).toHaveLength(3);

  // The school sees the reply but never the internal note.
  const seen = await (await teacher.get(`/api/support/tickets/${ticketId}`)).json();
  expect(seen.messages.map((m: { body: string }) => m.body)).toEqual([
    "The marks page shows an error when I save.",
    "Please try again now; we fixed it.",
  ]);

  // The school answers, which puts it back in the queue; support resolves, then closes it.
  expect(
    (
      await teacher.post(`/api/support/tickets/${ticketId}/messages`, {
        data: { body: "Still failing for Class 9B." },
      })
    ).status(),
  ).toBe(201);
  expect((await (await support.get(`/api/platform/tickets/${ticketId}`)).json()).status).toBe(
    "open",
  );
  expect(
    (
      await support.patch(`/api/platform/tickets/${ticketId}`, { data: { status: "closed" } })
    ).status(),
  ).toBe(200);
  expect(
    (
      await teacher.post(`/api/support/tickets/${ticketId}/messages`, { data: { body: "More." } })
    ).status(),
  ).toBe(409);
});

test("school screens: ledger adds up, other schools and parents are kept out, dashboard is role-shaped", async () => {
  const stu = await (await principal.get("/api/students?pageSize=1")).json();
  const id = stu.items[0].id as string;
  const res = await principal.get(`/api/students/${id}/ledger`);
  expect(res.status()).toBe(200);
  const rows = (await res.json()) as { debit: number; credit: number; balance: number }[];
  expect(rows.length).toBeGreaterThan(0);
  const net = rows.reduce((s, r) => s + r.debit - r.credit, 0);
  expect(rows[rows.length - 1].balance).toBeCloseTo(net, 2);

  expect((await parent.get(`/api/students/${id}/ledger`)).status()).toBe(403);
  expect((await other.get(`/api/students/${id}/ledger`)).status()).toBe(404);

  const home = await (await principal.get("/api/dashboards/school")).json();
  expect(home.stats.map((s: { label: string }) => s.label)).toContain("Students");
  expect((await teacher.get("/api/dashboards/school")).status()).toBe(403);

  const camps = await (await principal.get("/api/campuses")).json();
  expect(camps.items.length).toBeGreaterThan(0);
  expect((await parent.get("/api/campuses")).status()).toBe(403);

  const drafts = await (await principal.get("/api/notices?filter[status]=draft")).json();
  expect(drafts.items.every((n: { status: string }) => n.status === "draft")).toBe(true);
});
