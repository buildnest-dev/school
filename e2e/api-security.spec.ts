import { expect, request as pwRequest, test } from "@playwright/test";

/** Things an attacker would try. Each of these once worked or could have; they must stay closed. */
const base = "http://localhost:3000";
const PASSWORD = "ChangeMe#2026";

const as = async (email: string) => {
  const c = await pwRequest.newContext({ baseURL: base });
  expect((await c.post("/api/auth/login", { data: { email, password: PASSWORD } })).status()).toBe(
    200,
  );
  return c;
};

test("push: only the browsers' own push services are accepted", async () => {
  const parent = await as("parent@demo.test");
  const keys = { p256dh: "x".repeat(20), auth: "y".repeat(16) };
  for (const endpoint of [
    "http://127.0.0.1:9/x",
    "https://169.254.169.254/latest/meta-data",
    "https://evil.example/push",
    "https://fcm.googleapis.com.evil.example/x",
    "https://user:pass@fcm.googleapis.com/x",
  ]) {
    const res = await parent.post("/api/push/subscribe", { data: { endpoint, keys } });
    expect(res.status(), endpoint).toBe(422);
  }
  const ok = await parent.post("/api/push/subscribe", {
    data: { endpoint: "https://fcm.googleapis.com/fcm/send/abc123", keys },
  });
  expect(ok.status()).toBe(201);
});

test("login: guessing one person's password is stopped even if the address keeps changing", async () => {
  let stopped = false;
  for (let i = 0; i < 40 && !stopped; i++) {
    const c = await pwRequest.newContext({
      baseURL: base,
      extraHTTPHeaders: { "x-forwarded-for": `10.77.${i}.${i}` },
    });
    const res = await c.post("/api/auth/login", {
      data: { email: "guess-target@demo.test", password: `wrong-${i}` },
    });
    stopped = res.status() === 429;
  }
  expect(stopped).toBe(true);
});

test("a broken request body is a 400, not a server error", async () => {
  const c = await pwRequest.newContext({ baseURL: base });
  const res = await c.post("/api/auth/login", {
    headers: { "content-type": "application/json" },
    data: Buffer.from("{not json"),
  });
  expect(res.status()).toBe(400);
  expect((await res.json()).code).toBe("bad_json");
});

test("every response carries the browser protections", async () => {
  const c = await pwRequest.newContext({ baseURL: base });
  const h = (await c.get("/sign-in")).headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["content-security-policy"]).toContain("object-src 'none'");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["referrer-policy"]).toBeTruthy();
  expect(h["permissions-policy"]).toContain("camera=()");
  const api = (await c.get("/api/public/products")).headers();
  expect(api["x-content-type-options"]).toBe("nosniff");
});

test("a school cannot read or change another school's records", async () => {
  const demo = await as("principal@demo.test");
  const other = await as("principal@other.test");
  const students = (await (await demo.get("/api/students?pageSize=5")).json()).items;
  expect(students.length).toBeGreaterThan(0);
  const id = students[0].id;
  expect((await demo.get(`/api/students/${id}`)).status()).toBe(200);
  expect((await other.get(`/api/students/${id}`)).status()).toBe(404);
  expect(
    (await other.patch(`/api/students/${id}`, { data: { name: "Hacked" } })).status(),
  ).toBeGreaterThanOrEqual(400);
  const ids = new Set(students.map((s: { id: string }) => s.id));
  const theirs = (await (await other.get("/api/students?pageSize=100")).json()).items;
  expect(theirs.some((s: { id: string }) => ids.has(s.id))).toBe(false);
});

test("payment screenshots: only the family and the school's finance staff can open one", async () => {
  const parent = await as("parent@demo.test");
  const kid = (await (await parent.get("/api/me/children")).json())[0].id;
  const jpeg = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    Buffer.alloc(200, 1),
  ]).toString("base64");
  const made = await parent.post("/api/payment-proofs", {
    data: { studentId: kid, amountRupees: 10, reference: `SEC${Date.now()}`, image: jpeg },
  });
  expect(made.status()).toBe(201);
  const id = (await made.json()).proof.id;
  for (const who of [
    "teacher@demo.test",
    "student@demo.test",
    "principal@other.test",
    "platform@demo.test",
  ]) {
    const c = await as(who);
    expect((await c.get(`/api/payment-proofs/${id}/image`)).status(), who).not.toBe(200);
    expect(
      (
        await c.post(`/api/payment-proofs/${id}/decision`, {
          data: { decision: "reject", note: "x" },
        })
      ).status(),
      who,
    ).toBeGreaterThanOrEqual(400);
  }
  const staff = await as("accountant@demo.test");
  const img = await staff.get(`/api/payment-proofs/${id}/image`);
  expect(img.status()).toBe(200);
  expect(img.headers()["content-type"]).toBe("image/jpeg");
});
