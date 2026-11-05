import { expect, request as pwRequest, test, type APIRequestContext } from "@playwright/test";

/** Staff directory and timetable API tests (seeded fictional demo schools only). */
const PASSWORD = "ChangeMe#2026";
const base = "http://localhost:3000";

async function as(email: string): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({ baseURL: base });
  const res = await ctx.post("/api/auth/login", { data: { email, password: PASSWORD } });
  expect(res.status(), `login ${email}`).toBe(200);
  return ctx;
}

test.describe.configure({ mode: "serial" });

type Staff = { id: string; employeeNo: string; name: string; role: string; status: string };
type Cls = {
  id: string;
  name: string;
  sections: { id: string; name: string }[];
  subjects: { id: string; name: string }[];
};

let principal: APIRequestContext;
let teacher: APIRequestContext;
let parent: APIRequestContext;
let accountant: APIRequestContext;
let other: APIRequestContext;
let staff: Staff[] = [];
let classes: Cls[] = [];

const byName = (n: string) => staff.find((s) => s.name === n)!;
const sectionOf = (cls: string, sec: string) => {
  const c = classes.find((x) => x.name === cls)!;
  return { section: c.sections.find((s) => s.name === sec)!, subjects: c.subjects };
};
const subject = (subs: Cls["subjects"], n: string) => subs.find((s) => s.name === n)!.id;

test.beforeAll(async () => {
  [principal, teacher, parent, accountant, other] = await Promise.all([
    as("principal@demo.test"),
    as("teacher@demo.test"),
    as("parent@demo.test"),
    as("accountant@demo.test"),
    as("principal@other.test"),
  ]);
  staff = (await (await principal.get("/api/staff")).json()).items;
  classes = await (await principal.get("/api/classes")).json();
});

test("staff directory: only owner/principal, and only this school's people", async () => {
  const anon = await pwRequest.newContext({ baseURL: base });
  expect((await anon.get("/api/staff")).status()).toBe(401);
  for (const who of [teacher, parent, accountant])
    expect((await who.get("/api/staff")).status()).toBe(403);
  expect(staff.length).toBeGreaterThanOrEqual(4);
  expect(staff.map((s) => s.employeeNo)).toContain("EMP-2026-0001");
  const mine = await (await principal.get("/api/staff?role=teacher")).json();
  expect(mine.items.every((s: Staff) => s.role === "teacher")).toBe(true);
  expect((await (await other.get("/api/staff")).json()).items).toEqual([]);
});

test("add staff: validates, numbers automatically, blocks duplicates", async () => {
  expect(
    (
      await principal.post("/api/staff", {
        data: { name: "Test Teacher", role: "teacher", phone: "12345" },
      })
    ).status(),
  ).toBe(422);
  expect(
    (await principal.post("/api/staff", { data: { name: "X", role: "teacher" } })).status(),
  ).toBe(422);
  expect(
    (await principal.post("/api/staff", { data: { name: "Test Teacher", role: "king" } })).status(),
  ).toBe(422);
  expect(
    (
      await teacher.post("/api/staff", { data: { name: "Test Teacher", role: "teacher" } })
    ).status(),
  ).toBe(403);

  const ok = await principal.post("/api/staff", {
    data: {
      name: "Kavita Joshi",
      role: "teacher",
      designation: "Teacher, Hindi",
      phone: "9876543210",
      joinedOn: "2026-06-01",
    },
  });
  expect(ok.status()).toBe(201);
  const made = (await ok.json()).staff;
  expect(made.employeeNo).toMatch(/^EMP-\d{4}-\d{4}$/);
  expect(made.phone).toBe("+91 9876543210");
  expect(made.joinedOn).toBe("2026-06-01");

  const dup = await principal.post("/api/staff", {
    data: { name: "Someone Else", role: "teacher", phone: "+91-9876543210" },
  });
  expect(dup.status()).toBe(409);

  // Another school can use the same phone: uniqueness is per school.
  const otherOk = await other.post("/api/staff", {
    data: { name: "Kavita Joshi", role: "teacher", phone: "9876543210" },
  });
  expect(otherOk.status()).toBe(201);
  expect((await otherOk.json()).staff.employeeNo).toMatch(/-0001$/);

  staff = (await (await principal.get("/api/staff")).json()).items;
  expect(byName("Kavita Joshi").id).toBe(made.id);
});

test("edit staff: partial update, unknown fields refused, no cross-school access", async () => {
  const k = byName("Kavita Joshi");
  expect(
    (
      await principal.patch(`/api/staff/${k.id}`, { data: { designation: "Head of Hindi" } })
    ).status(),
  ).toBe(200);
  const detail = await (await principal.get(`/api/staff/${k.id}`)).json();
  expect(detail.designation).toBe("Head of Hindi");
  expect(detail.name).toBe("Kavita Joshi");
  expect((await principal.patch(`/api/staff/${k.id}`, { data: { userId: "x" } })).status()).toBe(
    422,
  );
  expect((await other.get(`/api/staff/${k.id}`)).status()).toBe(404);
  expect(
    (await other.patch(`/api/staff/${k.id}`, { data: { name: "Hacked Name" } })).status(),
  ).toBe(404);
  expect(
    (await teacher.patch(`/api/staff/${k.id}`, { data: { name: "Hacked Name" } })).status(),
  ).toBe(403);
});

