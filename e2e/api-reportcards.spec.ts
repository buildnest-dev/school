import { expect, request as pwRequest, test, type APIRequestContext } from "@playwright/test";

/** Boards, exams and report-card API tests (seeded fictional demo schools only). */
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

let principal: APIRequestContext;
let teacher: APIRequestContext;
let parent: APIRequestContext;
let other: APIRequestContext;
let classes: Cls[] = [];
let examId = "";

test.beforeAll(async () => {
  [principal, teacher, parent, other] = await Promise.all([
    as("principal@demo.test"),
    as("teacher@demo.test"),
    as("parent@demo.test"),
    as("principal@other.test"),
  ]);
  classes = await (await principal.get("/api/classes")).json();
});

test("boards: reference list covers national, international, open and every state", async () => {
  const boards = await (await principal.get("/api/boards")).json();
  const codes = boards.map((b: { code: string }) => b.code);
  for (const c of [
    "CBSE",
    "ICSE",
    "ISC",
    "NIOS",
    "IB",
    "CAMBRIDGE",
    "STATE-MAHARASHTRA",
    "STATE-TAMIL-NADU",
  ])
    expect(codes, c).toContain(c);
  expect(boards.length).toBe(42);
  const anon = await pwRequest.newContext({ baseURL: base });
  expect((await anon.get("/api/boards")).status()).toBe(401);
});

test("school boards: default CBSE scale, one default only, roles enforced", async () => {
  const mine = await (await principal.get("/api/school/boards")).json();
  expect(mine).toHaveLength(1);
  expect(mine[0].code).toBe("CBSE");
  expect(mine[0].isDefault).toBe(true);
  expect(mine[0].scale[0].name).toBe("A1");

  const all = await (await principal.get("/api/boards")).json();
  const icse = all.find((b: { code: string }) => b.code === "ICSE").id;
  const cbse = all.find((b: { code: string }) => b.code === "CBSE").id;
  expect(
    (
      await teacher.put("/api/school/boards", {
        data: { boards: [{ boardId: cbse, isDefault: true }] },
      })
    ).status(),
  ).toBe(403);
  const twoDefaults = await principal.put("/api/school/boards", {
    data: {
      boards: [
        { boardId: cbse, isDefault: true },
        { boardId: icse, isDefault: true },
      ],
    },
  });
  expect(twoDefaults.status()).toBe(422);
  const bad = await principal.put("/api/school/boards", {
    data: { boards: [{ boardId: "nope", isDefault: true }] },
  });
  expect(bad.status()).toBe(422);
  const ok = await principal.put("/api/school/boards", {
    data: { boards: [{ boardId: cbse, isDefault: true }, { boardId: icse }] },
  });
  expect(ok.status()).toBe(200);
  expect((await (await principal.get("/api/school/boards")).json()).length).toBe(2);
});

test("custom grading scale: validated, saved, and resettable", async () => {
  const mine = await (await principal.get("/api/school/boards")).json();
  const icse = mine.find((b: { code: string }) => b.code === "ICSE");
  const url = `/api/school/boards/${icse.boardId}/scale`;
  const gap = await principal.put(url, {
    data: {
      scale: [
        { name: "P", from: 50, to: 100, remark: "" },
        { name: "F", from: 0, to: 40, remark: "" },
      ],
    },
  });
  expect(gap.status()).toBe(422);
  expect((await gap.json()).message).toMatch(/gap/);
  const good = await principal.put(url, {
    data: {
      scale: [
        { name: "Pass", from: 40, to: 100, remark: "Passed" },
        { name: "Fail", from: 0, to: 39, remark: "Failed" },
      ],
    },
  });
  expect(good.status()).toBe(200);
  const after = (await (await principal.get("/api/school/boards")).json()).find(
    (b: { code: string }) => b.code === "ICSE",
  );
  expect(after.customScale).toBe(true);
  expect(after.scale.map((s: { name: string }) => s.name)).toEqual(["Pass", "Fail"]);
  expect((await principal.put(url, { data: { scale: null } })).status()).toBe(200);
  expect((await teacher.put(url, { data: { scale: null } })).status()).toBe(403);
  // The other school follows ICSE too (its own link), so use CBSE, which it does not follow.
  const cbseId = mine.find((b: { code: string }) => b.code === "CBSE").boardId;
  const crossSchool = await other.put(`/api/school/boards/${cbseId}/scale`, {
    data: { scale: null },
  });
  expect(crossSchool.status()).toBe(404);
  // Its own edit never changes the scale of the demo school.
  await other.put(url, {
    data: {
      scale: [
        { name: "X", from: 0, to: 49, remark: "" },
        { name: "Y", from: 50, to: 100, remark: "" },
      ],
    },
  });
  const still = (await (await principal.get("/api/school/boards")).json()).find(
    (b: { code: string }) => b.code === "ICSE",
  );
  expect(still.customScale).toBe(false);
});

