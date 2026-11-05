import { expect, request as pwRequest, test, type APIRequestContext } from "@playwright/test";

/** Students and admissions API tests (seeded fictional demo schools only). */
const PASSWORD = "ChangeMe#2026";
const base = "http://localhost:3000";

async function as(email: string): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({ baseURL: base });
  const res = await ctx.post("/api/auth/login", { data: { email, password: PASSWORD } });
  expect(res.status(), `login ${email}`).toBe(200);
  return ctx;
}

test.describe.configure({ mode: "serial" });

let principal: APIRequestContext;
let teacher: APIRequestContext;
let parent: APIRequestContext;
let other: APIRequestContext;
let sectionId = "";

const child = (over: Record<string, unknown> = {}) => ({
  name: "Ishaan Bhatt",
  dob: "2015-06-12",
  gender: "male",
  sectionId,
  category: "General",
  aadhaarLast4: "4821",
  guardian: { name: "Ramesh Bhatt", relation: "father", phone: "9812345678" },
  ...over,
});

test.beforeAll(async () => {
  [principal, teacher, parent, other] = await Promise.all([
    as("principal@demo.test"),
    as("teacher@demo.test"),
    as("parent@demo.test"),
    as("principal@other.test"),
  ]);
  const classes = await (await principal.get("/api/classes")).json();
  const c5 = classes.find((c: { name: string }) => c.name === "Class 5");
  sectionId = c5.sections[0].id;
});

test("create student: validates Indian fields", async () => {
  const bad = async (over: Record<string, unknown>, field: string) => {
    const res = await principal.post("/api/students", { data: child(over) });
    expect(res.status(), field).toBe(422);
    expect(JSON.stringify((await res.json()).fieldErrors)).toContain(field);
  };
  await bad({ guardian: { name: "R B", relation: "father", phone: "12345" } }, "guardian.phone");
  await bad({ aadhaarLast4: "123456789012" }, "aadhaarLast4");
  await bad({ dob: "2099-01-01" }, "dob");
  await bad({ dob: "1950-01-01" }, "dob");
  await bad({ apaarId: "123" }, "apaarId");
  await bad({ category: "Other" }, "category");
});

test("create student: generates admission number, masks Aadhaar, normalises phone", async () => {
  const res = await principal.post("/api/students", { data: child() });
  expect(res.status()).toBe(201);
  const { student } = await res.json();
  expect(student.admissionNo).toMatch(/^ADM-\d{4}-\d{4}$/);
  expect(student.aadhaarMasked).toBe("XXXX XXXX 4821");
  expect(JSON.stringify(student)).not.toContain("aadhaarLast4");
  expect(student.guardian.phone).toBe("+91 9812345678");
  expect(student.classSection).toBe("Class 5 A");
});

test("create student: possible duplicates need explicit confirmation", async () => {
  const again = await principal.post("/api/students", { data: child() });
  expect(again.status()).toBe(409);
  expect((await again.json()).code).toBe("possible_duplicate");
  const forced = await principal.post("/api/students", { data: child({ confirmDuplicate: true }) });
  expect(forced.status()).toBe(201);
  const a = (await forced.json()).student.admissionNo;
  expect(a).toMatch(/^ADM-\d{4}-\d{4}$/);
});

test("create/update student: roles and location rules", async () => {
  expect((await teacher.post("/api/students", { data: child({ name: "Zed Roy" }) })).status()).toBe(
    403,
  );
  const states = await principal.get("/api/students"); // staff can list
  expect(states.status()).toBe(200);
  const badSection = await principal.post("/api/students", {
    data: child({ name: "Zed Roy", sectionId: "nope" }),
  });
  expect(badSection.status()).toBe(404);
  const district = await principal.post("/api/students", {
    data: child({ name: "Zed Roy", districtId: "x" }),
  });
  expect(district.status()).toBe(422); // district without state
});

test("update student: edit fields, change status, reject unknown fields", async () => {
  const list = await (await principal.get("/api/students?q=Ishaan")).json();
  const id = list.items[0].id;
  const ok = await principal.patch(`/api/students/${id}`, {
    data: { bloodGroup: "B+", status: "transferred" },
  });
  expect(ok.status()).toBe(200);
  expect((await ok.json()).student.status).toBe("transferred");
  expect((await principal.patch(`/api/students/${id}`, { data: { tenantId: "x" } })).status()).toBe(
    422,
  );
  expect(
    (await teacher.patch(`/api/students/${id}`, { data: { bloodGroup: "A+" } })).status(),
  ).toBe(403);
});

