import { expect, request as pwRequest, test, type APIRequestContext } from "@playwright/test";

/**
 * A new admission reaches every desk that has work to do, and the bus request reaches transport.
 * Same rules as api.spec.ts: seeded demo schools, server on :3000.
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

const desks = ["principal", "accountant", "librarian", "transport", "teacher2"] as const;
type Desk = (typeof desks)[number];
const who = {} as Record<Desk | "parent" | "other", APIRequestContext>;
let sectionId = "";
// Other tests count the seeded classes, so children added here leave the school again.
const added: string[] = [];
const run = Date.now()
  .toString(36)
  .replace(/\d/g, (d) => "abcdefghij"[Number(d)]!);

const inbox = async (c: APIRequestContext, name: string) =>
  (
    (await (await c.get("/api/me/notifications")).json()).items as {
      title: string;
      body: string;
      url: string;
    }[]
  ).filter((n) => n.title.includes(name));

test.beforeAll(async () => {
  for (const d of desks) who[d] = await as(`${d}@demo.test`);
  who.parent = await as("parent@demo.test");
  who.other = await as("principal@other.test");
  sectionId = (await (await who.teacher2.get("/api/teacher/class-subjects")).json())[0].sectionId;
  const staff = (await (await who.principal.get("/api/staff?pageSize=100")).json()).items as {
    id: string;
    name: string;
  }[];
  const neha = staff.find((s) => s.name === "Neha Kapoor")!;
  const set = await who.principal.put(`/api/sections/${sectionId}/class-teacher`, {
    data: { staffId: neha.id },
  });
  expect(set.status()).toBe(200);
});

test.afterAll(async () => {
  // Moved to the first class as well: the report card tests list every student of classes 8 and 9.
  const [first] = await (await who.principal.get("/api/classes")).json();
  for (const id of added)
    await who.principal.patch(`/api/students/${id}`, {
      data: { status: "transferred", sectionId: first.sections[0].id },
    });
});

async function enquiry(name: string) {
  const made = await who.principal.post("/api/admissions/enquiries", {
    data: { studentName: name, guardianName: "Ravi Kumar", guardianPhone: "9876543210" },
  });
  expect(made.status()).toBe(201);
  const { id } = await made.json();
  for (const stage of ["documents", "review", "decision"])
    expect(
      (await who.principal.patch(`/api/admissions/enquiries/${id}`, { data: { stage } })).status(),
    ).toBe(200);
  return id as string;
}

test("admission with bus: every desk and the class teacher are told what to do", async () => {
  const name = `Bus Child ${run}`;
  const id = await enquiry(name);
  const res = await who.principal.post(`/api/admissions/enquiries/${id}/admit`, {
    data: { sectionId, needsBus: true },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  added.push(body.id);
  expect(body.missed).toEqual([]);
  expect(body.informed).toEqual(
    expect.arrayContaining([
      "Principal",
      "Accountant",
      "Librarian",
      "Transport in-charge",
      "Class teacher",
    ]),
  );
  const urls: Record<Desk, string> = {
    principal: `/school/students/${body.id}`,
    accountant: "/school/fees",
    librarian: "/school/library/loans",
    transport: "/school/transport/routes",
    teacher2: "/teacher/classes",
  };
  for (const d of desks) {
    const got = await inbox(who[d], name);
    expect(got, d).toHaveLength(1);
    expect(got[0]!.url, d).toBe(urls[d]);
    expect(got[0]!.body, d).not.toContain("9876543210");
  }
  expect(await inbox(who.parent, name)).toHaveLength(0);
  expect(await inbox(who.other, name)).toHaveLength(0);

  // Admitting twice neither adds a child nor sends the messages again.
  expect(
    (
      await who.principal.post(`/api/admissions/enquiries/${id}/admit`, { data: { sectionId } })
    ).status(),
  ).toBe(409);
  expect(await inbox(who.accountant, name)).toHaveLength(1);

  const waiting = await (await who.transport.get("/api/transport/requests")).json();
  expect(waiting.students.map((s: { name: string }) => s.name)).toContain(name);
  const route = waiting.routes[0];
  const seat = await who.transport.put(`/api/transport/students/${body.id}`, {
    data: { routeId: route.id, stopId: route.stops[0].id },
  });
  expect(seat.status()).toBe(200);
  const names = async () =>
    (await (await who.transport.get("/api/transport/requests")).json()).students.map(
      (s: { name: string }) => s.name,
    );
  expect(await names()).not.toContain(name);
  // Taking the child off the bus closes the request.
  await who.transport.put(`/api/transport/students/${body.id}`, { data: { routeId: null } });
  expect(await names()).not.toContain(name);
  expect((await who.accountant.get("/api/transport/requests")).status()).toBe(403);
});

test("admission without bus: transport is not bothered; direct add tells the desks too", async () => {
  const name = `Walk Child ${run}`;
  const res = await who.principal.post("/api/students", {
    data: {
      name,
      dob: "2015-04-02",
      gender: "female",
      sectionId,
      guardian: { name: "Sunita Rao", relation: "mother", phone: "9876500000" },
    },
  });
  expect(res.status()).toBe(201);
  const direct = await res.json();
  added.push(direct.id);
  expect(direct.message).toContain("Informed:");
  for (const d of ["principal", "accountant", "librarian", "teacher2"] as const)
    expect(await inbox(who[d], name), d).toHaveLength(1);
  expect(await inbox(who.transport, name)).toHaveLength(0);
});
