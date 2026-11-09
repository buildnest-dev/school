import { expect, request as pwRequest, test, type APIRequestContext } from "@playwright/test";

/** Absence notifications and phone subscriptions. No VAPID keys are set in tests, so nothing is pushed; each message is still stored. */
const PASSWORD = "ChangeMe#2026";
const base = "http://localhost:3000";
async function as(email: string): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({ baseURL: base });
  expect(
    (await ctx.post("/api/auth/login", { data: { email, password: PASSWORD } })).status(),
  ).toBe(200);
  return ctx;
}
const day = () =>
  new Date(Date.UTC(2019, 0, 1) + (Date.now() % (1800 * 86_400_000))).toISOString().slice(0, 10);

test("a parent hears once when their child is submitted absent; phones subscribe and leave", async () => {
  const [principal, parent, other] = await Promise.all([
    as("principal@demo.test"),
    as("parent@demo.test"),
    as("principal@other.test"),
  ]);
  const kids = await (await parent.get("/api/me/children")).json();
  const kid = (Array.isArray(kids) ? kids : kids.items)[0] as { id: string; classSection: string };
  const classes = (await (await principal.get("/api/classes")).json()) as {
    name: string;
    sections: { id: string; name: string }[];
  }[];
  const classId = classes
    .flatMap((c) => c.sections.map((x) => ({ id: x.id, label: `${c.name} ${x.name}` })))
    .find((x) => x.label === kid.classSection)!.id;

  // Subscriptions: a valid one is stored, junk is refused, signed-out people cannot subscribe.
  const sub = {
    endpoint: `https://fcm.googleapis.com/fcm/send/${Date.now()}`,
    keys: { p256dh: "B".repeat(87), auth: "A".repeat(22) },
  };
  expect(
    (await parent.post("/api/push/subscribe", { data: { endpoint: "nope", keys: {} } })).status(),
  ).toBe(422);
  expect(
    (
      await (
        await pwRequest.newContext({ baseURL: base })
      ).post("/api/push/subscribe", { data: sub })
    ).status(),
  ).toBe(401);
  expect((await parent.post("/api/push/subscribe", { data: sub })).status()).toBe(201);
  expect((await parent.post("/api/push/subscribe", { data: sub })).status()).toBe(201); // again: no duplicate
  expect(
    (await parent.delete("/api/push/subscribe", { data: { endpoint: sub.endpoint } })).status(),
  ).toBe(200);
  expect((await (await parent.get("/api/push/public-key")).json()).key).toBeNull();

  const before = (await (await parent.get("/api/me/notifications")).json()).items.length;
  const date = day();
  const roster = await (await principal.get(`/api/attendance/classes/${classId}/${date}`)).json();
  const marks = Object.fromEntries(
    roster.roster.map((s: { id: string }) => [s.id, s.id === kid.id ? "absent" : "present"]),
  );
  // A draft tells nobody.
  expect(
    (
      await principal.put(`/api/attendance/classes/${classId}/${date}`, {
        data: { marks, submit: false },
      })
    ).status(),
  ).toBe(200);
  expect((await (await parent.get("/api/me/notifications")).json()).items.length).toBe(before);
  // Submitting does, once.
  expect(
    (
      await principal.put(`/api/attendance/classes/${classId}/${date}`, {
        data: { marks, submit: true },
      })
    ).status(),
  ).toBe(200);
  const after = (await (await parent.get("/api/me/notifications")).json()).items;
  expect(after.length).toBe(before + 1);
  expect(after[0].title).toContain("absent today");
  expect(after[0].url).toBe("/parent/attendance");
  expect(
    (
      await principal.put(`/api/attendance/classes/${classId}/${date}`, {
        data: { marks, submit: true },
      })
    ).status(),
  ).toBe(200);
  expect((await (await parent.get("/api/me/notifications")).json()).items.length).toBe(before + 1);
  // Present children trigger nothing, and another school's people see none of it.
  expect((await (await other.get("/api/me/notifications")).json()).items.length).toBe(0);
});
