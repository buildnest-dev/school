import { createHmac } from "node:crypto";
import { expect, request as pwRequest, test, type APIRequestContext } from "@playwright/test";

/**
 * Schools portal, go-live, subscription, online payment callbacks and student import.
 * The server must run with RAZORPAY_WEBHOOK_SECRET=test_webhook_secret.
 */
const PASSWORD = "ChangeMe#2026";
const NEW_PASSWORD = "Sunrise2026Blue";
const WEBHOOK_SECRET = "test_webhook_secret";
const base = "http://localhost:3000";

async function as(email: string, password = PASSWORD): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({ baseURL: base });
  const res = await ctx.post("/api/auth/login", { data: { email, password } });
  expect(res.status(), `login ${email}`).toBe(200);
  return ctx;
}
const loginStatus = async (email: string, password: string) =>
  (
    await (
      await pwRequest.newContext({ baseURL: base })
    ).post("/api/auth/login", {
      data: { email, password },
    })
  ).status();

test.describe.configure({ mode: "serial" });

const run = Date.now().toString(36);
const slug = `gv${run}`;
const ownerMail = `owner.${run}@school-test.example`;
const parentMail = `guardian.${run}@school-test.example`;

let platform: APIRequestContext;
let principal: APIRequestContext;
let teacher: APIRequestContext;
let anon: APIRequestContext;
let owner: APIRequestContext;
let parent: APIRequestContext;
let schoolId = "";
let studentId = "";
let invoiceId = "";
let invoiceNo = "";

const linkFor = async (to: string) => {
  const out = await (await anon.get(`/api/dev/outbox?to=${encodeURIComponent(to)}`)).json();
  return /token=([\w-]+)/.exec(out.items[0]?.body ?? "")?.[1] ?? "";
};
const school = (over: object = {}) => ({
  name: "Green Valley Public School",
  slug,
  ownerName: "Meena Kulkarni",
  ownerEmail: ownerMail,
  boardCodes: ["CBSE"],
  yearLabel: "2026-27",
  plan: "growth",
  planPeriod: "yearly",
  ...over,
});
const patch = (body: object) => platform.patch(`/api/platform/schools/${schoolId}`, { data: body });
const ymd = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

test.beforeAll(async () => {
  [platform, principal, teacher] = await Promise.all([
    as("platform@demo.test"),
    as("principal@demo.test"),
    as("teacher@demo.test"),
  ]);
  anon = await pwRequest.newContext({ baseURL: base });
});

test("only the platform team creates schools, and the input is checked", async () => {
  expect((await principal.post("/api/platform/schools", { data: school() })).status()).toBe(403);
  expect((await anon.post("/api/platform/schools", { data: school() })).status()).toBe(401);
  for (const bad of [
    { slug: "ab" },
    { slug: "admin" },
    { slug: "bad_slug" },
    { boardCodes: ["NOPE"] },
    { boardCodes: [] },
    { yearLabel: "2026-28" },
    { ownerEmail: "not-an-email" },
  ])
    expect(
      (await platform.post("/api/platform/schools", { data: school(bad) })).status(),
      JSON.stringify(bad),
    ).toBeGreaterThanOrEqual(422);

  const res = await platform.post("/api/platform/schools", { data: school() });
  const created = await res.json();
  expect(res.status(), JSON.stringify(created)).toBe(201);
  const s = created.school;
  schoolId = s.id;
  expect(s.status).toBe("provisioned");
  expect(s.subscription).toBe("trial");
  expect(s.hosts).toEqual({
    school: `${slug}.school.zaqsa.com`,
    parents: `${slug}.parents.zaqsa.com`,
  });
  expect((await platform.post("/api/platform/schools", { data: school() })).status()).toBe(409);
});

test("a school cannot go live until the checklist is complete", async () => {
  expect((await principal.get("/api/platform/schools")).status()).toBe(403);
  const list = await (await platform.get(`/api/platform/schools?q=${slug}`)).json();
  expect(list.items.map((i: { slug: string }) => i.slug)).toEqual([slug]);

  const detail = await (await platform.get(`/api/platform/schools/${schoolId}`)).json();
  expect(detail.checklist.some((c: { ok: boolean }) => !c.ok)).toBe(true);
  expect(detail.bank).toBeNull();
  const live = await platform.post(`/api/platform/schools/${schoolId}/go-live`);
  expect(live.status()).toBe(409);
  expect((await live.json()).code).toBe("checklist_incomplete");
  // The platform team has no access to a school's own records.
  expect((await platform.get("/api/students")).status()).toBe(403);
});

