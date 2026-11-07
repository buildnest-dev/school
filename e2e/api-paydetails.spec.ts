import { expect, request as pwRequest, test, type APIRequestContext } from "@playwright/test";

/** The school's own account and UPI ID, shown to its parents. */
const PASSWORD = "ChangeMe#2026";
const base = "http://localhost:3000";
async function as(email: string): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({ baseURL: base });
  expect(
    (await ctx.post("/api/auth/login", { data: { email, password: PASSWORD } })).status(),
  ).toBe(200);
  return ctx;
}

test("accountant saves payment details; parents of that school see them, others do not", async () => {
  const acct = await as("accountant@demo.test");
  const parent = await as("parent@demo.test");
  const teacher = await as("teacher@demo.test");
  const other = await as("principal@other.test");

  const good = {
    holderName: "Demo Public School",
    bankName: "State Bank of India",
    ifsc: "SBIN0001234",
    accountNumber: "123456789012",
    upiId: "demoschool@sbi",
  };
  expect((await teacher.put("/api/school/bank", { data: good })).status()).toBe(403);
  expect((await parent.put("/api/school/bank", { data: good })).status()).toBe(403);
  expect(
    (await acct.put("/api/school/bank", { data: { ...good, upiId: "no-at-sign" } })).status(),
  ).toBe(422);
  expect((await acct.put("/api/school/bank", { data: { ...good, ifsc: "BAD" } })).status()).toBe(
    422,
  );
  expect((await acct.put("/api/school/bank", { data: good })).status()).toBe(200);

  const mine = await (await acct.get("/api/school/bank")).json();
  expect(mine).toMatchObject({ set: true, upiId: "demoschool@sbi", ifsc: "SBIN0001234" });

  const seen = await (await parent.get("/api/me/payment-info")).json();
  expect(seen).toMatchObject({ set: true, upiId: "demoschool@sbi", accountNumber: "123456789012" });
  expect((await teacher.get("/api/me/payment-info")).status()).toBe(403);
  // Another school's parents/staff never see this school's details.
  expect((await other.get("/api/school/bank")).status()).toBe(200);
  expect((await (await other.get("/api/school/bank")).json()).upiId).not.toBe("demoschool@sbi");
});
