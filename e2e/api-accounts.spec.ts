import { expect, request as pwRequest, test, type APIRequestContext } from "@playwright/test";

/** Logins, invites and password reset (e-mails are read from the development outbox). */
const PASSWORD = "ChangeMe#2026";
const base = "http://localhost:3000";

async function as(email: string, password = PASSWORD): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({ baseURL: base });
  const res = await ctx.post("/api/auth/login", { data: { email, password } });
  expect(res.status(), `login ${email}`).toBe(200);
  return ctx;
}
const loginStatus = async (email: string, password: string) => {
  const ctx = await pwRequest.newContext({ baseURL: base });
  return (await ctx.post("/api/auth/login", { data: { email, password } })).status();
};

test.describe.configure({ mode: "serial" });

const run = Date.now().toString(36);
const mail = (n: string) => `${n}.${run}@school-test.example`;
const NEW_PASSWORD = "Sunrise2026Blue";

let principal: APIRequestContext;
let teacher: APIRequestContext;
let other: APIRequestContext;
let anon: APIRequestContext;
let staffId = "";
const linkFor = async (to: string, n = 0) => {
  const out = await (await anon.get(`/api/dev/outbox?to=${encodeURIComponent(to)}`)).json();
  const body: string = out.items[n]?.body ?? "";
  return /token=([\w-]+)/.exec(body)?.[1] ?? "";
};
const setPassword = (token: string, password: string) =>
  anon.post("/api/auth/reset-password", { data: { token, password } });

test.beforeAll(async () => {
  [principal, teacher, other] = await Promise.all([
    as("principal@demo.test"),
    as("teacher@demo.test"),
    as("principal@other.test"),
  ]);
  anon = await pwRequest.newContext({ baseURL: base });
});

test("staff login: an invite is e-mailed and the person chooses their own password", async () => {
  const made = await principal.post("/api/staff", {
    data: { name: "Anita Joshi", role: "teacher" },
  });
  staffId = (await made.json()).staff.id;
  const email = mail("anita");

  expect((await teacher.post(`/api/staff/${staffId}/login`, { data: { email } })).status()).toBe(
    403,
  );
  expect(
    (
      await principal.post(`/api/staff/${staffId}/login`, { data: { email: "not-an-email" } })
    ).status(),
  ).toBe(422);
  expect((await other.post(`/api/staff/${staffId}/login`, { data: { email } })).status()).toBe(404);
  const driver = await principal.post("/api/staff", {
    data: { name: "Gopal Singh", role: "driver" },
  });
  expect(
    (
      await principal.post(`/api/staff/${(await driver.json()).staff.id}/login`, {
        data: { email: mail("gopal") },
      })
    ).status(),
  ).toBe(422);

  expect((await principal.post(`/api/staff/${staffId}/login`, { data: { email } })).status()).toBe(
    201,
  );
  expect(
    (
      await principal.post(`/api/staff/${staffId}/login`, { data: { email: mail("again") } })
    ).status(),
  ).toBe(409);
  // The new account cannot be used until the person sets a password: the stored one is random.
  expect(await loginStatus(email, PASSWORD)).toBe(401);

  const token = await linkFor(email);
  expect(token.length).toBeGreaterThan(20);
  expect((await setPassword(token, "short1")).status()).toBe(422);
  expect((await setPassword(token, "onlyletterspassword")).status()).toBe(422);
  expect((await setPassword(token, `anita${run}X1`)).status()).toBe(422); // contains their e-mail name
  expect((await setPassword("x".repeat(40), NEW_PASSWORD)).status()).toBe(400);
  expect((await setPassword(token, NEW_PASSWORD)).status()).toBe(200);
  expect((await setPassword(token, "Another2026Pass")).status()).toBe(400); // a link works once

  const me = await (await as(email, NEW_PASSWORD)).get("/api/me");
  expect((await me.json()).role).toBe("teacher");
  const detail = await (await principal.get(`/api/staff/${staffId}`)).json();
  expect(detail.hasLogin).toBe(true);
});