test("bell schedule: everyone reads, only principal writes, times must make sense", async () => {
  const seen = await (await parent.get("/api/timetable/bell-schedule")).json();
  expect(seen.length).toBe(8);
  expect(seen.find((s: { slot: number }) => s.slot === 4).isBreak).toBe(true);
  const slot = (n: number, s: string, e: string, isBreak = false) => ({
    slot: n,
    label: `P${n}`,
    startsAt: s,
    endsAt: e,
    isBreak,
  });
  const put = (p: APIRequestContext, slots: unknown[]) =>
    p.put("/api/timetable/bell-schedule", { data: { slots } });
  expect((await put(teacher, seen)).status()).toBe(403);
  expect((await put(principal, [slot(1, "08:00", "25:00")])).status()).toBe(422);
  expect((await put(principal, [slot(1, "09:00", "08:00")])).status()).toBe(422);
  expect(
    (await put(principal, [slot(1, "08:00", "09:00"), slot(2, "08:30", "09:30")])).status(),
  ).toBe(422);
  expect(
    (await put(principal, [slot(1, "08:00", "09:00"), slot(1, "09:00", "10:00")])).status(),
  ).toBe(422);
  // Another school sets its own schedule without touching ours.
  expect((await put(other, [slot(1, "09:00", "09:45")])).status()).toBe(200);
  expect((await (await parent.get("/api/timetable/bell-schedule")).json()).length).toBe(8);
});

test("timetable save: rejects breaks, wrong-class subjects, unknown or non-teaching staff", async () => {
  const { section, subjects } = sectionOf("Class 9", "A");
  const eng = subject(subjects, "English");
  const maths = subject(subjects, "Mathematics");
  const rahul = byName("Rahul Menon").id;
  const priya = byName("Priya Nair").id;
  const put = (periods: unknown[], who = principal) =>
    who.put(`/api/timetable/sections/${section.id}`, { data: { periods } });

  expect((await put([{ day: 1, slot: 4, subjectId: eng, staffId: rahul }])).status()).toBe(422); // break
  expect((await put([{ day: 1, slot: 9, subjectId: eng, staffId: rahul }])).status()).toBe(422); // no such slot
  expect((await put([{ day: 8, slot: 1, subjectId: eng }])).status()).toBe(422);
  const otherClassSubject = subject(sectionOf("Class 8", "A").subjects, "English");
  expect((await put([{ day: 1, slot: 1, subjectId: otherClassSubject }])).status()).toBe(422);
  expect(
    (await put([{ day: 1, slot: 1, subjectId: eng, staffId: byName("Vikram Singh").id }])).status(),
  ).toBe(422);
  expect((await put([{ day: 1, slot: 1, subjectId: eng, staffId: "nope" }])).status()).toBe(422);
  expect(
    (
      await put([
        { day: 1, slot: 1, subjectId: eng },
        { day: 1, slot: 1, subjectId: maths },
      ])
    ).status(),
  ).toBe(422);
  expect((await put([{ day: 1, slot: 1, subjectId: eng }], teacher)).status()).toBe(403);
  // Nothing above was saved.
  expect(
    (await (await principal.get(`/api/timetable/sections/${section.id}`)).json()).periods,
  ).toEqual([]);

  const ok = await put([
    { day: 1, slot: 1, subjectId: eng, staffId: rahul, room: "R-9A" },
    { day: 1, slot: 2, subjectId: maths, staffId: priya },
    { day: 2, slot: 1, subjectId: maths },
  ]);
  expect(ok.status()).toBe(200);
  const got = await (await principal.get(`/api/timetable/sections/${section.id}`)).json();
  expect(got.classSection).toBe("Class 9 A");
  expect(
    got.periods.map((p: { dayName: string; slot: number }) => `${p.dayName}/${p.slot}`),
  ).toEqual(["Monday/1", "Monday/2", "Tuesday/1"]);
  expect(got.periods[0]).toMatchObject({
    subject: "English",
    teacher: "Rahul Menon",
    room: "R-9A",
  });

  // Saving again replaces the week rather than adding to it.
  expect(
    (
      await put([
        { day: 1, slot: 1, subjectId: eng, staffId: rahul },
        { day: 1, slot: 2, subjectId: maths, staffId: priya },
      ])
    ).status(),
  ).toBe(200);
  expect(
    (await (await principal.get(`/api/timetable/sections/${section.id}`)).json()).periods.length,
  ).toBe(2);
});