test("the owner accepts the invite and sets the school up", async () => {
  const token = await linkFor(ownerMail);
  expect(token.length).toBeGreaterThan(20);
  expect(
    (
      await anon.post("/api/auth/reset-password", { data: { token, password: NEW_PASSWORD } })
    ).status(),
  ).toBe(200);
  owner = await as(ownerMail, NEW_PASSWORD);
  expect((await (await owner.get("/api/me")).json()).role).toBe("school_owner");
  expect((await (await owner.get("/api/school/status")).json()).status).toBe("provisioned");

  const std = await owner.post("/api/classes/standard", {
    data: { includePrePrimary: false, upTo: 10, sections: ["A", "B"] },
  });
  expect(await std.json()).toMatchObject({ classesCreated: 10, sectionsCreated: 20 });
  expect(
    await (
      await owner.post("/api/classes/standard", {
        data: { includePrePrimary: false, upTo: 10, sections: ["A", "B"] },
      })
    ).json(),
  ).toMatchObject({ classesCreated: 0, sectionsCreated: 0 });

  const classes = await (await owner.get("/api/classes")).json();
  const c5 = classes.find((c: { name: string }) => c.name === "Class 5");
  expect(
    (
      await owner.post(`/api/classes/${c5.id}/subjects`, { data: { names: ["English", "Maths"] } })
    ).status(),
  ).toBe(201);
  expect(
    (await teacher.post(`/api/classes/${c5.id}/subjects`, { data: { names: ["Art"] } })).status(),
  ).toBe(403);

  expect(
    (await owner.post("/api/staff", { data: { name: "Meera Iyer", role: "teacher" } })).status(),
  ).toBe(201);
  expect((await owner.post("/api/fees/heads", { data: { name: "Tuition" } })).status()).toBe(201);
  expect((await owner.post("/api/fees/heads", { data: { name: "Tuition" } })).status()).toBe(409);

  const made = await owner.post("/api/students", {
    data: {
      name: "Ira Deshmukh",
      dob: "2015-06-12",
      gender: "female",
      sectionId: c5.sections[0].id,
      guardian: {
        name: "Rohan Deshmukh",
        relation: "father",
        phone: "9822011223",
        email: parentMail,
      },
    },
  });
  expect(made.status()).toBe(201);
  studentId = (await made.json()).id;

  const open = (await (await owner.get("/api/school/status")).json()).checklist.filter(
    (c: { ok: boolean }) => !c.ok,
  );
  expect(open.map((c: { key: string }) => c.key)).toEqual(["bank"]);
});

test("bank details are stored privately and never shown again", async () => {
  const put = (data: object) => platform.put(`/api/platform/schools/${schoolId}/bank`, { data });
  const good = {
    holderName: "Green Valley School",
    bankName: "State Bank",
    ifsc: "SBIN0001234",
    accountNumber: "123456789012",
  };
  expect((await owner.put(`/api/platform/schools/${schoolId}/bank`, { data: good })).status()).toBe(
    403,
  );
  expect((await put({ ...good, ifsc: "BAD" })).status()).toBe(422);
  expect((await put({ ...good, accountNumber: "12ab" })).status()).toBe(422);
  const ok = await put(good);
  expect(ok.status()).toBe(200);
  expect((await ok.json()).accountMasked).toBe("XXXXXX9012");
  const text = await (await platform.get(`/api/platform/schools/${schoolId}`)).text();
  expect(text).not.toContain("123456789012");
  expect(JSON.parse(text).bank.accountMasked).toBe("XXXXXX9012");
});

test("families cannot sign in until the school is live", async () => {
  expect(
    (await owner.post(`/api/students/${studentId}/guardian-login`, { data: {} })).status(),
  ).toBe(201);
  const token = await linkFor(parentMail);
  expect(
    (
      await anon.post("/api/auth/reset-password", { data: { token, password: NEW_PASSWORD } })
    ).status(),
  ).toBe(200);
  expect(await loginStatus(parentMail, NEW_PASSWORD)).toBe(401); // school still provisioned

  const host = (h: string) => anon.get(`/api/public/resolve-host?host=${h}`);
  expect(await (await host(`${slug}.parents.zaqsa.com`)).json()).toMatchObject({
    kind: "parents",
    open: false,
  });
  expect(await (await host(`${slug}.school.zaqsa.com`)).json()).toMatchObject({
    kind: "school",
    open: true,
  });
  expect((await host("nobody-here.school.zaqsa.com")).status()).toBe(404);
  expect((await host("evil.example.com")).status()).toBe(404);

  expect((await platform.post(`/api/platform/schools/${schoolId}/go-live`)).status()).toBe(200);
  expect((await platform.post(`/api/platform/schools/${schoolId}/go-live`)).status()).toBe(409);
  expect(await loginStatus(parentMail, NEW_PASSWORD)).toBe(200);
  expect(await (await host(`${slug}.parents.zaqsa.com`)).json()).toMatchObject({ open: true });
  parent = await as(parentMail, NEW_PASSWORD);
});

