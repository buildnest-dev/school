import { expect, request as pwRequest, test, type APIRequestContext } from "@playwright/test";

/** Transport API tests (seeded fictional demo schools only). */
const PASSWORD = "ChangeMe#2026";
const base = "http://localhost:3000";

async function as(email: string): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({ baseURL: base });
  const res = await ctx.post("/api/auth/login", { data: { email, password: PASSWORD } });
  expect(res.status(), `login ${email}`).toBe(200);
  return ctx;
}

test.describe.configure({ mode: "serial" });

const day = (plus: number) =>
  new Date(Date.now() + 5.5 * 3600_000 + plus * 86400_000).toISOString().slice(0, 10);

type Vehicle = {
  id: string;
  regNo: string;
  compliance: string;
  capacity: number;
  route: { name: string } | null;
};
type Route = {
  id: string;
  name: string;
  students: number;
  seatsLeft: number | null;
  vehicle: { id: string } | null;
  driver: { id: string; name: string; phone: string } | null;
  stops: { id: string; name: string }[];
};

let transport: APIRequestContext;
let principal: APIRequestContext;
let teacher: APIRequestContext;
let librarian: APIRequestContext;
let parent: APIRequestContext;
let other: APIRequestContext;
let kids: { id: string }[] = [];
let route1: Route;
let route2: Route;
let smallVan: Vehicle;
let driverId = "";

const routes = async () =>
  (await (await transport.get("/api/transport/routes")).json()).items as Route[];
const vehicles = async () =>
  (await (await transport.get("/api/transport/vehicles")).json()).items as Vehicle[];
const assign = (studentId: string, body: object, ctx = transport) =>
  ctx.put(`/api/transport/students/${studentId}`, { data: body });

test.beforeAll(async () => {
  [transport, principal, teacher, librarian, parent, other] = await Promise.all([
    as("transport@demo.test"),
    as("principal@demo.test"),
    as("teacher@demo.test"),
    as("librarian@demo.test"),
    as("parent@demo.test"),
    as("principal@other.test"),
  ]);
  kids = await (await parent.get("/api/me/children")).json();
  route1 = (await routes()).find((r) => r.name === "Route 1 - North")!;
});

test("access: transport desk is for owner, principal and transport in-charge", async () => {
  const anon = await pwRequest.newContext({ baseURL: base });
  expect((await anon.get("/api/transport/vehicles")).status()).toBe(401);
  for (const who of [teacher, librarian, parent]) {
    expect((await who.get("/api/transport/vehicles")).status()).toBe(403);
    expect((await who.get("/api/transport/routes")).status()).toBe(403);
  }
  expect((await principal.get("/api/transport/vehicles")).status()).toBe(200);
  expect((await transport.get("/api/transport/vehicles")).status()).toBe(200);
});

