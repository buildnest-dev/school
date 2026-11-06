import { expect, request as pwRequest, test, type APIRequestContext } from "@playwright/test";

/**
 * Backend API tests. They run against the seeded development database (`npx prisma db seed`),
 * so they only use the fictional demo schools. Run with the dev or production server on :3000.
 */
const PASSWORD = "ChangeMe#2026";
const base = "http://localhost:3000";

async function as(email: string): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({ baseURL: base });
  const res = await ctx.post("/api/auth/login", { data: { email, password: PASSWORD } });
  expect(res.status(), `login ${email}`).toBe(200);
  return ctx;
}

test.describe.configure({ mode: "serial" });

let teacher: APIRequestContext;
let principal: APIRequestContext;
let accountant: APIRequestContext;
let parent: APIRequestContext;
let other: APIRequestContext;
let sectionId = "";
let priyaId = "";
let studentIds: string[] = [];

test.beforeAll(async () => {
  [teacher, principal, accountant, parent, other] = await Promise.all([
    as("teacher@demo.test"),
    as("principal@demo.test"),
    as("accountant@demo.test"),
    as("parent@demo.test"),
    as("principal@other.test"),
  ]);
  const classes = await (await teacher.get("/api/classes")).json();
  const c8 = classes.find((c: { name: string }) => c.name === "Class 8");
  sectionId = c8.sections.find((s: { name: string }) => s.name === "A").id;
  // Teachers only work with their own classes: make Priya the class teacher of Class 8 A.
  const staff = (await (await principal.get("/api/staff")).json()).items;
  priyaId = staff.find((x: { name: string }) => x.name === "Priya Nair").id;
  expect(
    (
      await principal.put(`/api/sections/${sectionId}/class-teacher`, {
        data: { staffId: priyaId },
      })
    ).status(),
  ).toBe(200);
});

test.afterAll(async () => {
  await principal.put(`/api/sections/${sectionId}/class-teacher`, { data: { staffId: null } });
});

test("a teacher can only work with their own classes", async () => {
  const classes = await (await teacher.get("/api/classes")).json();
  const c9 = classes.find((c: { name: string }) => c.name === "Class 9");
  const other9 = c9.sections[0].id;
  expect((await teacher.get(`/api/attendance/classes/${other9}/2026-10-27`)).status()).toBe(403);
  expect(
    (
      await teacher.put(`/api/attendance/classes/${other9}/2026-10-27`, {
        data: { marks: {}, submit: false },
      })
    ).status(),
  ).toBe(403);
  expect((await teacher.get(`/api/marks/classes/${other9}`)).status()).toBe(403);
  expect((await teacher.get(`/api/attendance/classes/${sectionId}/2026-10-27`)).status()).toBe(200);
  // The principal is never limited.
  expect((await principal.get(`/api/attendance/classes/${other9}/2026-10-27`)).status()).toBe(200);
});

test("signed-out requests are rejected", async () => {
  const anon = await pwRequest.newContext({ baseURL: base });
  for (const path of ["/api/me", "/api/students", "/api/classes", "/api/fees/invoices"])
    expect((await anon.get(path)).status(), path).toBe(401);
});

test("wrong password is rejected without revealing which part was wrong", async () => {
  const anon = await pwRequest.newContext({ baseURL: base });
  const res = await anon.post("/api/auth/login", {
    data: { email: "teacher@demo.test", password: "nope" },
  });
  expect(res.status()).toBe(401);
  expect((await res.json()).message).toBe("Email or password is incorrect.");
});

test("roles are enforced", async () => {
  expect((await parent.get("/api/students")).status()).toBe(403);
  expect((await teacher.get("/api/fees/invoices")).status()).toBe(403);
  expect((await accountant.get(`/api/attendance/classes/${sectionId}/2026-10-26`)).status()).toBe(
    403,
  );
});

test("attendance: starts all present, saves exceptions, locks after submit", async () => {
  const day = "2026-10-26";
  const url = `/api/attendance/classes/${sectionId}/${day}`;
  const sheet = await (await teacher.get(url)).json();
  expect(sheet.classLabel).toBe("Class 8 A");
  expect(sheet.roster.length).toBe(4);
  expect(Object.values(sheet.marks).every((m) => m === "present")).toBe(true);
  studentIds = sheet.roster.map((r: { id: string }) => r.id);

  const marks = Object.fromEntries(studentIds.map((id, i) => [id, i === 0 ? "absent" : "present"]));
  expect((await teacher.put(url, { data: { marks, submit: true } })).status()).toBe(200);
  const after = await (await teacher.get(url)).json();
  expect(after.status).toBe("submitted");
  expect(after.marks[studentIds[0]!]).toBe("absent");

  // teacher cannot edit a submitted sheet, principal can
  expect((await teacher.put(url, { data: { marks, submit: true } })).status()).toBe(409);
  expect((await principal.put(url, { data: { marks, submit: true } })).status()).toBe(200);
});

