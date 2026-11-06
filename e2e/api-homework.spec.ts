import { expect, request as pwRequest, test, type APIRequestContext } from "@playwright/test";

/** Homework API tests (seeded fictional demo schools only). */
const PASSWORD = "ChangeMe#2026";
const base = "http://localhost:3000";

async function as(email: string): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({ baseURL: base });
  const res = await ctx.post("/api/auth/login", { data: { email, password: PASSWORD } });
  expect(res.status(), `login ${email}`).toBe(200);
  return ctx;
}

test.describe.configure({ mode: "serial" });

type Cls = {
  id: string;
  name: string;
  sections: { id: string; name: string }[];
  subjects: { id: string; name: string }[];
};
type Kid = { id: string; classSection: string };

const istDay = (plusDays = 0) =>
  new Date(Date.now() + 5.5 * 3600_000 + plusDays * 86400_000).toISOString().slice(0, 10);

let principal: APIRequestContext;
let teacher: APIRequestContext;
let parent: APIRequestContext;
let accountant: APIRequestContext;
let other: APIRequestContext;
let classes: Cls[] = [];
let kids: Kid[] = [];
let staffIds = { priya: "", rahul: "" };
let sec8A = "";
let maths8 = "";
let english8 = "";
let science9 = "";
let hwId = "";

test.beforeAll(async () => {
  [principal, teacher, parent, accountant, other] = await Promise.all([
    as("principal@demo.test"),
    as("teacher@demo.test"),
    as("parent@demo.test"),
    as("accountant@demo.test"),
    as("principal@other.test"),
  ]);
  classes = await (await principal.get("/api/classes")).json();
  kids = await (await parent.get("/api/me/children")).json();
  const staff = (await (await principal.get("/api/staff")).json()).items;
  staffIds = {
    priya: staff.find((s: { name: string }) => s.name === "Priya Nair").id,
    rahul: staff.find((s: { name: string }) => s.name === "Rahul Menon").id,
  };
  const c8 = classes.find((c) => c.name === "Class 8")!;
  sec8A = c8.sections.find((s) => s.name === "A")!.id;
  maths8 = c8.subjects.find((s) => s.name === "Mathematics")!.id;
  english8 = c8.subjects.find((s) => s.name === "English")!.id;
  science9 = classes
    .find((c) => c.name === "Class 9")!
    .subjects.find((s) => s.name === "Science")!.id;
});

test.afterAll(async () => {
  // Leave the shared demo timetable as we found it so other specs are unaffected.
  await principal.put(`/api/timetable/sections/${sec8A}`, { data: { periods: [] } });
});

test("access: signed out and non-academic roles are refused", async () => {
  const anon = await pwRequest.newContext({ baseURL: base });
  expect((await anon.get("/api/homework")).status()).toBe(401);
  expect((await accountant.get("/api/homework")).status()).toBe(403);
  const body = {
    sectionId: sec8A,
    subjectId: maths8,
    title: "Chapter 1",
    description: "Do it",
    dueOn: istDay(3),
  };
  expect((await accountant.post("/api/homework", { data: body })).status()).toBe(403);
  expect((await parent.post("/api/homework", { data: body })).status()).toBe(403);
});