test("fleet: papers are flagged, registrations validated and unique per school", async () => {
  const fleet = await vehicles();
  const bus = fleet.find((v) => v.regNo === "KA01AB1234")!;
  const van = fleet.find((v) => v.regNo === "KA01CD5678")!;
  expect(bus).toMatchObject({ compliance: "ok", capacity: 40 });
  expect(bus.route?.name).toBe("Route 1 - North");
  expect(van.compliance).toBe("expired");

  const base_ = { type: "van", capacity: 2, insuranceExpiry: day(300), fitnessExpiry: day(300) };
  expect(
    (
      await transport.post("/api/transport/vehicles", { data: { ...base_, regNo: "BUS-1" } })
    ).status(),
  ).toBe(422);
  expect(
    (
      await transport.post("/api/transport/vehicles", {
        data: { ...base_, regNo: "KA05MN4321", type: "tank" },
      })
    ).status(),
  ).toBe(422);
  expect(
    (
      await transport.post("/api/transport/vehicles", {
        data: { ...base_, regNo: "KA05MN4321", capacity: 0 },
      })
    ).status(),
  ).toBe(422);
  expect(
    (
      await teacher.post("/api/transport/vehicles", { data: { ...base_, regNo: "KA05MN4321" } })
    ).status(),
  ).toBe(403);

  const ok = await transport.post("/api/transport/vehicles", {
    data: { ...base_, regNo: "ka 05 mn-4321" },
  });
  expect(ok.status()).toBe(201);
  smallVan = (await ok.json()).vehicle;
  expect(smallVan.regNo).toBe("KA05MN4321");
  expect(
    (
      await transport.post("/api/transport/vehicles", { data: { ...base_, regNo: "KA05MN4321" } })
    ).status(),
  ).toBe(409);
  expect(
    (
      await other.post("/api/transport/vehicles", { data: { ...base_, regNo: "KA05MN4321" } })
    ).status(),
  ).toBe(201);
  expect((await (await other.get("/api/transport/vehicles")).json()).items.length).toBe(1);

  const soon = await transport.post("/api/transport/vehicles", {
    data: { ...base_, regNo: "MH12AB9999", fitnessExpiry: day(10) },
  });
  expect((await soon.json()).vehicle.compliance).toBe("expiring");
  const lapsed = await transport.post("/api/transport/vehicles", {
    data: {
      type: "bus",
      capacity: 30,
      regNo: "MH12AB8888",
      insuranceExpiry: day(100),
      fitnessExpiry: day(-1),
    },
  });
  expect((await lapsed.json()).vehicle.compliance).toBe("expired");
  const nodates = await transport.post("/api/transport/vehicles", {
    data: { type: "bus", capacity: 30, regNo: "MH12AB7777" },
  });
  expect((await nodates.json()).vehicle.compliance).toBe("unknown");
});

test("routes: only roadworthy vehicles and real drivers; one vehicle and driver per route", async () => {
  const fleet = await vehicles();
  const expiredVan = fleet.find((v) => v.regNo === "KA01CD5678")!;
  const staff = (await (await principal.get("/api/staff")).json()).items as {
    id: string;
    name: string;
    role: string;
  }[];
  const teacherStaff = staff.find((s) => s.role === "teacher")!;
  const ramesh = staff.find((s) => s.name === "Ramesh Yadav")!;
  driverId = ramesh.id;
  const post = (data: object) => transport.post("/api/transport/routes", { data });

  expect((await post({ name: "Route 2 - South", vehicleId: expiredVan.id })).status()).toBe(409); // expired papers
  expect((await post({ name: "Route 2 - South", vehicleId: "nope" })).status()).toBe(422);
  expect((await post({ name: "Route 2 - South", driverId: teacherStaff.id })).status()).toBe(422); // not a driver
  expect((await post({ name: "Route 2 - South", vehicleId: route1.vehicle!.id })).status()).toBe(
    409,
  ); // already on Route 1
  expect((await post({ name: "Route 2 - South", driverId: ramesh.id })).status()).toBe(409); // already drives Route 1
  expect((await post({ name: "R" })).status()).toBe(422);
  expect(
    (await teacher.post("/api/transport/routes", { data: { name: "Route 2 - South" } })).status(),
  ).toBe(403);

  const ok = await post({
    name: "Route 2 - South",
    vehicleId: smallVan.id,
    monthlyFee: 950,
    attendantName: "Geeta",
  });
  expect(ok.status()).toBe(201);
  route2 = (await ok.json()).route;
  expect(route2).toMatchObject({ students: 0, seatsLeft: 2, monthlyFee: 950 });
  expect((await post({ name: "Route 2 - South" })).status()).toBe(409); // name taken
});