const sign = (raw: string) => createHmac("sha256", WEBHOOK_SECRET).update(raw).digest("hex");
const hook = (event: object, id: string, signature?: string) => {
  const raw = JSON.stringify(event);
  return anon.post("/api/webhooks/razorpay", {
    data: raw,
    headers: {
      "content-type": "application/json",
      "x-razorpay-event-id": id,
      ...(signature !== null ? { "x-razorpay-signature": signature ?? sign(raw) } : {}),
    },
  });
};
const captured = (orderId: string, payId: string, amount: number) => ({
  event: "payment.captured",
  payload: { payment: { entity: { id: payId, order_id: orderId, amount } } },
});

test("online payment counts only after a verified callback, once", async () => {
  expect(
    (
      await owner.post("/api/fees/invoices", {
        data: { studentId, title: "Term 1", amount: 12.345, dueOn: "2027-04-30" },
      })
    ).status(),
  ).toBe(422);
  const inv = await owner.post("/api/fees/invoices", {
    data: { studentId, title: "Term 1", amount: 5000.5, dueOn: "2027-04-30" },
  });
  expect(inv.status()).toBe(201);
  ({ id: invoiceId, number: invoiceNo } = await inv.json());

  const demoParent = await as("parent@demo.test");
  expect((await demoParent.post(`/api/fees/invoices/${invoiceId}/pay`)).status()).toBe(404);
  expect((await owner.post(`/api/fees/invoices/${invoiceId}/pay`)).status()).toBe(403);
  const pay = await parent.post(`/api/fees/invoices/${invoiceId}/pay`);
  expect(pay.status()).toBe(201);
  const order = await pay.json();
  expect(order.mode).toBe("stub");
  expect(order.amount).toBe(5000.5);

  const status = async () =>
    (await (await owner.get(`/api/fees/invoices?q=${invoiceNo}`)).json()).items[0] as {
      status: string;
      paid: number;
    };
  const evt = captured(order.orderId, `pay_${run}`, 500050);

  // Not signed, wrongly signed: refused and nothing is paid.
  expect((await hook(evt, `evt_a_${run}`, null as unknown as string)).status()).toBe(400);
  expect((await hook(evt, `evt_b_${run}`, "0".repeat(64))).status()).toBe(400);
  expect((await status()).paid).toBe(0);
  // A correctly signed event for the wrong amount is not accepted.
  const wrong = await hook(captured(order.orderId, `pay_x${run}`, 100), `evt_c_${run}`);
  expect((await wrong.json()).outcome).toBe("amount_mismatch");
  expect((await status()).paid).toBe(0);

  expect((await (await hook(evt, `evt_d_${run}`)).json()).outcome).toBe("paid");
  expect(await status()).toMatchObject({ status: "paid", paid: 5000.5 });
  // Same event again, and the same payment under a new event id: still one payment.
  expect((await (await hook(evt, `evt_d_${run}`)).json()).outcome).toBe("duplicate");
  expect((await (await hook(evt, `evt_e_${run}`)).json()).outcome).toBe("duplicate");
  expect(await status()).toMatchObject({ status: "paid", paid: 5000.5 });
  expect((await parent.post(`/api/fees/invoices/${invoiceId}/pay`)).status()).toBe(409); // already paid

  // A failed attempt leaves the invoice due.
  const inv2 = await (
    await owner.post("/api/fees/invoices", {
      data: { studentId, title: "Term 2", amount: 100, dueOn: "2027-09-30" },
    })
  ).json();
  const o2 = await (await parent.post(`/api/fees/invoices/${inv2.id}/pay`)).json();
  const failed = await hook(
    {
      event: "payment.failed",
      payload: { payment: { entity: { id: `pay_f${run}`, order_id: o2.orderId } } },
    },
    `evt_f_${run}`,
  );
  expect((await failed.json()).outcome).toBe("failed");
  expect(
    (await (await owner.get(`/api/fees/invoices?q=${inv2.number}`)).json()).items[0].paid,
  ).toBe(0);
});