test("a teacher can set homework only for classes and subjects they teach", async () => {
  const body = (subjectId: string) => ({
    sectionId: sec8A,
    subjectId,
    title: "Fractions worksheet",
    description: "Complete exercise 2.3, questions 1 to 10.",
    dueOn: istDay(3),
  });
  // Nothing on the timetable yet, so the teacher has no class.
  expect((await teacher.post("/api/homework", { data: body(maths8) })).status()).toBe(403);

  const set = await principal.put(`/api/timetable/sections/${sec8A}`, {
    data: {
      periods: [
        { day: 1, slot: 1, subjectId: maths8, staffId: staffIds.priya },
        { day: 1, slot: 2, subjectId: english8, staffId: staffIds.rahul },
      ],
    },
  });
  expect(set.status()).toBe(200);

  expect((await teacher.post("/api/homework", { data: body(english8) })).status()).toBe(403); // Rahul's subject
  expect((await teacher.post("/api/homework", { data: body(science9) })).status()).toBe(422); // other class
  expect(
    (
      await teacher.post("/api/homework", { data: { ...body(maths8), dueOn: istDay(-1) } })
    ).status(),
  ).toBe(422);
  expect(
    (
      await teacher.post("/api/homework", { data: { ...body(maths8), dueOn: "2026-02-30" } })
    ).status(),
  ).toBe(422);
  expect(
    (await teacher.post("/api/homework", { data: { ...body(maths8), title: "Hi" } })).status(),
  ).toBe(422);
  expect((await other.post("/api/homework", { data: body(maths8) })).status()).toBe(404);

  const ok = await teacher.post("/api/homework", { data: body(maths8) });
  expect(ok.status()).toBe(201);
  const made = (await ok.json()).homework;
  expect(made).toMatchObject({
    status: "draft",
    classSection: "Class 8 A",
    subject: "Mathematics",
  });
  expect(made.assignedOn).toBe(istDay());
  hwId = made.id;

  // The principal may set homework for any subject.
  expect(
    (
      await principal.post("/api/homework", { data: { ...body(english8), title: "Reading log" } })
    ).status(),
  ).toBe(201);
});

test("drafts stay hidden from parents; staff see them", async () => {
  const forParent = await (await parent.get("/api/homework")).json();
  expect(forParent.items.find((h: { id: string }) => h.id === hwId)).toBeUndefined();
  expect((await parent.get(`/api/homework/${hwId}`)).status()).toBe(404);
  const mine = await (await teacher.get("/api/homework")).json();
  expect(mine.items.map((h: { id: string }) => h.id)).toContain(hwId);
  // The principal's own draft is not visible to the teacher.
  expect(mine.items.some((h: { title: string }) => h.title === "Reading log")).toBe(false);
  const all = await (await principal.get(`/api/homework?sectionId=${sec8A}`)).json();
  expect(all.items.length).toBeGreaterThanOrEqual(2);
});

test("publishing: parents of that class see it with each child's status", async () => {
  expect((await teacher.patch(`/api/homework/${hwId}`, { data: { userId: "x" } })).status()).toBe(
    422,
  );
  expect(
    (await teacher.patch(`/api/homework/${hwId}`, { data: { status: "withdrawn" } })).status(),
  ).toBe(409);
  expect(
    (await teacher.patch(`/api/homework/${hwId}`, { data: { status: "published" } })).status(),
  ).toBe(200);
  expect(
    (await teacher.patch(`/api/homework/${hwId}`, { data: { status: "published" } })).status(),
  ).toBe(409);
  expect(
    (await other.patch(`/api/homework/${hwId}`, { data: { title: "Hacked title" } })).status(),
  ).toBe(404);

  const list = await (await parent.get("/api/homework")).json();
  const item = list.items.find((h: { id: string }) => h.id === hwId);
  expect(item.children.length).toBeGreaterThan(0);
  expect(item.children.every((c: { status: string }) => c.status === "pending")).toBe(true);
  const ninth = kids.find((k) => k.classSection === "Class 9 A");
  if (ninth) {
    const narrowed = await (await parent.get(`/api/homework?studentId=${ninth.id}`)).json();
    expect(narrowed.items.find((h: { id: string }) => h.id === hwId)).toBeUndefined();
  }
});

test("due dates: can extend, can never move into the past", async () => {
  expect(
    (await teacher.patch(`/api/homework/${hwId}`, { data: { dueOn: istDay(-2) } })).status(),
  ).toBe(422);
  const ext = await teacher.patch(`/api/homework/${hwId}`, {
    data: { dueOn: istDay(10), title: "Fractions worksheet 2" },
  });
  expect(ext.status()).toBe(200);
  expect((await ext.json()).homework).toMatchObject({
    dueOn: istDay(10),
    title: "Fractions worksheet 2",
  });
});