test("stops: ordered by pickup time, unique names, saved in travel order", async () => {
  const put = (id: string, stops: object[]) =>
    transport.put(`/api/transport/routes/${id}/stops`, { data: { stops } });
  const s = (name: string, pickupTime: string, dropTime?: string) => ({
    name,
    pickupTime,
    dropTime,
  });
  expect((await put(route2.id, [s("A Stop", "07:30"), s("B Stop", "07:10")])).status()).toBe(422);
  expect((await put(route2.id, [s("A Stop", "07:10"), s("a stop", "07:20")])).status()).toBe(422);
  expect((await put(route2.id, [s("A Stop", "7:10")])).status()).toBe(422);
  expect((await put(route2.id, [])).status()).toBe(422);
  expect((await put(route2.id, [s("A Stop", "07:10")])).status()).toBe(200);
  const saved = await put(route2.id, [
    s("Jayanagar", "07:00", "15:40"),
    s("BTM Layout", "07:20", "15:20"),
    s("School Gate", "07:50", "15:00"),
  ]);
  expect(saved.status()).toBe(200);
  route2 = (await saved.json()).route;
  expect(route2.stops.map((x) => x.name)).toEqual(["Jayanagar", "BTM Layout", "School Gate"]);
  expect(
    (
      await other.put(`/api/transport/routes/${route2.id}/stops`, {
        data: { stops: [s("X Stop", "07:00")] },
      })
    ).status(),
  ).toBe(404);
});

test("students: seats are limited, stops must belong to the route, moves are free", async () => {
  const [k1, k2, k3] = kids.map((k) => k.id) as [string, string, string];
  const [jay, btm] = route2.stops;
  const r1stop = route1.stops[0]!;

  expect((await assign(k1, { routeId: route2.id, stopId: r1stop.id })).status()).toBe(422); // stop on another route
  expect((await assign(k1, { routeId: "nope", stopId: jay!.id })).status()).toBe(422);
  expect((await assign(k1, { routeId: route2.id })).status()).toBe(422);
  expect((await assign(k1, { routeId: route2.id, stopId: jay!.id }, parent)).status()).toBe(403);

  expect((await assign(k1, { routeId: route2.id, stopId: jay!.id })).status()).toBe(200);
  expect((await assign(k2, { routeId: route2.id, stopId: btm!.id })).status()).toBe(200);
  const full = await assign(k3, { routeId: route2.id, stopId: jay!.id });
  expect(full.status()).toBe(409);
  expect((await full.json()).code).toBe("full");
  // Moving a student who already rides is not blocked by a full vehicle.
  expect((await assign(k1, { routeId: route2.id, stopId: btm!.id })).status()).toBe(200);
  const r2 = (await routes()).find((r) => r.id === route2.id)!;
  expect(r2).toMatchObject({ students: 2, seatsLeft: 0 });

  // A student rides only one route: assigning to Route 1 takes them off Route 2.
  expect((await assign(k2, { routeId: route1.id, stopId: r1stop.id })).status()).toBe(200);
  const r2b = (await routes()).find((r) => r.id === route2.id)!;
  expect(r2b.students).toBe(1);
  expect((await assign(k3, { routeId: route2.id, stopId: jay!.id })).status()).toBe(200);
});

test("a route needs a vehicle before it takes students; other schools' students are out of reach", async () => {
  const made = await transport.post("/api/transport/routes", { data: { name: "Route 3 - East" } });
  const r3: Route = (await made.json()).route;
  await transport.put(`/api/transport/routes/${r3.id}/stops`, {
    data: { stops: [{ name: "East Gate", pickupTime: "07:00" }] },
  });
  const stop = (await (await transport.get(`/api/transport/routes/${r3.id}`)).json()).stops[0];
  expect((await assign(kids[3]!.id, { routeId: r3.id, stopId: stop.id })).status()).toBe(409);
  const theirs = (await (await other.get("/api/students")).json()).items[0];
  expect(
    (await assign(theirs.id, { routeId: route2.id, stopId: route2.stops[0]!.id })).status(),
  ).toBe(404);
  expect((await assign("nope", { routeId: null })).status()).toBe(404);
});