test("a lapsed subscription makes the school read-only but never locks families out", async () => {
  const head = (name: string) => owner.post("/api/fees/heads", { data: { name } });
  // Past the period but inside the grace days: still works, flagged past_due.
  expect((await patch({ periodEnd: ymd(-1), graceDays: 7 })).status()).toBe(200);
  expect((await (await owner.get("/api/school/status")).json()).subscription).toBe("past_due");
  expect((await head("Lab")).status()).toBe(201);

  // Grace is over: staff can read and export, not change.
  expect((await patch({ periodEnd: "2020-01-01" })).status()).toBe(200);
  const st = await (await owner.get("/api/school/status")).json();
  expect(st.subscription).toBe("restricted");
  const blocked = await head("Sports");
  expect(blocked.status()).toBe(403);
  expect((await blocked.json()).code).toBe("read_only");
  expect((await owner.get("/api/fees/heads")).status()).toBe(200);
  const exp = await (await owner.get("/api/school/export")).json();
  expect(exp.format).toBe("zaqsa-export-v1");
  expect(exp.students.map((s: { name: string }) => s.name)).toContain("Ira Deshmukh");
  expect(JSON.stringify(exp)).not.toContain("passwordHash");
  // Parents still see their child and can still pay.
  expect((await parent.get("/api/me/children")).status()).toBe(200);
  const late = await (await patch({ subscription: "active", periodEnd: ymd(30) })).json();
  expect(late.school.subscription).toBe("active");
  expect((await head("Sports")).status()).toBe(201);

  // Suspending signs staff out at once; families can still read.
  expect((await patch({ suspended: true })).status()).toBe(200);
  expect((await owner.get("/api/me")).status()).toBe(401);
  expect(await loginStatus(ownerMail, NEW_PASSWORD)).toBe(401);
  expect((await parent.get("/api/me/children")).status()).toBe(200);
  expect((await patch({ suspended: false })).status()).toBe(200);
  owner = await as(ownerMail, NEW_PASSWORD);
  expect((await head("Library")).status()).toBe(201);
});

const csv = (rows: string[]) =>
  [
    "name,dob,gender,class,section,guardian_name,guardian_relation,guardian_phone,guardian_email,category",
    ...rows,
  ].join("\n");

test("import: check first, save once, undo while unused", async () => {
  const rows = [
    "Kabir Rane,2015-03-04,male,Class 5,A,Anil Rane,father,9811100001,,General",
    "Diya Shah,05/09/2015,female,Class 5,B,Pooja Shah,mother,9811100002,pooja@school-test.example,OBC",
    "Aman Verma,2014-11-20,male,Class 6,A,Sunil Verma,father,9811100003,,",
    "Nope Class,2015-01-01,male,Class 99,A,Someone Else,father,9811100004,,",
    "Bad Phone,2015-01-01,male,Class 5,A,Some One,father,12345,,",
    "Kabir Rane,2015-03-04,male,Class 5,A,Anil Rane,father,9811100001,,",
  ];
  expect((await teacher.post("/api/imports/students", { data: { csv: csv(rows) } })).status()).toBe(
    403,
  );
  expect(
    (await owner.post("/api/imports/students", { data: { csv: "name,dob\nA,B" } })).status(),
  ).toBe(422);

  const pre = await owner.post("/api/imports/students", { data: { csv: csv(rows) } });
  expect(pre.status()).toBe(201);
  const p = await pre.json();
  expect(p).toMatchObject({ total: 6, valid: 3, invalid: 3, canCommit: true });
  expect(p.errors.map((e: { line: number }) => e.line)).toEqual([5, 6, 7]);
  // Nothing is saved by the check.
  expect((await (await owner.get("/api/students?q=Kabir")).json()).total).toBe(0);

  const other = await as("principal@other.test");
  expect((await other.post(`/api/imports/${p.batchId}/commit`)).status()).toBe(404);
  const done = await owner.post(`/api/imports/${p.batchId}/commit`);
  const doneBody = await done.json();
  expect(done.status(), JSON.stringify(doneBody)).toBe(200);
  expect(doneBody.created).toBe(3);
  expect((await owner.post(`/api/imports/${p.batchId}/commit`)).status()).toBe(409); // not twice
  expect((await (await owner.get("/api/students?q=Kabir")).json()).total).toBe(1);

  const undo = await owner.post(`/api/imports/${p.batchId}/undo`);
  expect((await undo.json()).removed).toBe(3);
  expect((await (await owner.get("/api/students?q=Kabir")).json()).total).toBe(0);
  expect((await owner.post(`/api/imports/${p.batchId}/undo`)).status()).toBe(409);

  // Once a student has records, the batch cannot be undone.
  const again = await (
    await owner.post("/api/imports/students", { data: { csv: csv(rows.slice(0, 2)) } })
  ).json();
  expect((await owner.post(`/api/imports/${again.batchId}/commit`)).status()).toBe(200);
  const kid = (await (await owner.get("/api/students?q=Diya")).json()).items[0];
  expect(
    (
      await owner.post("/api/fees/invoices", {
        data: { studentId: kid.id, title: "Admission", amount: 500, dueOn: "2027-01-31" },
      })
    ).status(),
  ).toBe(201);
  const stuck = await owner.post(`/api/imports/${again.batchId}/undo`);
  expect(stuck.status()).toBe(409);
  expect((await stuck.json()).code).toBe("in_use");
  expect((await (await owner.get("/api/students?q=Kabir")).json()).total).toBe(1);
});

