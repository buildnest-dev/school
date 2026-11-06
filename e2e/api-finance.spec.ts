import { createHmac } from "node:crypto";
import { expect, request as pwRequest, test, type APIRequestContext } from "@playwright/test";

/** Bulk billing with concessions, receipts, refunds, reminders and authenticator sign-in, in a fresh school. */
const NEW_PASSWORD = "Sunrise2026Blue";
const base = "http://localhost:3000";

async function as(email: string, password = NEW_PASSWORD, code?: string) {
  const ctx = await pwRequest.newContext({ baseURL: base });
  const res = await ctx.post("/api/auth/login", { data: { email, password, code } });
  return { ctx, res };
}
async function must(email: string, password = NEW_PASSWORD): Promise<APIRequestContext> {
  const { ctx, res } = await as(email, password);
  expect(res.status(), `login ${email}`).toBe(200);
  return ctx;
}

test.describe.configure({ mode: "serial" });

const run = Date.now().toString(36);
const slug = `fn${run}`;
const mail = (n: string) => `${n}.${run}@school-test.example`;
const ownerMail = mail("principal-office");
const acctMail = mail("cashier");
const sharedParent = mail("nairfamily");

let platform: APIRequestContext;
let owner: APIRequestContext;
let acct: APIRequestContext;
let teacher: APIRequestContext;
let parent: APIRequestContext;
let anon: APIRequestContext;
let schoolId = "";
let aarav = "";
let sectionId = "";
const invoices: Record<string, { id: string; amount: number }> = {};

const tokenFor = async (to: string) => {
  const out = await (await anon.get(`/api/dev/outbox?to=${encodeURIComponent(to)}`)).json();
  return /token=([\w-]+)/.exec(out.items[0]?.body ?? "")?.[1] ?? "";
};
const setPassword = async (to: string) =>
  expect(
    (
      await anon.post("/api/auth/reset-password", {
        data: { token: await tokenFor(to), password: NEW_PASSWORD },
      })
    ).status(),
  ).toBe(200);
const invoiceOf = async (student: string, title: string) => {
  const list = await (await owner.get(`/api/fees/invoices?q=${student}&pageSize=100`)).json();
  return list.items.find((i: { term: string }) => i.term === title) as {
    id: string;
    amount: number;
    paid: number;
    status: string;
  };
};

test("setup: a live school with three students, two of them siblings", async () => {
  platform = await must("platform@demo.test", "ChangeMe#2026");
  anon = await pwRequest.newContext({ baseURL: base });
  const made = await platform.post("/api/platform/schools", {
    data: {
      name: "Finance Test School",
      slug,
      ownerName: "Kavita Menon",
      ownerEmail: ownerMail,
      boardCodes: ["CBSE"],
      yearLabel: "2026-27",
    },
  });
  expect(made.status()).toBe(201);
  schoolId = (await made.json()).school.id;
  await setPassword(ownerMail);
  owner = await must(ownerMail);

  await owner.post("/api/classes/standard", {
    data: { includePrePrimary: false, upTo: 6, sections: ["A"] },
  });
  await owner.post("/api/fees/heads", { data: { name: "Tuition" } });
  const csv = [
    "name,dob,gender,class,section,guardian_name,guardian_relation,guardian_phone,guardian_email",
    `Aarav Nair,2015-03-04,male,Class 5,A,Suresh Nair,father,9811100011,${sharedParent}`,
    `Anaya Nair,2016-05-09,female,Class 5,A,Suresh Nair,father,9811100011,${sharedParent}`,
    "Rehan Khan,2015-07-21,male,Class 5,A,Imran Khan,father,9811100012,",
  ].join("\n");
  const pre = await (await owner.post("/api/imports/students", { data: { csv } })).json();
  expect(pre.valid).toBe(3);
  expect((await owner.post(`/api/imports/${pre.batchId}/commit`)).status()).toBe(200);
  const find = async (q: string) =>
    (await (await owner.get(`/api/students?q=${q}`)).json()).items[0].id;
  aarav = await find("Aarav");
  const classes = await (await owner.get("/api/classes")).json();
  sectionId = classes.find((c: { name: string }) => c.name === "Class 5").sections[0].id;

  // Staff: a teacher (cannot touch fees) and an accountant (the person who asks for refunds).
  for (const [name, role, email] of [
    ["Teja Rao", "teacher", mail("teja")],
    ["Charu Shah", "accountant", acctMail],
  ] as const) {
    const s = await (await owner.post("/api/staff", { data: { name, role } })).json();
    expect((await owner.post(`/api/staff/${s.staff.id}/login`, { data: { email } })).status()).toBe(
      201,
    );
    await setPassword(email);
  }
  [teacher, acct] = [await must(mail("teja")), await must(acctMail)];

  expect(
    (
      await platform.put(`/api/platform/schools/${schoolId}/bank`, {
        data: {
          holderName: "Finance Test",
          bankName: "HDFC",
          ifsc: "HDFC0001234",
          accountNumber: "9988776655443",
        },
      })
    ).status(),
  ).toBe(200);
  expect((await owner.post(`/api/students/${aarav}/guardian-login`, { data: {} })).status()).toBe(
    201,
  );
  await setPassword(sharedParent);
  const live = await platform.post(`/api/platform/schools/${schoolId}/go-live`);
  expect(live.status(), JSON.stringify(await live.json())).toBe(200);
  parent = await must(sharedParent);
});