test("completion: recorded per student, validated, visible to the right parent", async () => {
  const mineKids = kids.filter((k) => k.classSection === "Class 8 A");
  expect(mineKids.length).toBeGreaterThanOrEqual(2);
  const a = mineKids[0]!;
  const b = mineKids[1]!;
  const put = (entries: unknown[], who = teacher) =>
    who.put(`/api/homework/${hwId}/completion`, { data: { entries } });

  expect((await put([{ studentId: a.id, status: "done" }], parent)).status()).toBe(403);
  expect((await put([{ studentId: a.id, status: "late" }])).status()).toBe(422);
  expect(
    (
      await put([
        { studentId: a.id, status: "done" },
        { studentId: a.id, status: "missing" },
      ])
    ).status(),
  ).toBe(422);
  const ninth = kids.find((k) => k.classSection === "Class 9 A");
  if (ninth) expect((await put([{ studentId: ninth.id, status: "done" }])).status()).toBe(422);
  expect((await put([{ studentId: "nope", status: "done" }])).status()).toBe(422);
  expect((await put([{ studentId: a.id, status: "done" }], other)).status()).toBe(404);

  expect(
    (
      await put([
        { studentId: a.id, status: "done" },
        { studentId: b.id, status: "missing", note: "Book forgotten" },
      ])
    ).status(),
  ).toBe(200);
  const detail = await (await teacher.get(`/api/homework/${hwId}`)).json();
  expect(detail.roster.find((r: { studentId: string }) => r.studentId === a.id).status).toBe(
    "done",
  );
  expect(detail.roster.find((r: { studentId: string }) => r.studentId === b.id)).toMatchObject({
    status: "missing",
    note: "Book forgotten",
  });
  expect(detail.totals.done).toBe(1);
  expect(detail.totals.missing).toBe(1);
  expect(
    detail.totals.done + detail.totals.missing + detail.totals.excused + detail.totals.pending,
  ).toBe(detail.roster.length);

  const pv = await (await parent.get(`/api/homework/${hwId}`)).json();
  expect(
    pv.roster.every((r: { studentId: string }) => mineKids.some((k) => k.id === r.studentId)),
  ).toBe(true);

  // Clearing a status puts the student back to pending.
  expect((await put([{ studentId: b.id, status: "pending" }])).status()).toBe(200);
  const again = await (await teacher.get(`/api/homework/${hwId}`)).json();
  expect(again.totals.missing).toBe(0);
});

test("drafts cannot be marked; withdrawn homework is final and disappears for parents", async () => {
  const draft = await principal.post("/api/homework", {
    data: {
      sectionId: sec8A,
      subjectId: maths8,
      title: "Another one",
      description: "Later",
      dueOn: istDay(5),
    },
  });
  const draftId = (await draft.json()).homework.id;
  const kid = kids.find((k) => k.classSection === "Class 8 A")!;
  expect(
    (
      await principal.put(`/api/homework/${draftId}/completion`, {
        data: { entries: [{ studentId: kid.id, status: "done" }] },
      })
    ).status(),
  ).toBe(409);

  expect(
    (await teacher.patch(`/api/homework/${hwId}`, { data: { status: "withdrawn" } })).status(),
  ).toBe(200);
  expect(
    (await teacher.patch(`/api/homework/${hwId}`, { data: { title: "Too late edit" } })).status(),
  ).toBe(409);
  expect((await parent.get(`/api/homework/${hwId}`)).status()).toBe(404);
  const list = await (await parent.get("/api/homework")).json();
  expect(list.items.find((h: { id: string }) => h.id === hwId)).toBeUndefined();
});

test("another school sees none of this school's homework", async () => {
  expect((await (await other.get("/api/homework")).json()).items).toEqual([]);
  expect((await other.get(`/api/homework/${hwId}`)).status()).toBe(404);
});