test("exams: create with validation, no duplicates, board must be followed", async () => {
  const bad = await principal.post("/api/exams", { data: { name: "X", maxMarks: 0 } });
  expect(bad.status()).toBe(422);
  const wrongBoard = await principal.post("/api/exams", {
    data: { name: "Unit Test", boardId: "nope" },
  });
  expect(wrongBoard.status()).toBe(422);
  const res = await principal.post("/api/exams", {
    data: { name: "Unit Test", maxMarks: 50, passPercent: 40 },
  });
  expect(res.status()).toBe(201);
  examId = (await res.json()).id;
  expect((await principal.post("/api/exams", { data: { name: "Unit Test" } })).status()).toBe(409);
  expect((await teacher.post("/api/exams", { data: { name: "Other" } })).status()).toBe(403);
});

test("approval and publishing are refused while any mark sheet is missing", async () => {
  const res = await principal.post(`/api/exams/${examId}/approve`, { data: { approved: true } });
  expect(res.status()).toBe(409);
  expect((await res.json()).code).toBe("incomplete");
  const pub = await principal.post(`/api/exams/${examId}/publish`, { data: { published: true } });
  expect(pub.status()).toBe(409);
});

test("marks use the exam's max marks; fill every sheet of every class", async () => {
  const over = classes.find((c) => c.name === "Class 8")!;
  const sec = over.sections[0]!;
  const sheet = await (
    await principal.get(
      `/api/marks/classes/${sec.id}?examId=${examId}&subjectId=${over.subjects[0]!.id}`,
    )
  ).json();
  expect(sheet.maxMarks).toBe(50);
  // The demo teacher has no class on the timetable, so cannot touch these marks.
  expect(
    (
      await teacher.get(
        `/api/marks/classes/${sec.id}?examId=${examId}&subjectId=${over.subjects[0]!.id}`,
      )
    ).status(),
  ).toBe(403);
  const ids: string[] = sheet.roster.map((r: { id: string }) => r.id);
  const tooHigh = await principal.put(
    `/api/marks/classes/${sec.id}?examId=${examId}&subjectId=${over.subjects[0]!.id}`,
    {
      data: { marks: { [ids[0]!]: 51 }, submit: false },
    },
  );
  expect(tooHigh.status()).toBe(422);

  // Everyone gets 40/50 (80%) in every subject, except the very first student of Class 8 A:
  // 10/50 (20%) in the subject named "Science", which is below the 40% pass mark.
  for (const c of classes.filter((x) => ["Class 8", "Class 9"].includes(x.name))) {
    for (const s of c.sections) {
      for (const sub of c.subjects) {
        const q = `examId=${examId}&subjectId=${sub.id}`;
        const sh = await (await principal.get(`/api/marks/classes/${s.id}?${q}`)).json();
        const marks = Object.fromEntries(
          sh.roster.map((r: { id: string }, i: number) => [
            r.id,
            c.name === "Class 8" && s.name === "A" && i === 0 && sub.name === "Science" ? 10 : 40,
          ]),
        );
        const put = await principal.put(`/api/marks/classes/${s.id}?${q}`, {
          data: { marks, submit: true },
        });
        expect(put.status(), `${c.name}${s.name} ${sub.name}`).toBe(200);
      }
    }
  }
});