test("bulk billing: preview first, concessions and sibling discount, never twice", async () => {
  const body = {
    sectionId,
    title: "Term 1",
    amount: 10000,
    dueOn: "2027-06-30",
    siblingDiscountPercent: 20,
  };
  expect(
    (
      await teacher.post("/api/fees/invoices/generate", { data: { ...body, preview: true } })
    ).status(),
  ).toBe(403);
  expect(
    (await owner.post("/api/fees/invoices/generate", { data: { ...body, classId: "x" } })).status(),
  ).toBe(422);
  expect(
    (
      await owner.post("/api/fees/invoices/generate", { data: { ...body, amount: 10.005 } })
    ).status(),
  ).toBe(422);

  const prev = await (
    await owner.post("/api/fees/invoices/generate", { data: { ...body, preview: true } })
  ).json();
  expect(prev).toMatchObject({
    preview: true,
    matched: 3,
    toCreate: 3,
    totalPayable: 28000,
    totalDiscount: 2000,
  });
  expect((await (await owner.get("/api/fees/invoices")).json()).total).toBe(0); // nothing saved

  const real = await owner.post("/api/fees/invoices/generate", { data: body });
  expect(real.status()).toBe(201);
  expect((await real.json()).created).toBe(3);
  const again = await (await owner.post("/api/fees/invoices/generate", { data: body })).json();
  expect(again).toMatchObject({ skipped: 3, toCreate: 0 });

  expect(await invoiceOf("Aarav", "Term 1")).toMatchObject({ amount: 10000 });
  expect(await invoiceOf("Anaya", "Term 1")).toMatchObject({ amount: 8000 }); // the younger sibling
  expect(await invoiceOf("Rehan", "Term 1")).toMatchObject({ amount: 10000 });

  // A school-wide concession and a sibling discount stack one after the other: 10000 x 0.9 x 0.8.
  const lab = { ...body, title: "Lab", discountPercent: 10, discountReason: "Scholarship" };
  await owner.post("/api/fees/invoices/generate", { data: lab });
  expect(await invoiceOf("Anaya", "Lab")).toMatchObject({ amount: 7200 });
  expect(await invoiceOf("Aarav", "Lab")).toMatchObject({ amount: 9000 });
  invoices.aarav = await invoiceOf("Aarav", "Term 1");
  invoices.rehan = await invoiceOf("Rehan", "Term 1");
});