test("parents see only their own children; other schools see nothing", async () => {
  const kids = await (await parent.get("/api/me/children")).json();
  expect(kids.length).toBe(16); // the seeded guardian is linked to all 16 seeded demo students
  const mine = await parent.get(`/api/students/${kids[0].id}`);
  expect(mine.status()).toBe(200);

  const all = await (await principal.get("/api/students?pageSize=100")).json();
  const notMine = all.items.find((s: { name: string }) => s.name === "Ishaan Bhatt");
  expect((await parent.get(`/api/students/${notMine.id}`)).status()).toBe(404);
  expect((await other.get(`/api/students/${notMine.id}`)).status()).toBe(404);
  expect(
    (await other.patch(`/api/students/${notMine.id}`, { data: { bloodGroup: "A+" } })).status(),
  ).toBe(404);
  expect((await parent.get("/api/admissions/enquiries")).status()).toBe(403);
});

test("admissions pipeline: moves in order, cannot skip, admits exactly once", async () => {
  const create = await principal.post("/api/admissions/enquiries", {
    data: {
      studentName: "Tara Joshi",
      guardianName: "Meena Joshi",
      guardianPhone: "9000012345",
      source: "phone",
    },
  });
  expect(create.status()).toBe(201);
  const id = (await create.json()).id;
  const move = (stage: string) =>
    principal.patch(`/api/admissions/enquiries/${id}`, { data: { stage } });

  expect((await move("decision")).status()).toBe(409); // cannot skip
  expect((await move("enrolled")).status()).toBe(422); // only via admit
  for (const s of ["documents", "review", "decision"])
    expect((await move(s)).status(), s).toBe(200);

  const early = await principal.post(`/api/admissions/enquiries/${id}/admit`, {
    data: { sectionId: "nope" },
  });
  expect(early.status()).toBe(404);
  const first = await principal.post(`/api/admissions/enquiries/${id}/admit`, {
    data: { sectionId },
  });
  expect(first.status()).toBe(201);
  expect((await first.json()).admissionNo).toMatch(/^ADM-/);
  const second = await principal.post(`/api/admissions/enquiries/${id}/admit`, {
    data: { sectionId },
  });
  expect(second.status()).toBe(409);

  const list = await (
    await principal.get("/api/admissions/enquiries?filter[stage]=enrolled")
  ).json();
  expect(list.items.some((e: { studentName: string }) => e.studentName === "Tara Joshi")).toBe(
    true,
  );
});

test("admit needs the decision stage and cannot cross schools", async () => {
  const list = await (await principal.get("/api/admissions/enquiries?filter[stage]=new")).json();
  const newOne = list.items[0].id;
  const notReady = await principal.post(`/api/admissions/enquiries/${newOne}/admit`, {
    data: { sectionId },
  });
  expect(notReady.status()).toBe(409);
  expect(
    (
      await other.patch(`/api/admissions/enquiries/${newOne}`, { data: { stage: "documents" } })
    ).status(),
  ).toBe(404);
  const others = await (await other.get("/api/admissions/enquiries")).json();
  expect(others.total).toBe(0);
});

test("public enquiry form: validates, blocks bots, creates only a new enquiry", async () => {
  const anon = await pwRequest.newContext({
    baseURL: base,
    extraHTTPHeaders: {
      "x-forwarded-for": `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
    },
  });
  const url = "/api/public/schools/demo-school/enquiries";
  const body = { studentName: "Kiran Das", guardianName: "Anil Das", guardianPhone: "9876501234" };
  expect((await anon.post(url, { data: { ...body, guardianPhone: "123" } })).status()).toBe(422);
  expect((await anon.post(url, { data: { ...body, website: "http://spam" } })).status()).toBe(422);
  expect(
    (await anon.post("/api/public/schools/no-such-school/enquiries", { data: body })).status(),
  ).toBe(404);
  expect((await anon.post(url, { data: body })).status()).toBe(201);

  const list = await (await principal.get("/api/admissions/enquiries?q=Kiran")).json();
  expect(list.items[0].stage).toBe("new");
  expect(list.items[0].source).toBe("website");
});
