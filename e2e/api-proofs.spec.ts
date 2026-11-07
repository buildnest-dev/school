import { expect, request as pwRequest, test, type APIRequestContext } from "@playwright/test";

/** A parent's payment screenshot, checked and approved by the accountant. */
const PASSWORD = "ChangeMe#2026";
const base = "http://localhost:3000";
// A tiny valid JPEG, padded so it clears the minimum size.
const JPEG = Buffer.concat([
  Buffer.from(
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
    "base64",
  ),
  Buffer.alloc(80, 0),
]).toString("base64");

async function as(email: string): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({ baseURL: base });
  expect(
    (await ctx.post("/api/auth/login", { data: { email, password: PASSWORD } })).status(),
  ).toBe(200);
  return ctx;
}
const run = Date.now().toString(36);

test("screenshot proof: upload, review, approve once, reject, no duplicate transaction ids", async () => {
  const [parent, acct, teacher, other] = await Promise.all([
    as("parent@demo.test"),
    as("accountant@demo.test"),
    as("teacher@demo.test"),
    as("principal@other.test"),
  ]);
  const kids = await (await parent.get("/api/me/children")).json();
  const studentId: string = (Array.isArray(kids) ? kids : kids.items)[0].id;
  const inv = await acct.post("/api/fees/invoices", {
    data: { studentId, title: `Proof test ${run}`, amount: 3000, dueOn: "2027-05-01" },
  });
  expect(inv.status()).toBe(201);
  const invoice = await inv.json();

  const send = (data: object) => parent.post("/api/payment-proofs", { data });
  const good = { studentId, amountRupees: 1000, reference: `UTR${run}A`, image: JPEG };
  expect(
    (
      await send({
        ...good,
        image: Buffer.from("not an image at all, just text".repeat(8)).toString("base64"),
      })
    ).status(),
  ).toBe(422);
  expect((await send({ ...good, studentId: "someone-elses" })).status()).toBe(404);
  expect((await teacher.post("/api/payment-proofs", { data: good })).status()).toBe(403);
  const made = await send(good);
  expect(made.status()).toBe(201);
  const p1 = (await made.json()).proof;
  expect(p1).toMatchObject({ status: "pending", amount: 1000 });

  // Who can see it.
  const pend = await (await acct.get("/api/payment-proofs")).json();
  expect(pend.items.map((x: { id: string }) => x.id)).toContain(p1.id);
  expect((await teacher.get("/api/payment-proofs")).status()).toBe(403);
  expect((await other.get(`/api/payment-proofs/${p1.id}/image`)).status()).toBe(404);
  const img = await acct.get(`/api/payment-proofs/${p1.id}/image`);
  expect(img.status()).toBe(200);
  expect(img.headers()["content-type"]).toBe("image/jpeg");
  expect((await parent.get(`/api/payment-proofs/${p1.id}/image`)).status()).toBe(200);

  const decide = (id: string, data: object) =>
    acct.post(`/api/payment-proofs/${id}/decision`, { data });
  expect(
    (
      await teacher.post(`/api/payment-proofs/${p1.id}/decision`, {
        data: { approve: false, note: "no" },
      })
    ).status(),
  ).toBe(403);
  expect((await decide(p1.id, { approve: false })).status()).toBe(422); // a reason is required
  expect((await decide(p1.id, { approve: true, invoiceId: "nope" })).status()).toBe(404);

  expect((await decide(p1.id, { approve: true, invoiceId: invoice.id })).status()).toBe(200);
  const after = (await (await acct.get(`/api/fees/invoices?q=${invoice.number}`)).json()).items[0];
  expect(after.paid).toBe(1000);
  expect((await decide(p1.id, { approve: true, invoiceId: invoice.id })).status()).toBe(409); // once only

  // The same transaction id cannot be counted twice.
  const p2 = (await (await send({ ...good, amountRupees: 500 })).json()).proof;
  const dup = await decide(p2.id, { approve: true, invoiceId: invoice.id });
  expect(dup.status()).toBe(409);
  expect((await dup.json()).code).toBe("reference_used");
  // Too much for the invoice.
  const p3 = (await (await send({ ...good, amountRupees: 99999, reference: `UTR${run}B` })).json())
    .proof;
  expect((await decide(p3.id, { approve: true, invoiceId: invoice.id })).status()).toBe(422);
  // Reject keeps no payment, and the parent sees why.
  expect(
    (await decide(p2.id, { approve: false, note: "Not in the bank statement" })).status(),
  ).toBe(200);
  const mine = await (await parent.get(`/api/payment-proofs?studentId=${studentId}`)).json();
  const seen = mine.items.find((x: { id: string }) => x.id === p2.id);
  expect(seen).toMatchObject({ status: "rejected", reviewNote: "Not in the bank statement" });
  expect(
    (await (await acct.get(`/api/fees/invoices?q=${invoice.number}`)).json()).items[0].paid,
  ).toBe(1000);
});
