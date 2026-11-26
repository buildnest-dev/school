import { expect, request as pwRequest, test, type APIRequestContext } from "@playwright/test";

/**
 * Registers, staff day, homework answers, tests, polls, read receipts, files, stock, payroll and
 * reports. Same rules as api.spec.ts: seeded demo schools, server on :3000.
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

let principal: APIRequestContext;
let teacher: APIRequestContext;
let accountant: APIRequestContext;
let librarian: APIRequestContext;
let parent: APIRequestContext;
let student: APIRequestContext;
let other: APIRequestContext;
let childId = "";
let studentId = "";
let sectionId = "";
let subjectId = "";
const run = Date.now().toString(36);
const today = new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);
const later = (days: number) =>
  new Date(Date.parse(today) + days * 86_400_000).toISOString().slice(0, 10);

test.beforeAll(async () => {
  [principal, teacher, accountant, librarian, parent, student, other] = await Promise.all([
    as("principal@demo.test"),
    as("teacher2@demo.test"),
    as("accountant@demo.test"),
    as("librarian@demo.test"),
    as("parent@demo.test"),
    as("student@demo.test"),
    as("principal@other.test"),
  ]);
  studentId = (await (await student.get("/api/me/children")).json())[0].id;
  childId = studentId;
  const pairs = await (await teacher.get("/api/teacher/class-subjects")).json();
  ({ sectionId, subjectId } = pairs[0]);
});

test("registers: a parent asks, the office decides, others cannot see or change it", async () => {
  const made = await parent.post("/api/records/gate-passes", {
    data: {
      title: `Dentist ${run}`,
      studentId: childId,
      status: "approved",
      data: { date: later(1), time: "11:00", pickup: "Father" },
    },
  });
  expect(made.status()).toBe(201);
  const list = async (who: APIRequestContext) =>
    (await (await who.get("/api/records/gate-passes")).json()).items as {
      id: string;
      title: string;
      status: string;
    }[];
  const mine = (await list(parent)).find((r) => r.title === `Dentist ${run}`)!;
  expect(mine.status, "a parent cannot approve their own request").toBe("requested");
  expect(
    (
      await principal.patch(`/api/records/gate-passes/${mine.id}`, { data: { status: "approved" } })
    ).status(),
  ).toBe(200);
  expect(
    (
      await parent.patch(`/api/records/gate-passes/${mine.id}`, { data: { status: "released" } })
    ).ok(),
  ).toBe(false);
  expect((await other.delete(`/api/records/gate-passes/${mine.id}`)).status()).toBe(404);
  expect((await list(other)).some((r) => r.id === mine.id)).toBe(false);
  expect((await parent.get("/api/records/infirmary")).status()).toBe(404);
  expect((await accountant.get("/api/records/counselling")).status()).toBe(404);
  // Anyone may report a worry, but reads only what they sent themselves.
  for (const key of ["counselling", "safeguarding"]) {
    const subject = `Private ${run} ${key}`;
    expect(
      (await principal.post(`/api/records/${key}`, { data: { title: subject } })).status(),
    ).toBe(201);
    const seen = await (await parent.get(`/api/records/${key}`)).json();
    expect(JSON.stringify(seen), key).not.toContain(subject);
  }
});

test("registers: a hall cannot be booked twice for the same time", async () => {
  const book = (from: string, to: string) =>
    principal.post("/api/records/bookings", {
      data: {
        title: `Rehearsal ${run}`,
        status: "approved",
        data: { facility: "Auditorium", date: "2027-01-12", from, to },
      },
    });
  const first = await book("09:00", "10:00");
  // A rerun against the same database finds the slot already taken.
  expect([201, 409]).toContain(first.status());
  expect((await book("09:30", "10:30")).status()).toBe(409);
});

test("staff attendance feeds cover lessons", async () => {
  // The next Monday that is not in the future for attendance: the latest one up to today.
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  const monday = d.toISOString().slice(0, 10);
  const day = await (await principal.get(`/api/staff-attendance?date=${monday}`)).json();
  const neha = day.rows.find((r: { name: string }) => r.name === "Neha Kapoor");
  const save = (status: string) =>
    principal.put("/api/staff-attendance", {
      data: { date: monday, rows: [{ staffId: neha.staffId, status }] },
    });
  expect((await teacher.get("/api/staff-attendance")).status()).toBe(403);
  expect((await save("absent")).status()).toBe(200);
  try {
    const cover = await (await principal.get(`/api/substitutions?date=${monday}`)).json();
    expect(cover.needs.length).toBeGreaterThan(0);
    const need = cover.needs.find((n: { free: unknown[] }) => n.free.length);
    if (need && !need.coverId) {
      const body = {
        date: monday,
        sectionId: need.sectionId,
        slot: need.slot,
        coverStaffId: need.free[0].id,
      };
      expect((await teacher.post("/api/substitutions", { data: body })).status()).toBe(403);
      expect((await principal.post("/api/substitutions", { data: body })).status()).toBe(201);
      expect((await principal.post("/api/substitutions", { data: body })).status()).toBe(409);
      const after = await (await principal.get(`/api/substitutions?date=${monday}`)).json();
      const id = after.needs.find((n: { coverId: string | null }) => n.coverId).coverId;
      expect((await other.delete(`/api/substitutions/${id}`)).status()).toBe(404);
      expect((await principal.delete(`/api/substitutions/${id}`)).status()).toBe(200);
    }
  } finally {
    await save("present");
  }
});

test("a homework answer goes to the teacher and is locked after checking", async () => {
  const hw = await teacher.post("/api/homework", {
    data: {
      sectionId,
      subjectId,
      title: `Answer me ${run}`,
      description: "Solve question one.",
      dueOn: later(3),
      publish: true,
    },
  });
  expect(hw.ok()).toBe(true);
  const path = `/api/me/children/${studentId}/homework-submissions`;
  const work = (await (await student.get(path)).json()).find(
    (h: { title: string }) => h.title === `Answer me ${run}`,
  );
  expect(work, "the student's class has the homework").toBeTruthy();
  expect((await student.post(path, { data: { homeworkId: work.id } })).status()).toBe(422);
  const send = () => student.post(path, { data: { homeworkId: work.id, text: "x = 4" } });
  expect((await send()).status()).toBe(200);
  const inbox = await (await teacher.get("/api/homework-submissions")).json();
  const row = inbox.find((r: { homework: string }) => r.homework === `Answer me ${run}`);
  expect((await other.patch("/api/homework-submissions", { data: { id: row.id } })).status()).toBe(
    404,
  );
  expect(
    (
      await teacher.patch("/api/homework-submissions", {
        data: { id: row.id, grade: "A", feedback: "Good" },
      })
    ).status(),
  ).toBe(200);
  expect((await send()).status()).toBe(409);
});

test("an online test hides answers, marks on the server and allows one attempt", async () => {
  const made = await teacher.post("/api/quizzes", {
    data: {
      sectionId,
      subjectId,
      title: `Quick ${run}`,
      durationMin: 5,
      questions: [{ text: "Two plus two?", options: ["3", "4"], answer: 1 }],
    },
  });
  expect(made.status()).toBe(201);
  const { id } = await made.json();
  const url = `/api/me/children/${studentId}/quizzes/${id}`;
  expect((await student.post(url, { data: { action: "start" } })).status()).toBe(404);
  expect((await teacher.patch(`/api/quizzes/${id}`, { data: { status: "open" } })).status()).toBe(
    200,
  );
  expect((await parent.post(url, { data: { action: "start" } })).status()).toBe(403);
  const start = await student.post(url, { data: { action: "start" } });
  expect(start.status()).toBe(200);
  expect(JSON.stringify(await start.json())).not.toContain('"answer"');
  const sent = await student.post(url, { data: { action: "submit", answers: [1] } });
  expect(await sent.json()).toMatchObject({ score: 1, total: 1 });
  expect((await student.post(url, { data: { action: "submit", answers: [1] } })).status()).toBe(
    409,
  );
  expect((await teacher.delete(`/api/quizzes/${id}`)).status()).toBe(409);
});

test("a parent replies to a teacher's note", async () => {
  expect(
    (
      await teacher.post("/api/teacher/messages", {
        data: { studentId: childId, body: `Note ${run}` },
      })
    ).status(),
  ).toBe(201);
  const path = `/api/me/children/${childId}/messages`;
  const note = (await (await parent.get(path)).json()).find(
    (m: { body: string }) => m.body === `Note ${run}`,
  );
  expect(
    (await parent.patch(path, { data: { messageId: note.id, reply: "Thank you" } })).status(),
  ).toBe(200);
  const box = await (await teacher.get("/api/teacher/messages")).json();
  expect(box.sent.some((m: { reply: string }) => m.reply === "Thank you")).toBe(true);
});

test("polls give one vote each and only to their audience", async () => {
  const body = { question: `Which day ${run}?`, options: ["Mon", "Tue"], audience: "parents" };
  expect((await teacher.post("/api/polls", { data: body })).status()).toBe(403);
  expect((await principal.post("/api/polls", { data: body })).status()).toBe(201);
  const find = async (who: APIRequestContext) =>
    (await (await who.get("/api/polls")).json()).find(
      (p: { question: string }) => p.question === body.question,
    );
  expect(await find(teacher)).toBeUndefined();
  const poll = await find(parent);
  expect(poll.counts).toBeNull();
  expect((await teacher.post(`/api/polls/${poll.id}`, { data: { choice: 0 } })).status()).toBe(404);
  expect((await other.post(`/api/polls/${poll.id}`, { data: { choice: 0 } })).status()).toBe(404);
  expect((await parent.post(`/api/polls/${poll.id}`, { data: { choice: 0 } })).status()).toBe(200);
  expect((await parent.post(`/api/polls/${poll.id}`, { data: { choice: 1 } })).status()).toBe(409);
});

test("read receipts are visible to the school head only", async () => {
  const mine = await (await parent.get("/api/acknowledgements")).json();
  expect(mine.length).toBeGreaterThan(0);
  expect(mine[0].readers).toBeNull();
  const noticeId = mine[0].id;
  expect((await parent.post("/api/acknowledgements", { data: { noticeId } })).status()).toBe(200);
  expect((await other.post("/api/acknowledgements", { data: { noticeId } })).status()).toBe(404);
  const head = await (await principal.get("/api/acknowledgements")).json();
  expect(head.find((n: { id: string }) => n.id === noticeId).readers.length).toBeGreaterThan(0);
});

test("files are checked, downloadable by the family and closed to everyone else", async () => {
  const data = Buffer.from("%PDF-1.4 birth certificate").toString("base64");
  const body = { entity: "student", entityId: childId, name: "birth.pdf", data };
  expect(
    (
      await parent.post("/api/attachments", {
        data: { ...body, data: Buffer.from("<script>alert(1)</script>").toString("base64") },
      })
    ).status(),
  ).toBe(422);
  expect((await student.post("/api/attachments", { data: body })).status()).toBe(404);
  expect((await other.post("/api/attachments", { data: body })).status()).toBe(404);
  expect((await accountant.post("/api/attachments", { data: body })).status()).toBe(404);
  expect((await parent.post("/api/attachments", { data: body })).status()).toBe(201);
  const list = await (
    await parent.get(`/api/attachments?entity=student&entityId=${childId}`)
  ).json();
  const file = await parent.get(`/api/attachments/${list[0].id}`);
  expect(file.status()).toBe(200);
  expect(file.headers()["content-disposition"]).toContain("attachment");
  expect(file.headers()["x-content-type-options"]).toBe("nosniff");
  expect((await other.get(`/api/attachments/${list[0].id}`)).status()).toBe(404);
  expect((await teacher.get(`/api/attachments/${list[0].id}`)).status()).toBe(404);
  expect((await parent.delete(`/api/attachments/${list[0].id}`)).status()).toBe(200);
});

test("stock never goes below zero", async () => {
  const name = `Chalk ${run}`;
  expect(
    (
      await librarian.post("/api/stock", { data: { name, category: "Stationery", qty: 5 } })
    ).status(),
  ).toBe(201);
  const item = (await (await librarian.get("/api/stock")).json()).items.find(
    (i: { name: string }) => i.name === name,
  );
  const move = (who: APIRequestContext, change: number) =>
    who.post(`/api/stock/${item.id}`, { data: { change } });
  expect((await move(librarian, -9)).status()).toBe(409);
  expect((await move(other, -1)).status()).toBe(404);
  expect((await move(teacher, -1)).status()).toBe(403);
  const both = await Promise.all([move(librarian, -4), move(librarian, -4)]);
  expect(both.map((r) => r.status()).sort()).toEqual([200, 409]);
});

test("payroll is private and a paid slip is kept", async () => {
  expect((await principal.get("/api/payroll")).status()).toBe(403);
  const month = today.slice(0, 7);
  const sheet = await (await accountant.get(`/api/payroll?month=${month}`)).json();
  const neha = sheet.rows.find((r: { name: string }) => r.name === "Neha Kapoor");
  const salary = {
    staffId: neha.staffId,
    earnings: [{ label: "Basic", rupees: 30000 }],
    deductions: [{ label: "Advance", rupees: 500 }],
  };
  expect((await accountant.put("/api/payroll", { data: salary })).status()).toBe(200);
  // Another school's principal has no payroll rights at all.
  expect((await other.put("/api/payroll", { data: salary })).status()).toBe(403);
  expect((await accountant.post("/api/payroll", { data: { month } })).status()).toBe(200);
  const slip = (await (await accountant.get(`/api/payroll?month=${month}`)).json()).rows.find(
    (r: { name: string }) => r.name === "Neha Kapoor",
  ).slip;
  if (slip.status === "draft") {
    expect((await teacher.get(`/api/payroll/${slip.id}`)).status()).toBe(404);
    expect((await accountant.patch(`/api/payroll/${slip.id}`, { data: {} })).status()).toBe(200);
  }
  expect((await teacher.get(`/api/payroll/${slip.id}`)).status()).toBe(200);
  expect((await librarian.get(`/api/payroll/${slip.id}`)).status()).toBe(404);
  expect((await accountant.delete(`/api/payroll/${slip.id}`)).status()).toBe(409);
  expect((await (await teacher.get("/api/me/payslips")).json()).length).toBeGreaterThan(0);
});

test("reports give each role only its own lists", async () => {
  const sets = async (who: APIRequestContext) =>
    (await (await who.get("/api/reports/builder")).json()).datasets.map(
      (d: { key: string }) => d.key,
    );
  expect(await sets(accountant)).toEqual(["fees"]);
  expect((await accountant.get("/api/reports/builder?dataset=students")).status()).toBe(404);
  expect((await teacher.get("/api/reports/builder")).status()).toBe(403);
  for (const key of await sets(principal))
    expect((await principal.get(`/api/reports/builder?dataset=${key}`)).status(), key).toBe(200);
  expect((await principal.get("/api/reports/early-warning")).status()).toBe(200);
  expect((await teacher.get("/api/reports/early-warning")).status()).toBe(403);
});

test("printable papers stay with the school and the child's own parent", async () => {
  expect((await principal.get(`/api/students/${childId}/documents`)).status()).toBe(200);
  expect((await other.get(`/api/students/${childId}/documents`)).status()).toBe(404);
  expect((await teacher.get(`/api/students/${childId}/documents`)).status()).toBe(403);
});
