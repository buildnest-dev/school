import { expect, request as pwRequest, test, type APIRequestContext } from "@playwright/test";

/**
 * Academic-year rollover. It runs against the second fictional school so it cannot disturb the
 * demo school's classes that other specs use.
 */
const PASSWORD = "ChangeMe#2026";
const base = "http://localhost:3000";

async function as(email: string): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({ baseURL: base });
  const res = await ctx.post("/api/auth/login", { data: { email, password: PASSWORD } });
  expect(res.status(), `login ${email}`).toBe(200);
  return ctx;
}

test.describe.configure({ mode: "serial" });

type Row = { id: string; name: string; classSection: string; status: string };

let other: APIRequestContext;
let teacher: APIRequestContext;
let principal: APIRequestContext;
let repeater = "";

const students = async () =>
  (await (await other.get("/api/students?pageSize=100")).json()).items as Row[];
const roll = (data: object, ctx = other) => ctx.post("/api/academic-years/rollover", { data });
const year = { label: "2027-28", startsOn: "2027-04-01", endsOn: "2028-03-31" };

test.beforeAll(async () => {
  [other, teacher, principal] = await Promise.all([
    as("principal@other.test"),
    as("teacher@demo.test"),
    as("principal@demo.test"),
  ]);
});

test("access and validation", async () => {
  const anon = await pwRequest.newContext({ baseURL: base });
  expect((await anon.post("/api/academic-years/rollover", { data: year })).status()).toBe(401);
  expect((await roll(year, teacher)).status()).toBe(403);
  expect((await teacher.get("/api/academic-years")).status()).toBe(200);

  expect((await roll({ ...year, label: "2027" })).status()).toBe(422);
  expect((await roll({ ...year, label: "2027-29" })).status()).toBe(422);
  expect((await roll({ ...year, endsOn: "2027-03-31" })).status()).toBe(422);
  expect((await roll({ ...year, startsOn: "2026-02-30" })).status()).toBe(422);
  expect((await roll({ ...year, startsOn: "2026-01-01", endsOn: "2026-12-31" })).status()).toBe(
    422,
  ); // before current
  expect((await roll({ ...year, label: "2026-27", startsOn: "2027-04-01" })).status()).toBe(409);
  expect((await roll({ ...year, holdBack: ["nope"] })).status()).toBe(422);
});

test("preview shows what would happen and changes nothing", async () => {
  const res = await roll({ ...year, preview: true });
  expect(res.status()).toBe(200);
  const p = await res.json();
  expect(p).toMatchObject({ preview: true, promoted: 1, graduating: 1, heldBack: 0 });
  expect(p.byClass).toEqual([{ to: "Class 9 A", students: 1 }]);
  const now = await students();
  expect(now.find((s) => s.name === "Kabir Joshi")!.classSection).toBe("Class 8 A");
  expect(now.find((s) => s.name === "Riya Menon")!.status).toBe("active");
  expect((await (await other.get("/api/academic-years")).json()).items.length).toBe(1);
});

test("rollover promotes, graduates the last class and keeps held-back students", async () => {
  const classes = await (await other.get("/api/classes")).json();
  const sec8 = classes.find((c: { name: string }) => c.name === "Class 8").sections[0].id;
  const add = await other.post("/api/students", {
    data: {
      name: "Dev Sharma",
      dob: "2013-02-02",
      gender: "male",
      sectionId: sec8,
      guardian: { name: "Anil Sharma", relation: "father", phone: "9876512345" },
    },
  });
  expect(add.status()).toBe(201);
  repeater = (await add.json()).student.id;

  const res = await roll({ ...year, holdBack: [repeater] });
  expect(res.status()).toBe(201);
  expect(await res.json()).toMatchObject({
    preview: false,
    promoted: 1,
    graduating: 1,
    heldBack: 1,
  });

  const now = await students();
  expect(now.find((s) => s.name === "Kabir Joshi")!.classSection).toBe("Class 9 A"); // section created
  const riya = now.find((s) => s.name === "Riya Menon")!;
  expect((await (await other.get(`/api/students/${riya.id}`)).json()).status).toBe("alumni");
  expect(now.find((s) => s.name === "Dev Sharma")).toMatchObject({
    classSection: "Class 8 A",
    status: "active",
  });

  const years = (await (await other.get("/api/academic-years")).json()).items;
  expect(years.map((y: { label: string; current: boolean }) => [y.label, y.current])).toEqual([
    ["2027-28", true],
    ["2026-27", false],
  ]);
  expect((await roll(year)).status()).toBe(409); // not twice
});

test("other schools are untouched", async () => {
  const years = (await (await principal.get("/api/academic-years")).json()).items;
  expect(years.length).toBe(1);
  expect(years[0]).toMatchObject({ label: "2026-27", current: true });
  const classes = await (await principal.get("/api/classes")).json();
  expect(
    classes.find((c: { name: string }) => c.name === "Class 8").sections.length,
  ).toBeGreaterThan(0);
});