test("class result sheet: totals, grades, fail rule, ranks and summary", async () => {
  const c8 = classes.find((c) => c.name === "Class 8")!;
  const r = await (
    await principal.get(`/api/report-cards/classes/${c8.sections[0]!.id}?examId=${examId}`)
  ).json();
  expect(r.board).toBe("CBSE");
  expect(r.summary).toMatchObject({ students: 4, complete: 4, passed: 3, failed: 1 });
  const rows = r.rows as {
    total: number;
    percent: number;
    grade: string;
    result: string;
    rank: number;
  }[];
  const failed = rows.find((x) => x.result === "fail")!;
  expect(failed.total).toBe(40 + 40 + 10);
  expect(failed.percent).toBe(60);
  expect(failed.grade).toBe("C1"); // 60% is C1 (51-60) on the CBSE scale even though one subject failed
  const passed = rows.filter((x) => x.result === "pass");
  expect(passed.every((x) => x.total === 120 && x.percent === 80 && x.grade === "B1")).toBe(true);
  expect(passed.map((x) => x.rank)).toEqual([1, 1, 1]); // equal totals share rank 1
  expect(failed.rank).toBe(4);
  expect((await parent.get(`/api/report-cards/classes/${c8.sections[0]!.id}`)).status()).toBe(403);
  expect((await other.get(`/api/report-cards/classes/${c8.sections[0]!.id}`)).status()).toBe(404);
});

test("parents cannot see report cards until results are published", async () => {
  const kids = await (await parent.get("/api/me/children")).json();
  const kid = kids[0];
  const before = await (await parent.get(`/api/report-cards/students/${kid.id}`)).json();
  expect(before.cards).toEqual([]);
  expect((await parent.get(`/api/report-cards/students/${kid.id}?examId=${examId}`)).status()).toBe(
    404,
  );
  const staff = await (
    await principal.get(`/api/report-cards/students/${kid.id}?examId=${examId}`)
  ).json();
  expect(staff.cards[0].exam.published).toBe(false);

  expect(
    (await teacher.post(`/api/exams/${examId}/publish`, { data: { published: true } })).status(),
  ).toBe(403);
});

test("publish releases results to the linked parent only", async () => {
  // Class 8 and 9 are done; the other classes have no students, so nothing else blocks publishing.
  // Publishing needs the marks to be approved first.
  const early = await principal.post(`/api/exams/${examId}/publish`, { data: { published: true } });
  expect(early.status()).toBe(409);
  expect((await early.json()).code).toBe("not_approved");
  expect(
    (await teacher.post(`/api/exams/${examId}/approve`, { data: { approved: true } })).status(),
  ).toBe(403);
  const appr = await principal.post(`/api/exams/${examId}/approve`, { data: { approved: true } });
  expect(appr.status(), JSON.stringify(await appr.json())).toBe(200);
  const pub = await principal.post(`/api/exams/${examId}/publish`, { data: { published: true } });
  expect(pub.status(), JSON.stringify(await pub.json())).toBe(200);

  const kids = await (await parent.get("/api/me/children")).json();
  const card = (
    await (await parent.get(`/api/report-cards/students/${kids[0].id}?examId=${examId}`)).json()
  ).cards[0];
  expect(card.exam.name).toBe("Unit Test");
  expect(card.subjects.map((s: { subject: string }) => s.subject).sort()).toEqual([
    "English",
    "Mathematics",
    "Science",
  ]);
  expect(card.maxTotal).toBe(150);
  expect(card.scale[0].name).toBe("A1");

  const all = await (await principal.get("/api/students?pageSize=100")).json();
  // Only the seeded Class 8/9 students are the parent's; other specs add unrelated students elsewhere.
  const sheetOwner = all.items.find(
    (s: { id: string; classSection: string }) =>
      /^Class [89] /.test(s.classSection) && !kids.some((k: { id: string }) => k.id === s.id),
  );
  expect(sheetOwner).toBeUndefined(); // the seeded guardian is linked to all seeded students
  expect((await other.get(`/api/report-cards/students/${kids[0].id}`)).status()).toBe(404);

  expect(
    (await principal.post(`/api/exams/${examId}/publish`, { data: { published: false } })).status(),
  ).toBe(200);
  const hidden = await (await parent.get(`/api/report-cards/students/${kids[0].id}`)).json();
  expect(hidden.cards).toEqual([]);
});

test("a student added after marks were entered shows an incomplete card, never a fake result", async () => {
  const c9 = classes.find((c) => c.name === "Class 9")!;
  const create = await principal.post("/api/students", {
    data: {
      name: "Late Joiner",
      dob: "2012-03-04",
      gender: "male",
      sectionId: c9.sections[0]!.id,
      guardian: { name: "Test Parent", relation: "father", phone: "9123456780" },
    },
  });
  expect(create.status()).toBe(201);
  const id = (await create.json()).id;
  const card = (
    await (await principal.get(`/api/report-cards/students/${id}?examId=${examId}`)).json()
  ).cards[0];
  expect(card.result).toBe("incomplete");
  expect(card.grade).toBeNull();
  expect(card.rank).toBeNull();
});
