import { expect, request as pwRequest, test, type APIRequestContext } from "@playwright/test";

/**
 * Study material, lesson plans, teacher messages, achievements, documents, parent profile, staff
 * roles and invites. Same rules as api.spec.ts: seeded demo schools, server on :3000.
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

let teacher: APIRequestContext;
let principal: APIRequestContext;
let accountant: APIRequestContext;
let parent: APIRequestContext;
let other: APIRequestContext;
let childId = "";
let sectionId = "";
let subjectId = "";
let studentInClass = "";

test.beforeAll(async () => {
  [teacher, principal, accountant, parent, other] = await Promise.all([
    // teacher2 has a seeded timetable; teacher@demo.test deliberately has none.
    as("teacher2@demo.test"),
    as("principal@demo.test"),
    as("accountant@demo.test"),
    as("parent@demo.test"),
    as("principal@other.test"),
  ]);
  childId = (await (await parent.get("/api/me/children")).json())[0].id;
});

test("a teacher shares material only with a class they teach, and the family sees it", async () => {
  const pairs = await (await teacher.get("/api/teacher/class-subjects")).json();
  expect(pairs.length).toBeGreaterThan(0);
  ({ sectionId, subjectId } = pairs[0]);
  const bad = await teacher.post("/api/materials", {
    data: { sectionId, subjectId, title: "Bad link", link: "javascript:alert(1)" },
  });
  expect(bad.status()).toBe(422);
  const made = await teacher.post("/api/materials", {
    data: { sectionId, subjectId, title: "Worksheet one", link: "https://example.com/a.pdf" },
  });
  expect(made.status()).toBe(201);
  const { id } = await made.json();
  expect((await accountant.get("/api/materials")).status()).toBe(403);
  expect((await other.delete(`/api/materials/${id}`)).status()).toBe(404);
  expect((await parent.get(`/api/me/children/${childId}/materials`)).status()).toBe(200);
  expect((await teacher.delete(`/api/materials/${id}`)).status()).toBe(200);
});

test("a class teacher can use their own class even without periods in it", async () => {
  const classes = await (await principal.get("/api/classes")).json();
  const section = classes.find((c: { name: string }) => c.name === "Class 7").sections[0];
  const staff = (await (await principal.get("/api/staff?pageSize=100")).json()).items;
  const neha = staff.find((x: { name: string }) => x.name === "Neha Kapoor").id;
  const assign = (staffId: string | null) =>
    principal.put(`/api/sections/${section.id}/class-teacher`, { data: { staffId } });
  const mine = async () =>
    (await (await teacher.get("/api/teacher/class-subjects")).json()).filter(
      (p: { sectionId: string }) => p.sectionId === section.id,
    );
  expect(await mine()).toHaveLength(0);
  expect((await assign(neha)).status()).toBe(200);
  try {
    expect((await mine()).length).toBeGreaterThan(0);
  } finally {
    await assign(null);
  }
});

test("lesson plans belong to their teacher", async () => {
  const made = await teacher.post("/api/teacher/lessons", {
    data: { sectionId, subjectId, title: "Lesson one", plannedOn: "2026-11-30" },
  });
  expect(made.status()).toBe(201);
  const { id } = await made.json();
  expect(
    (await teacher.patch(`/api/teacher/lessons/${id}`, { data: { status: "taught" } })).status(),
  ).toBe(200);
  expect((await principal.get("/api/teacher/lessons")).status()).toBe(403);
  expect((await teacher.delete(`/api/teacher/lessons/${id}`)).status()).toBe(200);
});

test("teacher messages and achievements stay inside the teacher's classes", async () => {
  const box = await (await teacher.get("/api/teacher/messages")).json();
  studentInClass = box.students[0].id;
  expect(
    (
      await teacher.post("/api/teacher/messages", {
        data: { studentId: studentInClass, body: "Good work today." },
      })
    ).status(),
  ).toBe(201);
  expect(
    (
      await teacher.post("/api/teacher/messages", {
        data: { studentId: "nobody", body: "Hello" },
      })
    ).status(),
  ).toBe(404);
  const prize = {
    studentId: studentInClass,
    title: "Debate prize",
    category: "academic",
    awardedOn: "2026-11-01",
  };
  expect((await teacher.post("/api/achievements", { data: prize })).status()).toBe(201);
  expect((await other.post("/api/achievements", { data: prize })).status()).toBe(404);
  expect((await parent.post("/api/achievements", { data: prize })).status()).toBe(403);
});

test("a parent reads only their own child's records and edits only their phone", async () => {
  for (const what of ["messages", "documents", "achievements"]) {
    expect((await parent.get(`/api/me/children/${childId}/${what}`)).status(), what).toBe(200);
    expect((await parent.get(`/api/me/children/nobody/${what}`)).status(), what).toBe(404);
  }
  expect((await parent.get("/api/me/profile")).status()).toBe(200);
  expect((await parent.patch("/api/me/profile", { data: { phone: "9876501234" } })).status()).toBe(
    200,
  );
  expect((await parent.patch("/api/me/profile", { data: { phone: "12" } })).status()).toBe(422);
});

test("invites are resent only by the owner or principal, to people with a login", async () => {
  const staff = (await (await principal.get("/api/staff?pageSize=100")).json()).items;
  const withLogin = staff.find(
    (s: { hasLogin: boolean; role: string }) => s.hasLogin && s.role !== "principal",
  );
  expect((await principal.post(`/api/staff/${withLogin.id}/invite`)).status()).toBe(200);
  expect((await teacher.post(`/api/staff/${withLogin.id}/invite`)).status()).toBe(403);
  expect((await other.post(`/api/staff/${withLogin.id}/invite`)).status()).toBe(404);
});

test("a school verifies only its own certificate numbers", async () => {
  const check = async (who: APIRequestContext) =>
    who.get("/api/certificates/verify?serial=NO-SUCH-NUMBER");
  expect(await (await check(principal)).json()).toEqual({ valid: false });
  expect((await check(teacher)).status()).toBe(403);
  expect((await check(parent)).status()).toBe(403);
});

test("the school can preview the year rollover without changing anything", async () => {
  const preview = await principal.post("/api/academic-years/rollover", {
    data: { label: "2031-32", startsOn: "2031-04-01", endsOn: "2032-03-31", preview: true },
  });
  expect(preview.status()).toBe(200);
  const years = await (await principal.get("/api/academic-years")).json();
  expect(years.items.some((y: { label: string }) => y.label === "2031-32")).toBe(false);
});
