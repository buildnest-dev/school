import { expect, request as pwRequest, test, type APIRequestContext } from "@playwright/test";

/** Opening balances: dues and payments from before the school joined. */
const PASSWORD = "ChangeMe#2026";
const base = "http://localhost:3000";
async function as(email: string): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({ baseURL: base });
  expect(
    (await ctx.post("/api/auth/login", { data: { email, password: PASSWORD } })).status(),
  ).toBe(200);
  return ctx;
}
const run = Date.now().toString(36);

test("opening balances: checked first, saved all or nothing, never twice", async () => {
  const acct = await as("accountant@demo.test");
  const teacher = await as("teacher@demo.test");
  const parent = await as("parent@demo.test");
  const post = (rows: object[], commit = false) =>
    acct.post("/api/fees/opening-balances", { data: { rows, commit } });
  const title = `Opening ${run}`;
  const good = { admissionNo: "ADM-0003", title, amount: 12500, paid: 5000, dueOn: "2026-04-30" };

  expect(
    (await teacher.post("/api/fees/opening-balances", { data: { rows: [good] } })).status(),
  ).toBe(403);
  expect(
    (await parent.post("/api/fees/opening-balances", { data: { rows: [good] } })).status(),
  ).toBe(403);

  // Problems are listed by line and nothing is saved.
  const bad = await post([
    good,
    { ...good, admissionNo: "NOPE-1", title: "x1" },
    { ...good, title: "x2", paid: 99999 },
    { ...good, title: "x3", mode: "upi" },
    { ...good, title: "x4", paidOn: "2999-01-01" },
  ]);
  expect(bad.status()).toBe(422);
  const msgs: string[] = (await bad.json()).fieldErrors.rows;
  expect(msgs.length).toBe(4);
  expect(msgs[0]).toContain("Line 2");

  // A clean check saves nothing; the commit saves everything.
  const check = await (await post([good])).json();
  expect(check).toMatchObject({ committed: false, rows: 1, totalDue: 12500, totalPaid: 5000 });
  const sid = (await (await acct.get("/api/students?q=ADM-0003")).json()).items[0].id as string;
  const find = async () =>
    (await (await acct.get(`/api/fees/invoices?studentId=${sid}&pageSize=100`)).json()).items as {
      term: string;
      paid: number;
      amount: number;
    }[];
  expect((await find()).some((i) => i.term === title)).toBe(false);
  expect((await post([good], true)).status()).toBe(201);
  const saved = (await find()).find((i) => i.term === title);
  expect(saved).toMatchObject({ amount: 12500, paid: 5000 });

  // The same item again is refused, in the file itself too.
  expect((await post([good], true)).status()).toBe(422);
  expect(
    (
      await post([
        { ...good, title: "dup" },
        { ...good, title: "dup" },
      ])
    ).status(),
  ).toBe(422);
});
