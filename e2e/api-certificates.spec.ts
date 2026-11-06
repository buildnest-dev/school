import { expect, request as pwRequest, test, type APIRequestContext } from "@playwright/test";

/** Certificate API tests (seeded fictional demo schools only). */
const PASSWORD = "ChangeMe#2026";
const base = "http://localhost:3000";

async function as(email: string): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({ baseURL: base });
  const res = await ctx.post("/api/auth/login", { data: { email, password: PASSWORD } });
  expect(res.status(), `login ${email}`).toBe(200);
  return ctx;
}

test.describe.configure({ mode: "serial" });

type Cert = {
  id: string;
  type: string;
  status: string;
  serialNo: string | null;
  decisionNote: string | null;
  student: string;
  document?: { title: string; statement: string; lines: [string, string][] };
};

let principal: APIRequestContext;
let teacher: APIRequestContext;
let accountant: APIRequestContext;
let librarian: APIRequestContext;
let transport: APIRequestContext;
let parent: APIRequestContext;
let other: APIRequestContext;
let anon: APIRequestContext;
let kids: { id: string; name: string }[] = [];
let sectionId = "";
let outsider = { id: "", name: "" }; // a student the parent is not linked to
let bonafideId = "";
let characterId = "";

const newStudent = async (name: string, dob: string) => {
  const res = await principal.post("/api/students", {
    data: {
      name,
      dob,
      gender: "female",
      sectionId,
      guardian: { name: "Kavita Rao", relation: "mother", phone: "9876501234" },
    },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).student as { id: string; name: string };
};
const request = (ctx: APIRequestContext, studentId: string, type: string, purpose?: string) =>
  ctx.post("/api/certificates", { data: { studentId, type, purpose } });
const decide = (id: string, action: string, body: object = {}) =>
  principal.post(`/api/certificates/${id}/${action}`, { data: body });
const verify = (school: string, serial: string) =>
  anon.get(`/api/public/certificates/verify?school=${school}&serial=${encodeURIComponent(serial)}`);

test.beforeAll(async () => {
  [principal, teacher, accountant, librarian, transport, parent, other] = await Promise.all([
    as("principal@demo.test"),
    as("teacher@demo.test"),
    as("accountant@demo.test"),
    as("librarian@demo.test"),
    as("transport@demo.test"),
    as("parent@demo.test"),
    as("principal@other.test"),
  ]);
  anon = await pwRequest.newContext({ baseURL: base });
  kids = await (await parent.get("/api/me/children")).json();
  const classes = await (await principal.get("/api/classes")).json();
  sectionId = classes.find((c: { name: string }) => c.name === "Class 5").sections[0].id;
  outsider = await newStudent("Tanvi Kulkarni", "2014-03-05");
});

test.afterAll(async () => {
  // Keep shared demo data tidy for other specs: students created here must not stay "active".
  await principal.patch(`/api/students/${outsider.id}`, { data: { status: "alumni" } });
});

test("access: only owner, principal and the student's parent", async () => {
  expect((await anon.get("/api/certificates")).status()).toBe(401);
  for (const who of [teacher, accountant, librarian, transport]) {
    expect((await who.get("/api/certificates")).status()).toBe(403);
    expect((await request(who, kids[0]!.id, "bonafide", "School records")).status()).toBe(403);
  }
  expect((await principal.get("/api/certificates")).status()).toBe(200);
  expect((await parent.get("/api/certificates")).status()).toBe(200);
});

test("parents can request bonafide and character certificates for their own child only", async () => {
  const kid = kids[0]!.id;
  expect((await request(parent, kid, "transfer", "Moving city")).status()).toBe(403);
  expect((await request(parent, kid, "bonafide")).status()).toBe(422); // purpose needed
  expect((await request(parent, kid, "bonafide", "Hi")).status()).toBe(422); // too short
  expect((await request(parent, kid, "passport", "Passport application")).status()).toBe(422);
  expect((await request(parent, outsider.id, "bonafide", "Scholarship form")).status()).toBe(404);
  expect((await request(other, kid, "bonafide", "Scholarship form")).status()).toBe(404);

  const ok = await request(parent, kid, "bonafide", "Scholarship application");
  expect(ok.status()).toBe(201);
  const made: Cert = (await ok.json()).certificate;
  expect(made).toMatchObject({ type: "bonafide", status: "requested", serialNo: null });
  bonafideId = made.id;
  expect((await request(parent, kid, "bonafide", "Scholarship application")).status()).toBe(409);

  // A parent cannot decide on requests.
  for (const a of ["issue", "reject", "cancel"])
    expect(
      (
        await parent.post(`/api/certificates/${bonafideId}/${a}`, { data: { reason: "no" } })
      ).status(),
    ).toBe(403);
  const detail: Cert = await (await parent.get(`/api/certificates/${bonafideId}`)).json();
  expect(detail.document).toBeUndefined(); // nothing to print yet
  expect((await other.get(`/api/certificates/${bonafideId}`)).status()).toBe(404);
});

test("issuing copies the student's details at that moment and numbers the certificate", async () => {
  expect((await decide(bonafideId, "issue", { conduct: "good" })).status()).toBe(422); // strict body
  const res = await decide(bonafideId, "issue");
  expect(res.status()).toBe(200);
  const cert: Cert = (await res.json()).certificate;
  const year = new Date(Date.now() + 5.5 * 3600_000).getUTCFullYear();
  expect(cert.serialNo).toBe(`BON/${year}/0001`);
  expect(cert.status).toBe("issued");
  expect(cert.document!.title).toBe("Bonafide Certificate");
  expect(cert.document!.statement).toContain(cert.student);
  expect(cert.document!.statement).toContain("Scholarship application");
  expect(cert.document!.statement).toContain("Suresh Patel");
  expect((await decide(bonafideId, "issue")).status()).toBe(409); // not twice

  // Editing the student later never changes a certificate that was already issued.
  const before = cert.student;
  const renamed = await principal.patch(`/api/students/${kids[0]!.id}`, {
    data: { name: "Renamed Student" },
  });
  expect(renamed.status()).toBe(200);
  const again: Cert = await (await principal.get(`/api/certificates/${bonafideId}`)).json();
  expect(again.document!.statement).toContain(before);
  expect(again.document!.statement).not.toContain("Renamed Student");
  await principal.patch(`/api/students/${kids[0]!.id}`, { data: { name: before } });

  const seen: Cert = await (await parent.get(`/api/certificates/${bonafideId}`)).json();
  expect(seen.document!.lines.find(([k]) => k === "Certificate no.")![1]).toBe(cert.serialNo);
});

test("character certificates need a conduct grade; serials count per type", async () => {
  const made = await request(principal, kids[1]!.id, "character", "Admission to another school");
  characterId = (await made.json()).certificate.id;
  expect((await decide(characterId, "issue")).status()).toBe(422);
  expect((await decide(characterId, "issue", { conduct: "brilliant" })).status()).toBe(422);
  const res = await decide(characterId, "issue", { conduct: "excellent" });
  expect(res.status()).toBe(200);
  const cert: Cert = (await res.json()).certificate;
  expect(cert.serialNo).toMatch(/^CHR\/\d{4}\/0001$/);
  expect(cert.document!.statement).toContain("excellent");
});

test("requests can be declined with a reason; issued ones can be cancelled", async () => {
  const kid = kids[2]!.id;
  const made = await request(parent, kid, "character", "Visa");
  const id = (await made.json()).certificate.id;
  expect((await decide(id, "reject", {})).status()).toBe(422);
  expect((await decide(id, "reject", { reason: "ab" })).status()).toBe(422);
  expect(
    (await decide(id, "reject", { reason: "Please bring the school ID card first" })).status(),
  ).toBe(200);
  const seen: Cert = await (await parent.get(`/api/certificates/${id}`)).json();
  expect(seen).toMatchObject({
    status: "rejected",
    decisionNote: "Please bring the school ID card first",
  });
  expect((await decide(id, "reject", { reason: "Again please" })).status()).toBe(409);
  expect((await decide(id, "issue", { conduct: "good" })).status()).toBe(409);
  expect((await decide(id, "cancel", { reason: "Not issued yet" })).status()).toBe(409);
  expect(
    (
      await other.post(`/api/certificates/${id}/reject`, { data: { reason: "Not yours" } })
    ).status(),
  ).toBe(404);
});

test("public verification confirms genuine certificates without exposing the student", async () => {
  const cert: Cert = await (await principal.get(`/api/certificates/${characterId}`)).json();
  const ok = await (await verify("demo-school", cert.serialNo!)).json();
  expect(ok).toMatchObject({
    valid: true,
    title: "Character Certificate",
    serialNo: cert.serialNo,
  });
  expect(ok.school).toContain("Demo Public School");
  expect(ok.student).toMatch(/^\S+ [A-Z]\.$/); // "Name X."
  expect(JSON.stringify(ok)).not.toContain(cert.student);

  expect((await (await verify("demo-school", "CHR/2026/9999")).json()).valid).toBe(false);
  expect((await (await verify("no-such-school", cert.serialNo!)).json()).valid).toBe(false);
  expect((await (await verify("other-school", cert.serialNo!)).json()).valid).toBe(false); // another school's number space
  expect((await (await anon.get("/api/public/certificates/verify")).json()).valid).toBe(false);

  // Cancelling makes the check fail but keeps the record.
  expect(
    (await decide(bonafideId, "cancel", { reason: "Issued for the wrong purpose" })).status(),
  ).toBe(200);
  const bonafide: Cert = await (await principal.get(`/api/certificates/${bonafideId}`)).json();
  expect(bonafide.status).toBe("cancelled");
  const gone = await (await verify("demo-school", bonafide.serialNo!)).json();
  expect(gone).toMatchObject({ valid: false, reason: "cancelled" });
  expect((await decide(bonafideId, "cancel", { reason: "Second try" })).status()).toBe(409);
});

test("transfer certificate: needs details and a clean record, then ends enrolment", async () => {
  const kid = kids[3]!.id;
  const tc = await request(principal, kid, "transfer");
  const kidTc = (await tc.json()).certificate.id;
  const details = {
    leavingDate: "2026-12-15",
    reasonForLeaving: "Parent transferred to Pune",
    conduct: "good",
  };

  expect((await decide(kidTc, "issue", {})).status()).toBe(422);
  expect((await decide(kidTc, "issue", { ...details, leavingDate: "2026-02-30" })).status()).toBe(
    422,
  );
  // This seeded student still owes fees.
  const dues = await decide(kidTc, "issue", details);
  expect(dues.status()).toBe(409);
  expect((await dues.json()).code).toBe("fees_due");
  expect((await decide(kidTc, "reject", { reason: "Fees pending" })).status()).toBe(200);
  expect((await principal.get(`/api/students/${kid}`).then((r) => r.json())).status).toBe("active");

  // A student with no fees: library items and transport are handled too.
  const leaver = await newStudent("Mira Deshpande", "2014-04-09");
  const route = (await (await transport.get("/api/transport/routes")).json()).items.find(
    (r: { name: string }) => r.name === "Route 1 - North",
  );
  const stop = route.stops[0];
  expect(
    (
      await transport.put(`/api/transport/students/${leaver.id}`, {
        data: { routeId: route.id, stopId: stop.id },
      })
    ).status(),
  ).toBe(200);
  const books = (await (await librarian.get("/api/library/books?available=1")).json()).items;
  const loan = await librarian.post("/api/library/loans", {
    data: { bookId: books[0].id, studentId: leaver.id },
  });
  expect(loan.status()).toBe(201);
  const loanId = (await loan.json()).loan.id;

  const tcId = (await (await request(principal, leaver.id, "transfer")).json()).certificate.id;
  expect((await request(principal, leaver.id, "transfer")).status()).toBe(409); // already waiting
  const lib = await decide(tcId, "issue", details);
  expect(lib.status()).toBe(409);
  expect((await lib.json()).code).toBe("library_due");
  expect((await librarian.post(`/api/library/loans/${loanId}/return`)).status()).toBe(200);

  const done = await decide(tcId, "issue", {
    ...details,
    promotedTo: "Class 6",
    remarks: "Left in good standing",
  });
  expect(done.status()).toBe(200);
  const cert: Cert = (await done.json()).certificate;
  expect(cert.serialNo).toMatch(/^TC\/\d{4}\/0001$/);
  expect(cert.document!.statement).toContain("2026-12-15");
  expect(cert.document!.statement).toContain("Promoted to: Class 6");
  expect(cert.document!.lines.map(([k]) => k)).toContain("PEN");

  // Enrolment ended: status changed, transport seat released, no more current-student certificates.
  expect((await principal.get(`/api/students/${leaver.id}`).then((r) => r.json())).status).toBe(
    "transferred",
  );
  expect((await (await transport.get(`/api/transport/students/${leaver.id}`)).json()).uses).toBe(
    false,
  );
  expect((await request(principal, leaver.id, "bonafide", "Not allowed")).status()).toBe(409);
  expect((await request(principal, leaver.id, "transfer")).status()).toBe(409);
  // A character certificate can still be asked for after leaving.
  expect((await request(principal, leaver.id, "character", "College admission")).status()).toBe(
    201,
  );

  // Cancelling the TC does not silently re-enrol the student.
  expect((await decide(tcId, "cancel", { reason: "Wrong leaving date" })).status()).toBe(200);
  expect((await principal.get(`/api/students/${leaver.id}`).then((r) => r.json())).status).toBe(
    "transferred",
  );
});

test("another school sees none of this school's certificates", async () => {
  expect((await (await other.get("/api/certificates")).json()).items).toEqual([]);
  expect((await other.get(`/api/certificates/${characterId}`)).status()).toBe(404);
  expect(
    (
      await other.post(`/api/certificates/${characterId}/cancel`, {
        data: { reason: "Not yours to cancel" },
      })
    ).status(),
  ).toBe(404);
  const mine = (await (await parent.get("/api/certificates")).json()).items as Cert[];
  expect(mine.length).toBeGreaterThanOrEqual(2);
  expect(
    mine.every((c) => kids.some((k) => k.name === c.student || c.student === "Renamed Student")),
  ).toBe(true);
});