test("attendance: rejects bad dates, future dates and unknown students", async () => {
  const bad = await teacher.get(`/api/attendance/classes/${sectionId}/2026-02-31`);
  expect(bad.status()).toBe(400);
  const future = await teacher.put(`/api/attendance/classes/${sectionId}/2099-01-01`, {
    data: { marks: {}, submit: false },
  });
  expect(future.status()).toBe(400);
  const stranger = await teacher.put(`/api/attendance/classes/${sectionId}/2026-10-27`, {
    data: { marks: { "not-a-student": "absent" }, submit: false },
  });
  expect(stranger.status()).toBe(422);
});

test("marks: validates range and completeness before submit", async () => {
  const url = `/api/marks/classes/${sectionId}`;
  const sheet = await (await teacher.get(url)).json();
  expect(sheet.maxMarks).toBe(100);
  const ids: string[] = sheet.roster.map((r: { id: string }) => r.id);

  const tooHigh = await teacher.put(url, { data: { marks: { [ids[0]!]: 101 }, submit: false } });
  expect(tooHigh.status()).toBe(422);
  const incomplete = await teacher.put(url, {
    data: { marks: { [ids[0]!]: 50, [ids[1]!]: null }, submit: true },
  });
  expect(incomplete.status()).toBe(422);

  const all = Object.fromEntries(ids.map((id, i) => [id, 60 + i]));
  expect((await teacher.put(url, { data: { marks: all, submit: true } })).status()).toBe(200);
  expect((await teacher.put(url, { data: { marks: all, submit: true } })).status()).toBe(409);
});

test("fees: records a payment, refuses overpayment and missing UPI reference", async () => {
  const list = await (await accountant.get("/api/fees/invoices?pageSize=100")).json();
  const unpaid = list.items.find((i: { paid: number }) => i.paid === 0);
  const pay = `/api/fees/invoices/${unpaid.id}/payments`;
  expect(unpaid.amount).toBe(12500);

  expect((await accountant.post(pay, { data: { amountRupees: 100, mode: "upi" } })).status()).toBe(
    422,
  );
  expect(
    (await accountant.post(pay, { data: { amountRupees: 99999, mode: "cash" } })).status(),
  ).toBe(422);
  expect(
    (await accountant.post(pay, { data: { amountRupees: 2500.5, mode: "cash" } })).status(),
  ).toBe(200);

  const after = await (await accountant.get("/api/fees/invoices?pageSize=100")).json();
  const row = after.items.find((i: { id: string }) => i.id === unpaid.id);
  expect(row.paid).toBe(2500.5);
  expect(row.status).not.toBe("paid");
});

test("notices: drafts are hidden from parents; only principal can create", async () => {
  const staff = await (await principal.get("/api/notices")).json();
  const mine = await (await parent.get("/api/notices")).json();
  expect(staff.items.some((n: { status: string }) => n.status === "draft")).toBe(true);
  expect(mine.items.every((n: { status: string }) => n.status === "published")).toBe(true);
  const create = { data: { title: "Holiday", body: "School closed Monday.", publish: true } };
  expect((await teacher.post("/api/notices", create)).status()).toBe(403);
  expect((await principal.post("/api/notices", create)).status()).toBe(200);
});

test("tenant isolation: another school sees none of this school's data", async () => {
  // Its own data is visible...
  const own = await (await other.get("/api/students")).json();
  const mine = await (await principal.get("/api/students?pageSize=100")).json();
  const demoIds = new Set(mine.items.map((s: { id: string }) => s.id));
  expect(own.items.map((s: { name: string }) => s.name)).toContain("Kabir Joshi");
  expect(own.items.some((s: { id: string }) => demoIds.has(s.id))).toBe(false);
  // ...but the demo school's section, students and invoices are invisible or not found.
  expect((await other.get(`/api/attendance/classes/${sectionId}/2026-10-26`)).status()).toBe(404);
  expect((await other.get(`/api/marks/classes/${sectionId}`)).status()).toBe(404);
  const invoices = await (await other.get("/api/fees/invoices")).json();
  expect(invoices.total).toBe(0);
  const notices = await (await other.get("/api/notices")).json();
  expect(notices.items.some((n: { title: string }) => n.title === "Annual sports day")).toBe(false);
  const demoInvoice = (await (await accountant.get("/api/fees/invoices")).json()).items[0];
  const attack = await other.post(`/api/fees/invoices/${demoInvoice.id}/payments`, {
    data: { amountRupees: 1, mode: "cash" },
  });
  expect(attack.status()).toBe(404);
  // writing marks for the other school's roster into this school's section is refused too
  const forged = await other.put(`/api/attendance/classes/${sectionId}/2026-10-26`, {
    data: { marks: Object.fromEntries(studentIds.map((id) => [id, "absent"])), submit: true },
  });
  expect(forged.status()).toBe(404);
});

test("logout invalidates the session", async () => {
  expect((await teacher.post("/api/auth/logout")).status()).toBe(200);
  expect((await teacher.get("/api/me")).status()).toBe(401);
});