test("parents see their own child's bus, stop, driver; nobody else's", async () => {
  const mine = await (await parent.get(`/api/transport/students/${kids[1]!.id}`)).json();
  expect(mine.uses).toBe(true);
  expect(mine.route.name).toBe("Route 1 - North");
  expect(mine.stop.pickupTime).toBe("07:00");
  expect(mine.vehicle.regNo).toBe("KA01AB1234");
  expect(mine.driver).toMatchObject({ name: "Ramesh Yadav", phone: "+91 9811100011" });
  const none = await (await parent.get(`/api/transport/students/${kids[5]!.id}`)).json();
  expect(none.uses).toBe(false);
  const theirs = (await (await other.get("/api/students")).json()).items[0];
  expect((await parent.get(`/api/transport/students/${theirs.id}`)).status()).toBe(404);
  expect((await other.get(`/api/transport/students/${kids[1]!.id}`)).status()).toBe(404);
  expect((await teacher.get(`/api/transport/students/${kids[1]!.id}`)).status()).toBe(403);
});

test("riders protect their stop, route and vehicle until they are moved", async () => {
  const detail = await (await transport.get(`/api/transport/routes/${route2.id}`)).json();
  expect(detail.riders.length).toBe(2);
  const stops = detail.stops as { id: string; name: string }[];
  const used = detail.riders[0].stop as string;
  const without = stops
    .filter((s) => s.name !== used)
    .map((s, i) => ({ name: s.name, pickupTime: `07:${10 + i * 10}` }));
  expect(
    (
      await transport.put(`/api/transport/routes/${route2.id}/stops`, { data: { stops: without } })
    ).status(),
  ).toBe(409);
  expect(
    (
      await transport.patch(`/api/transport/routes/${route2.id}`, { data: { status: "inactive" } })
    ).status(),
  ).toBe(409);
  expect(
    (
      await transport.patch(`/api/transport/vehicles/${smallVan.id}`, { data: { capacity: 1 } })
    ).status(),
  ).toBe(409);
  expect(
    (
      await transport.patch(`/api/transport/vehicles/${smallVan.id}`, {
        data: { status: "inactive" },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await transport.patch(`/api/transport/routes/${route2.id}`, { data: { vehicleId: null } })
    ).status(),
  ).toBe(409);

  for (const r of detail.riders)
    expect((await assign(r.studentId, { routeId: null })).status()).toBe(200);
  expect((await assign(detail.riders[0].studentId, { routeId: null })).status()).toBe(200); // idempotent
  expect(
    (
      await transport.patch(`/api/transport/routes/${route2.id}`, { data: { status: "inactive" } })
    ).status(),
  ).toBe(200);
  expect((await assign(kids[6]!.id, { routeId: route2.id, stopId: stops[0]!.id })).status()).toBe(
    409,
  ); // not running
  expect(
    (
      await transport.patch(`/api/transport/routes/${route2.id}`, { data: { status: "active" } })
    ).status(),
  ).toBe(200);
});

test("deactivating a driver takes them off their route; another school sees nothing", async () => {
  const made = await principal.post("/api/staff", {
    data: { name: "Mohan Lal", role: "driver", phone: "9822200022" },
  });
  const mohan = (await made.json()).staff;
  expect(
    (
      await transport.patch(`/api/transport/routes/${route2.id}`, { data: { driverId: mohan.id } })
    ).status(),
  ).toBe(200);
  expect((await routes()).find((r) => r.id === route2.id)!.driver?.name).toBe("Mohan Lal");
  expect(
    (await principal.patch(`/api/staff/${mohan.id}`, { data: { status: "inactive" } })).status(),
  ).toBe(200);
  expect((await routes()).find((r) => r.id === route2.id)!.driver).toBeNull();
  expect(
    (
      await transport.patch(`/api/transport/routes/${route2.id}`, { data: { driverId: mohan.id } })
    ).status(),
  ).toBe(422); // inactive
  expect(driverId).not.toBe("");

  expect((await (await other.get("/api/transport/routes")).json()).items).toEqual([]);
  expect((await other.get(`/api/transport/routes/${route2.id}`)).status()).toBe(404);
  expect(
    (
      await other.patch(`/api/transport/routes/${route2.id}`, { data: { name: "Hijacked" } })
    ).status(),
  ).toBe(404);
  expect(
    (
      await other.patch(`/api/transport/vehicles/${smallVan.id}`, { data: { capacity: 5 } })
    ).status(),
  ).toBe(404);
});