test("receipts: numbered once, readable by the family, private to the school", async () => {
  const pay = async (id: string, amountRupees: number) =>
    (
      await (
        await acct.post(`/api/fees/invoices/${id}/payments`, {
          data: { amountRupees, mode: "cash" },
        })
      ).json()
    ).id as string;
  const p1 = await pay(invoices.aarav!.id, 6000);
  const p2 = await pay(invoices.rehan!.id, 2000);
  const r1 = await (await acct.get(`/api/fees/payments/${p1}/receipt`)).json();
  const year = new Date().getUTCFullYear();
  expect(r1.receiptNo).toBe(`RCPT-${year}-00001`);
  expect(r1).toMatchObject({
    student: { name: "Aarav Nair" },
    payment: { amount: 6000 },
    balanceNow: 4000,
  });
  expect((await (await acct.get(`/api/fees/payments/${p1}/receipt`)).json()).receiptNo).toBe(
    r1.receiptNo,
  );
  expect((await (await owner.get(`/api/fees/payments/${p2}/receipt`)).json()).receiptNo).toBe(
    `RCPT-${year}-00002`,
  );
  expect((await parent.get(`/api/fees/payments/${p1}/receipt`)).status()).toBe(200);
  expect((await parent.get(`/api/fees/payments/${p2}/receipt`)).status()).toBe(404); // not their child
  expect((await teacher.get(`/api/fees/payments/${p1}/receipt`)).status()).toBe(403);
  const demo = await must("principal@demo.test", "ChangeMe#2026");
  expect((await demo.get(`/api/fees/payments/${p1}/receipt`)).status()).toBe(404);
  Object.assign(invoices, { p1: { id: p1, amount: 6000 } });
});

test("refunds need a second person and can never exceed the payment", async () => {
  const p1 = invoices.p1!.id;
  const ask = (data: object) => acct.post(`/api/fees/payments/${p1}/refunds`, { data });
  expect(
    (
      await teacher.post(`/api/fees/payments/${p1}/refunds`, {
        data: { amount: 100, reason: "Wrong class" },
      })
    ).status(),
  ).toBe(403);
  expect((await ask({ amount: 100, reason: "x" })).status()).toBe(422);
  expect((await ask({ amount: 6000.01, reason: "Billed twice" })).status()).toBe(409);
  const r = await ask({ amount: 2500, reason: "Billed twice by mistake" });
  expect(r.status()).toBe(201);
  const refundId = (await r.json()).id;
  expect((await ask({ amount: 3600, reason: "Another claim" })).status()).toBe(409); // 2500 already pending

  expect(
    (
      await acct.post(`/api/fees/refunds/${refundId}/decision`, { data: { approve: true } })
    ).status(),
  ).toBe(403);
  // The owner asking and deciding the same refund is refused too.
  const own = await owner.post(`/api/fees/payments/${p1}/refunds`, {
    data: { amount: 100, reason: "Owner-raised refund" },
  });
  const ownId = (await own.json()).id;
  const same = await owner.post(`/api/fees/refunds/${ownId}/decision`, { data: { approve: true } });
  expect(same.status()).toBe(403);
  expect((await same.json()).code).toBe("same_person");
  expect(
    (await acct.post(`/api/fees/refunds/${ownId}/decision`, { data: { approve: true } })).status(),
  ).toBe(403); // accountants never decide

  expect(
    (
      await owner.post(`/api/fees/refunds/${refundId}/decision`, { data: { approve: true } })
    ).status(),
  ).toBe(200);
  expect(
    (
      await owner.post(`/api/fees/refunds/${refundId}/decision`, { data: { approve: true } })
    ).status(),
  ).toBe(409);
  expect(await invoiceOf("Aarav", "Term 1")).toMatchObject({ paid: 3500, status: "partial" });

  const listed = await (await owner.get("/api/fees/refunds?status=requested")).json();
  expect(listed.items.map((i: { id: string }) => i.id)).toEqual([ownId]);
  const dropped = await acct.post(`/api/fees/refunds/${ownId}/decision`, {
    data: { approve: false },
  });
  expect(dropped.status()).toBe(403);
  expect((await owner.get("/api/fees/refunds")).status()).toBe(200);
  expect((await teacher.get("/api/fees/refunds")).status()).toBe(403);
});