test("a teacher cannot be in two classes at once, and a refused save keeps the old week", async () => {
  const { section, subjects } = sectionOf("Class 9", "B");
  const eng = subject(subjects, "English");
  const rahul = byName("Rahul Menon").id;
  const sunita = byName("Sunita Rao").id;
  const put = (periods: unknown[]) =>
    principal.put(`/api/timetable/sections/${section.id}`, { data: { periods } });

  expect((await put([{ day: 3, slot: 1, subjectId: eng, staffId: sunita }])).status()).toBe(200);
  const clash = await put([
    { day: 3, slot: 2, subjectId: eng, staffId: sunita },
    { day: 1, slot: 1, subjectId: eng, staffId: rahul }, // Rahul teaches 9A on Monday slot 1
  ]);
  expect(clash.status()).toBe(409);
  expect((await clash.json()).message).toContain("Class 9 A");
  const kept = await (await principal.get(`/api/timetable/sections/${section.id}`)).json();
  expect(kept.periods.length).toBe(1); // the earlier week is untouched
  // The same teacher at a different time is fine.
  expect((await put([{ day: 1, slot: 3, subjectId: eng, staffId: rahul }])).status()).toBe(200);
});

test("reading timetables: parents only for their child's class, teachers only their own week", async () => {
  const nine = sectionOf("Class 9", "A").section.id;
  const empty = sectionOf("Class 5", "A").section.id; // no students, so no parent link
  expect((await parent.get(`/api/timetable/sections/${nine}`)).status()).toBe(200);
  expect((await parent.get(`/api/timetable/sections/${empty}`)).status()).toBe(404);
  expect(
    (await parent.put(`/api/timetable/sections/${nine}`, { data: { periods: [] } })).status(),
  ).toBe(403);
  expect((await other.get(`/api/timetable/sections/${nine}`)).status()).toBe(404);
  expect(
    (await other.put(`/api/timetable/sections/${nine}`, { data: { periods: [] } })).status(),
  ).toBe(404);

  const priya = byName("Priya Nair").id;
  const mine = await (await teacher.get(`/api/timetable/staff/${priya}`)).json();
  expect(mine.periods.length).toBe(1);
  expect(mine.periods[0]).toMatchObject({
    classSection: "Class 9 A",
    subject: "Mathematics",
    slot: 2,
  });
  expect((await teacher.get(`/api/timetable/staff/${byName("Rahul Menon").id}`)).status()).toBe(
    403,
  );
  expect((await principal.get(`/api/timetable/staff/${byName("Rahul Menon").id}`)).status()).toBe(
    200,
  );
  expect((await other.get(`/api/timetable/staff/${priya}`)).status()).toBe(404);
  expect((await parent.get(`/api/timetable/staff/${priya}`)).status()).toBe(403);
});

test("bell slots that hold lessons cannot be removed", async () => {
  const cur = await (await principal.get("/api/timetable/bell-schedule")).json();
  const withoutSlot2 = cur.filter((s: { slot: number }) => s.slot !== 2);
  const res = await principal.put("/api/timetable/bell-schedule", {
    data: { slots: withoutSlot2 },
  });
  expect(res.status()).toBe(409);
  expect(
    (await principal.put("/api/timetable/bell-schedule", { data: { slots: cur } })).status(),
  ).toBe(200);
});

test("class teacher: active teachers only, same school only; deactivating frees everything", async () => {
  const nine = sectionOf("Class 9", "A").section.id;
  const priya = byName("Priya Nair").id;
  const set = (who: APIRequestContext, staffId: string | null) =>
    who.put(`/api/sections/${nine}/class-teacher`, { data: { staffId } });
  expect((await set(teacher, priya)).status()).toBe(403);
  expect((await set(principal, byName("Vikram Singh").id)).status()).toBe(422);
  expect((await set(principal, "nope")).status()).toBe(422);
  expect((await set(other, priya)).status()).toBe(404);
  expect((await set(principal, priya)).status()).toBe(200);
  const detail = await (await principal.get(`/api/staff/${priya}`)).json();
  expect(detail.classTeacherOf).toEqual([{ sectionId: nine, label: "Class 9 A" }]);
  expect(detail.periodsPerWeek).toBe(1);

  // A teacher who still teaches cannot just be re-roled.
  expect((await principal.patch(`/api/staff/${priya}`, { data: { role: "admin" } })).status()).toBe(
    409,
  );

  const off = await principal.patch(`/api/staff/${priya}`, { data: { status: "inactive" } });
  expect(off.status()).toBe(200);
  expect((await off.json()).unassignedPeriods).toBe(1);
  const after = await (await principal.get(`/api/staff/${priya}`)).json();
  expect(after.classTeacherOf).toEqual([]);
  expect(after.periodsPerWeek).toBe(0);
  // The lesson stays on the class timetable, just without a teacher.
  const week = await (await principal.get(`/api/timetable/sections/${nine}`)).json();
  expect(
    week.periods.find((p: { slot: number; day: number }) => p.day === 1 && p.slot === 2).teacher,
  ).toBeNull();
  // An inactive teacher cannot be scheduled again.
  const { subjects } = sectionOf("Class 9", "A");
  const back = await principal.put(`/api/timetable/sections/${nine}`, {
    data: {
      periods: [{ day: 5, slot: 1, subjectId: subject(subjects, "Science"), staffId: priya }],
    },
  });
  expect(back.status()).toBe(422);
  expect(
    (await principal.patch(`/api/staff/${priya}`, { data: { status: "active" } })).status(),
  ).toBe(200);
});