test("school data stays separate", async () => {
  expect((await principal.get(`/api/students/${studentId}`)).status()).toBe(404);
  const demo = await (await principal.get("/api/students?q=Deshmukh")).json();
  expect(demo.total).toBe(0);
});

test("a retried write with the same Idempotency-Key is done once", async () => {
  const body = { studentId, title: "Bus fee", amount: 750, dueOn: "2027-02-28" };
  const headers = { "idempotency-key": `inv-${run}-0001` };
  const first = await owner.post("/api/fees/invoices", { data: body, headers });
  const second = await owner.post("/api/fees/invoices", { data: body, headers });
  expect(first.status()).toBe(201);
  expect(second.status()).toBe(201);
  expect(second.headers()["idempotent-replayed"]).toBe("true");
  expect((await second.json()).id).toBe((await first.json()).id);
  const count = (await (await owner.get("/api/fees/invoices?pageSize=100")).json()).items.filter(
    (i: { term: string }) => i.term === "Bus fee",
  ).length;
  expect(count).toBe(1);

  const changed = await owner.post("/api/fees/invoices", {
    data: { ...body, amount: 999 },
    headers,
  });
  expect(changed.status()).toBe(409);
  expect((await changed.json()).code).toBe("IDEMPOTENCY_CONFLICT");
  expect(
    (
      await owner.post("/api/fees/invoices", {
        data: body,
        headers: { "idempotency-key": "short" },
      })
    ).status(),
  ).toBe(422);

  // Provisioning a school twice with one key gives one school, not a duplicate-name error.
  const sch = school({ slug: `ik${run}`, ownerEmail: `ik.${run}@school-test.example` });
  const k = { "idempotency-key": `school-${run}-0001` };
  const a = await platform.post("/api/platform/schools", { data: sch, headers: k });
  const b = await platform.post("/api/platform/schools", { data: sch, headers: k });
  expect(a.status()).toBe(201);
  expect(b.status()).toBe(201);
  expect((await b.json()).school.id).toBe((await a.json()).school.id);
});

test("a plan's student limit stops further admissions", async () => {
  const detail = await (await platform.get(`/api/platform/schools/${schoolId}`)).json();
  const active = detail.counts.activeStudents;
  expect((await patch({ maxStudents: active })).status()).toBe(200);
  const classes = await (await owner.get("/api/classes")).json();
  const sectionId = classes.find((c: { name: string }) => c.name === "Class 5").sections[0].id;
  const add = await owner.post("/api/students", {
    data: {
      name: "Extra Student",
      dob: "2015-01-02",
      gender: "male",
      sectionId,
      guardian: { name: "Extra Parent", relation: "father", phone: "9811199999" },
    },
  });
  expect(add.status()).toBe(409);
  expect((await add.json()).code).toBe("LIMIT_EXCEEDED");
  expect((await patch({ maxStudents: null })).status()).toBe(200);
  expect((await patch({ maxStudents: 0 })).status()).toBe(422);
});

test("the school can read its own audit trail, nobody else's", async () => {
  const all = await (await owner.get("/api/audit-events?pageSize=100")).json();
  const actions = new Set(all.items.map((i: { action: string }) => i.action));
  for (const a of ["invoice.create", "import.commit", "import.undo", "feehead.create"])
    expect(actions.has(a), a).toBe(true);
  expect(all.items[0].by).toBeTruthy();
  const only = await (await owner.get("/api/audit-events?action=import")).json();
  expect(only.items.length).toBeGreaterThan(0);
  expect(only.items.every((i: { action: string }) => i.action.startsWith("import"))).toBe(true);
  expect((await teacher.get("/api/audit-events")).status()).toBe(403);
  const demo = await (await principal.get("/api/audit-events?action=import")).json();
  expect(demo.items).toEqual([]); // the demo school never imported anything
});