test("reminders: only overdue, one e-mail per guardian, not again within the gap", async () => {
  await owner.post("/api/fees/invoices/generate", {
    data: { sectionId, title: "Old fee", amount: 500, dueOn: "2026-01-10" },
  });
  const dry = await (await owner.post("/api/fees/reminders", { data: {} })).json();
  expect(dry).toMatchObject({
    dryRun: true,
    overdueInvoices: 3,
    guardiansToEmail: 1, // Aarav and Anaya share one e-mail address
    invoicesToRemind: 2,
    withoutEmail: 1, // Rehan's family left no e-mail
  });
  expect((await teacher.post("/api/fees/reminders", { data: {} })).status()).toBe(403);

  const sent = await (await owner.post("/api/fees/reminders", { data: { dryRun: false } })).json();
  expect(sent.sent).toBe(1);
  const mailBody = (
    await (await anon.get(`/api/dev/outbox?to=${encodeURIComponent(sharedParent)}`)).json()
  ).items[0].body as string;
  expect(mailBody).toContain("Aarav Nair");
  expect(mailBody).toContain("Anaya Nair");

  const next = await (await owner.post("/api/fees/reminders", { data: { dryRun: false } })).json();
  expect(next).toMatchObject({ recentlyReminded: 2, guardiansToEmail: 0, sent: 0 });
});

test("a parent sees every invoice of their child and what is still due", async () => {
  const mine = await (await parent.get("/api/me/invoices")).json();
  expect(mine.items.every((i: { studentName: string }) => i.studentName === "Aarav Nair")).toBe(
    true,
  );
  expect(mine.items.map((i: { title: string }) => i.title).sort()).toEqual([
    "Lab",
    "Old fee",
    "Term 1",
  ]);
  // Term 1: 10000 - 6000 + 2500 refunded = 6500 due; Lab 9000; Old fee 500.
  expect(mine.totalBalance).toBe(6500 + 9000 + 500);
  expect((await acct.get("/api/me/invoices")).status()).toBe(403);
});

// ---- authenticator-app sign-in (uses the accountant account of this school) ----

const totp = (secret: string, step: number) => {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secret) bits += A.indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", key).update(msg).digest();
  const o = h[h.length - 1]! & 15;
  const n = ((h[o]! & 127) << 24) | (h[o + 1]! << 16) | (h[o + 2]! << 8) | h[o + 3]!;
  return String(n % 1_000_000).padStart(6, "0");
};

test("authenticator sign-in: setup, enable, codes work once, disable", async () => {
  expect((await acct.post("/api/auth/mfa/enable", { data: { code: "123456" } })).status()).toBe(
    409,
  ); // no setup yet
  expect((await anon.post("/api/auth/mfa/setup")).status()).toBe(401);
  const setup = await (await acct.post("/api/auth/mfa/setup")).json();
  expect(setup.otpauth).toContain(`secret=${setup.secret}`);

  const step = Math.floor(Date.now() / 1000 / 30);
  expect((await acct.post("/api/auth/mfa/enable", { data: { code: "00000a" } })).status()).toBe(
    422,
  );
  expect(
    (
      await acct.post("/api/auth/mfa/enable", { data: { code: totp(setup.secret, step) } })
    ).status(),
  ).toBe(200);

  // Password alone is no longer enough.
  const noCode = await as(acctMail);
  expect(noCode.res.status()).toBe(401);
  expect((await noCode.res.json()).code).toBe("mfa_required");
  const wrong = await as(acctMail, NEW_PASSWORD, "000000");
  expect((await wrong.res.json()).code).toBe("mfa_invalid");
  // The code used to enable is spent; the next 30-second code signs in, once.
  expect((await (await as(acctMail, NEW_PASSWORD, totp(setup.secret, step))).res.json()).code).toBe(
    "mfa_invalid",
  );
  const next = totp(setup.secret, step + 1);
  const good = await as(acctMail, NEW_PASSWORD, next);
  expect(good.res.status()).toBe(200);
  expect((await (await as(acctMail, NEW_PASSWORD, next)).res.json()).code).toBe("mfa_invalid");
  expect((await good.ctx.get("/api/me")).status()).toBe(200);

  const off = (password: string, code: string) =>
    good.ctx.post("/api/auth/mfa/disable", { data: { password, code } });
  expect((await off("wrong-password-1", next)).status()).toBe(403);
  expect((await off(NEW_PASSWORD, next)).status()).toBe(200);
  expect((await as(acctMail)).res.status()).toBe(200); // password alone works again
});
