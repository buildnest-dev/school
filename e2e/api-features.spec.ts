import { expect, request as pwRequest, test, type APIRequestContext } from "@playwright/test";

/**
 * ZAQSA switches features off for one school. Same rules as api.spec.ts: seeded demo schools,
 * server on :3000.
 */
const PASSWORD = "ChangeMe#2026";
const base = "http://localhost:3000";
const headers = { Origin: base };

async function as(email: string): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({ baseURL: base, extraHTTPHeaders: headers });
  const res = await ctx.post("/api/auth/login", { data: { email, password: PASSWORD } });
  expect(res.status(), `login ${email}`).toBe(200);
  return ctx;
}

test.describe.configure({ mode: "serial" });

let platform: APIRequestContext;
let principal: APIRequestContext;
let accountant: APIRequestContext;
let librarian: APIRequestContext;
let transport: APIRequestContext;
let parent: APIRequestContext;
let other: APIRequestContext;
let schoolId = "";
// Other tests count the seeded classes, so children added here leave the school again.
let addedId = "";
const off = ["admissions", "fees", "library", "transport", "registers-safety-gate"];
const set = (disabled: string[]) =>
  platform.put(`/api/platform/schools/${schoolId}/features`, { data: { disabled } });

test.beforeAll(async () => {
  [platform, principal, accountant, librarian, transport, parent, other] = await Promise.all([
    as("platform@demo.test"),
    as("principal@demo.test"),
    as("accountant@demo.test"),
    as("librarian@demo.test"),
    as("transport@demo.test"),
    as("parent@demo.test"),
    as("principal@other.test"),
  ]);
  const list = await (await platform.get("/api/platform/features")).json();
  schoolId = list.schools.find((s: { name: string }) => s.name.startsWith("Demo Public")).id;
});

test.afterAll(async () => {
  await set([]);
  // Moved to the first class as well: the report card tests list every student of classes 8 and 9.
  const [first] = await (await principal.get("/api/classes")).json();
  if (addedId)
    await principal.patch(`/api/students/${addedId}`, {
      data: { status: "transferred", sectionId: first.sections[0].id },
    });
});

test("only the ZAQSA team can switch features, and only real ones", async () => {
  const path = `/api/platform/schools/${schoolId}/features`;
  expect((await principal.put(path, { data: { disabled: [] } })).status()).toBe(403);
  expect((await principal.get("/api/platform/features")).status()).toBe(403);
  expect((await set(["everything"])).status()).toBe(422);
});

test("a switched-off feature stops answering for that school only, and comes back", async () => {
  const child = (await (await parent.get("/api/me/children")).json())[0].id;
  expect((await transport.get("/api/transport/routes")).status()).toBe(200);
  const booksBefore = await (await librarian.get("/api/library/books")).text();

  expect((await set(off)).status()).toBe(200);
  const blocked = await transport.get("/api/transport/routes");
  expect(blocked.status()).toBe(403);
  expect((await blocked.json()).code).toBe("feature_off");
  expect((await librarian.get("/api/library/books")).status()).toBe(403);
  expect((await accountant.get("/api/fees/heads")).status()).toBe(403);
  expect((await parent.get(`/api/me/children/${child}/ledger`)).status()).toBe(403);
  expect((await principal.get("/api/records/visitors")).status()).toBe(403);
  expect((await principal.get("/api/admissions/enquiries")).status()).toBe(403);
  const anon = await pwRequest.newContext({ baseURL: base, extraHTTPHeaders: headers });
  const form = await anon.post("/api/public/schools/demo-school/enquiries", {
    data: { studentName: "Web Child", guardianName: "Web Parent", guardianPhone: "9876543210" },
  });
  expect(form.status()).toBe(404);

  // Everything else, and every other school, is untouched.
  expect((await principal.get("/api/students")).status()).toBe(200);
  expect((await principal.get("/api/records/clubs")).status()).toBe(200);
  expect((await other.get("/api/transport/routes")).status()).toBe(200);
  expect((await (await principal.get("/api/me")).json()).disabledFeatures).toEqual(off);

  // A new admission is not sent to desks the school does not have.
  const classes = await (await principal.get("/api/classes")).json();
  // A class that already has students, so no other test finds a new class to look after.
  const sectionId = (classes as { sections: { id: string; students: number }[] }[])
    .flatMap((c) => c.sections)
    .find((x) => x.students > 0)!.id;
  const added = await principal.post("/api/students", {
    data: {
      name: "Switch Child",
      dob: "2016-01-09",
      gender: "male",
      sectionId,
      needsBus: true,
      guardian: { name: "Anil Das", relation: "father", phone: "9876511111" },
    },
  });
  expect(added.status()).toBe(201);
  const { id, informed, missed } = await added.json();
  addedId = id;
  for (const desk of ["Accountant", "Librarian", "Transport in-charge"])
    expect([...informed, ...missed]).not.toContain(desk);

  expect((await set([])).status()).toBe(200);
  expect((await transport.get("/api/transport/routes")).status()).toBe(200);
  expect(await (await librarian.get("/api/library/books")).text()).toBe(booksBefore);
});