test("forgot password: same answer for everyone, one-time link, signs out other devices", async () => {
  const email = mail("anita");
  const stale = await as(email, NEW_PASSWORD);
  expect((await stale.get("/api/me")).status()).toBe(200);

  const unknown = await anon.post("/api/auth/forgot-password", { data: { email: mail("nobody") } });
  const known = await anon.post("/api/auth/forgot-password", { data: { email } });
  expect(unknown.status()).toBe(200);
  expect(known.status()).toBe(200);
  expect(await unknown.json()).toEqual(await known.json());
  expect(
    (await (await anon.get(`/api/dev/outbox?to=${encodeURIComponent(mail("nobody"))}`)).json())
      .items,
  ).toEqual([]);

  const token = await linkFor(email); // newest first: the reset mail
  const next = "Monsoon2027Green";
  expect((await setPassword(token, next)).status()).toBe(200);
  expect(await loginStatus(email, NEW_PASSWORD)).toBe(401); // old password is gone
  expect(await loginStatus(email, next)).toBe(200);
  expect((await stale.get("/api/me")).status()).toBe(401); // old session was ended
  expect((await setPassword(token, "Third2027Passw")).status()).toBe(400);

  // Asking too often is limited.
  const spam = mail("spam");
  const codes: number[] = [];
  for (let i = 0; i < 4; i++)
    codes.push((await anon.post("/api/auth/forgot-password", { data: { email: spam } })).status());
  expect(codes).toEqual([200, 200, 200, 429]);
});

test("change password: needs the current one and ends other sessions", async () => {
  const email = mail("anita");
  const current = "Monsoon2027Green";
  const a = await as(email, current);
  const b = await as(email, current);
  const change = (body: object) => a.post("/api/auth/change-password", { data: body });

  expect(
    (
      await anon.post("/api/auth/change-password", {
        data: { currentPassword: current, newPassword: NEW_PASSWORD },
      })
    ).status(),
  ).toBe(401);
  expect(
    (await change({ currentPassword: "wrong-password-1", newPassword: NEW_PASSWORD })).status(),
  ).toBe(403);
  expect((await change({ currentPassword: current, newPassword: current })).status()).toBe(422);
  expect((await change({ currentPassword: current, newPassword: "weak" })).status()).toBe(422);
  expect((await change({ currentPassword: current, newPassword: NEW_PASSWORD })).status()).toBe(
    200,
  );

  expect((await a.get("/api/me")).status()).toBe(200); // this device stays signed in
  expect((await b.get("/api/me")).status()).toBe(401); // the other one does not
  expect(await loginStatus(email, current)).toBe(401);
  expect(await loginStatus(email, NEW_PASSWORD)).toBe(200);
});

test("parent and student logins are linked to the right records", async () => {
  const classes = await (await principal.get("/api/classes")).json();
  const sectionId = classes.find((c: { name: string }) => c.name === "Class 5").sections[0].id;
  const created = await principal.post("/api/students", {
    data: {
      name: `Ira Kapoor`,
      dob: "2014-08-19",
      gender: "female",
      sectionId,
      guardian: { name: "Neeraj Kapoor", relation: "father", phone: "9811122233" },
    },
  });
  const studentId = (await created.json()).student.id;
  const parentMail = mail("neeraj");
  const studentMail = mail("ira");

  expect(
    (
      await teacher.post(`/api/students/${studentId}/guardian-login`, {
        data: { email: parentMail },
      })
    ).status(),
  ).toBe(403);
  expect((await principal.post(`/api/students/${studentId}/guardian-login`, {})).status()).toBe(
    422,
  ); // no e-mail anywhere
  expect(
    (
      await other.post(`/api/students/${studentId}/guardian-login`, { data: { email: parentMail } })
    ).status(),
  ).toBe(404);
  expect(
    (
      await principal.post(`/api/students/${studentId}/guardian-login`, {
        data: { email: parentMail },
      })
    ).status(),
  ).toBe(201);
  expect(
    (
      await principal.post(`/api/students/${studentId}/guardian-login`, {
        data: { email: mail("x") },
      })
    ).status(),
  ).toBe(409);

  expect((await setPassword(await linkFor(parentMail), NEW_PASSWORD)).status()).toBe(200);
  const parent = await as(parentMail, NEW_PASSWORD);
  const kids = await (await parent.get("/api/me/children")).json();
  expect(kids.map((k: { name: string }) => k.name)).toEqual(["Ira Kapoor"]);

  expect(
    (
      await principal.post(`/api/students/${studentId}/login`, { data: { email: studentMail } })
    ).status(),
  ).toBe(201);
  expect(
    (
      await principal.post(`/api/students/${studentId}/login`, { data: { email: mail("y") } })
    ).status(),
  ).toBe(409);
  expect((await setPassword(await linkFor(studentMail), NEW_PASSWORD)).status()).toBe(200);
  expect(await (await (await as(studentMail, NEW_PASSWORD)).get("/api/me")).json()).toMatchObject({
    role: "student",
  });

  // The new parent cannot see anyone else's child.
  const demoKids = await (await (await as("parent@demo.test")).get("/api/me/children")).json();
  expect(
    kids.some((k: { id: string }) => demoKids.some((d: { id: string }) => d.id === k.id)),
  ).toBe(false);
  // Make sure these fixtures do not stay active for other specs.
  await principal.patch(`/api/students/${studentId}`, { data: { status: "alumni" } });
});
