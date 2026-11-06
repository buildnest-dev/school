import { expect, request as pwRequest, test, type APIRequestContext } from "@playwright/test";

/** Library API tests (seeded fictional demo schools only). */
const PASSWORD = "ChangeMe#2026";
const base = "http://localhost:3000";

async function as(email: string): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({ baseURL: base });
  const res = await ctx.post("/api/auth/login", { data: { email, password: PASSWORD } });
  expect(res.status(), `login ${email}`).toBe(200);
  return ctx;
}

test.describe.configure({ mode: "serial" });

type Book = {
  id: string;
  accessionNo: string;
  title: string;
  totalCopies: number;
  availableCopies: number;
};
type Loan = {
  id: string;
  borrowerId: string;
  borrower: string;
  status: string;
  daysLate: number;
  fine: number;
  fineStatus: string;
  dueOn: string;
  issuedOn: string;
};

let librarian: APIRequestContext;
let principal: APIRequestContext;
let teacher: APIRequestContext;
let parent: APIRequestContext;
let other: APIRequestContext;
let books: Book[] = [];
let free: string[] = []; // students with no library history
let overdue: Loan[] = [];

const book = (acc: string) => books.find((b) => b.accessionNo === acc)!;
const refresh = async () => {
  books = (await (await librarian.get("/api/library/books")).json()).items;
};
const issue = (
  who: Record<string, string>,
  accession: string,
  extra: object = {},
  ctx = librarian,
) => ctx.post("/api/library/loans", { data: { bookId: book(accession).id, ...who, ...extra } });

test.beforeAll(async () => {
  [librarian, principal, teacher, parent, other] = await Promise.all([
    as("librarian@demo.test"),
    as("principal@demo.test"),
    as("teacher@demo.test"),
    as("parent@demo.test"),
    as("principal@other.test"),
  ]);
  await refresh();
  overdue = (await (await librarian.get("/api/library/loans?status=overdue")).json()).items;
  const kids: { id: string }[] = await (await parent.get("/api/me/children")).json();
  const busy = new Set(overdue.map((l) => l.borrowerId));
  free = kids.map((k) => k.id).filter((id) => !busy.has(id));
});

test("access: catalogue is open to the school, desk work only to library staff", async () => {
  const anon = await pwRequest.newContext({ baseURL: base });
  expect((await anon.get("/api/library/books")).status()).toBe(401);
  expect((await teacher.get("/api/library/books")).status()).toBe(200);
  expect((await parent.get("/api/library/books")).status()).toBe(200);
  expect((await teacher.get("/api/library/loans")).status()).toBe(403);
  const b = { title: "X Book", author: "Someone", category: "Fiction", totalCopies: 1 };
  expect((await teacher.post("/api/library/books", { data: b })).status()).toBe(403);
  expect((await parent.post("/api/library/books", { data: b })).status()).toBe(403);
  expect((await teacher.post("/api/library/loans", { data: {} })).status()).toBe(403);
  expect(books.length).toBeGreaterThanOrEqual(5);
  expect(overdue.length).toBe(2);
});

test("catalogue: search, filters, ISBN validation, duplicate ISBN, per-school catalogues", async () => {
  const find = async (qs: string) =>
    (await (await teacher.get(`/api/library/books?${qs}`)).json()).items as Book[];
  expect((await find("q=wings")).map((x) => x.title)).toEqual(["Wings of Fire"]);
  expect((await find("q=narayan")).length).toBe(1);
  expect((await find("category=Textbook")).length).toBeGreaterThanOrEqual(1);
  expect((await find("available=1")).every((x) => x.availableCopies > 0)).toBe(true);

  const good = {
    title: "Introduction to Algorithms",
    author: "T. H. Cormen",
    category: "Reference",
    totalCopies: 2,
  };
  expect(
    (
      await librarian.post("/api/library/books", { data: { ...good, isbn: "9780306406158" } })
    ).status(),
  ).toBe(422);
  expect(
    (await librarian.post("/api/library/books", { data: { ...good, isbn: "12345" } })).status(),
  ).toBe(422);
  expect(
    (
      await librarian.post("/api/library/books", { data: { ...good, category: "Cooking" } })
    ).status(),
  ).toBe(422);
  expect(
    (await librarian.post("/api/library/books", { data: { ...good, totalCopies: 0 } })).status(),
  ).toBe(422);

  const ok = await librarian.post("/api/library/books", {
    data: { ...good, isbn: "978-0-306-40615-7" },
  });
  expect(ok.status()).toBe(201);
  const made = (await ok.json()).book;
  expect(made).toMatchObject({ isbn: "9780306406157", totalCopies: 2, availableCopies: 2 });
  expect(made.accessionNo).toMatch(/^LIB-\d{4}$/);
  // The same ISBN in another format (ISBN-10 form of the same book is a different string, but a re-typed 13 is caught).
  expect(
    (
      await librarian.post("/api/library/books", { data: { ...good, isbn: "9780306406157" } })
    ).status(),
  ).toBe(409);
  expect(
    (
      await librarian.post("/api/library/books", { data: { ...good, isbn: "0306406152" } })
    ).status(),
  ).toBe(201);

  // Another school has its own catalogue, and may use the same ISBN.
  expect(((await (await other.get("/api/library/books")).json()).items as Book[]).length).toBe(0);
  expect(
    (await other.post("/api/library/books", { data: { ...good, isbn: "9780306406157" } })).status(),
  ).toBe(201);
  await refresh();
});

test("issuing: due date, validation, one copy only once, limits", async () => {
  const [a] = free;
  const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

  expect((await issue({ studentId: a! }, "LIB-0001", { dueDays: 0 })).status()).toBe(422);
  expect((await issue({}, "LIB-0001")).status()).toBe(422);
  expect((await issue({ studentId: a!, staffId: "x" }, "LIB-0001")).status()).toBe(422);
  expect((await issue({ studentId: "nope" }, "LIB-0001")).status()).toBe(422);
  expect(
    (
      await librarian.post("/api/library/loans", { data: { bookId: "nope", studentId: a } })
    ).status(),
  ).toBe(422);
  expect((await issue({ studentId: a! }, "LIB-0001", {}, other)).status()).toBe(422); // other school: unknown book

  const first = await issue({ studentId: a! }, "LIB-0001");
  expect(first.status()).toBe(201);
  const loan: Loan = (await first.json()).loan;
  expect(loan.issuedOn).toBe(today);
  expect(loan.status).toBe("open");
  const due = new Date(Date.parse(today) + 14 * 86400_000).toISOString().slice(0, 10);
  expect(loan.dueOn).toBe(due);

  expect((await issue({ studentId: a! }, "LIB-0001")).status()).toBe(409); // already has it
  expect((await issue({ studentId: a! }, "LIB-0002", { dueDays: 7 })).status()).toBe(201);
  expect((await issue({ studentId: a! }, "LIB-0005")).status()).toBe(201);
  const limit = await issue({ studentId: a! }, "LIB-0003");
  expect(limit.status()).toBe(409); // already 3 books out
  expect((await limit.json()).code).toBe("limit");

  // Staff can borrow too.
  const staff = (await (await principal.get("/api/staff?role=teacher")).json()).items;
  const rahul = staff.find((s: { name: string }) => s.name === "Rahul Menon").id;
  expect((await issue({ staffId: rahul }, "LIB-0003")).status()).toBe(201);
  await refresh();
  expect(book("LIB-0003").availableCopies).toBe(0);
  expect(book("LIB-0001").availableCopies).toBe(book("LIB-0001").totalCopies - 1);
});

test("the last copy goes to exactly one of several simultaneous requests", async () => {
  // LIB-0004 has 4 copies, 2 already out on the overdue loans; ask for 4 at once with 4 students.
  const four = free.slice(1, 5);
  expect(four.length).toBe(4);
  const results = await Promise.all(four.map((id) => issue({ studentId: id }, "LIB-0004")));
  const codes = results.map((r) => r.status()).sort();
  expect(codes).toEqual([201, 201, 409, 409]);
  await refresh();
  expect(book("LIB-0004").availableCopies).toBe(0);
});

test("overdue borrowers are blocked; a late return creates a fine that blocks until settled", async () => {
  const [late1, late2] = overdue as [Loan, Loan];
  // Still holding an overdue book.
  const blocked = await issue({ studentId: late1.borrowerId }, "LIB-0002");
  expect(blocked.status()).toBe(409);
  expect((await blocked.json()).code).toBe("has_overdue");
  expect(late1.daysLate).toBeGreaterThanOrEqual(6);
  expect(late1.fine).toBe(late1.daysLate); // Rs 1 per day

  const ret = await librarian.post(`/api/library/loans/${late1.id}/return`);
  expect(ret.status()).toBe(200);
  const returned: Loan = (await ret.json()).loan;
  expect(returned).toMatchObject({ status: "returned", fineStatus: "due", fine: late1.daysLate });
  expect((await librarian.post(`/api/library/loans/${late1.id}/return`)).status()).toBe(409); // not twice

  const unpaid = await issue({ studentId: late1.borrowerId }, "LIB-0002");
  expect(unpaid.status()).toBe(409);
  expect((await unpaid.json()).code).toBe("unpaid_fine");

  expect(
    (
      await librarian.patch(`/api/library/loans/${late1.id}/fine`, { data: { status: "waived" } })
    ).status(),
  ).toBe(403);
  expect(
    (
      await librarian.patch(`/api/library/loans/${late1.id}/fine`, { data: { status: "paid" } })
    ).status(),
  ).toBe(200);
  expect(
    (
      await librarian.patch(`/api/library/loans/${late1.id}/fine`, { data: { status: "paid" } })
    ).status(),
  ).toBe(409);
  expect((await issue({ studentId: late1.borrowerId }, "LIB-0002")).status()).toBe(201); // free again

  // Waiving at the desk is for the principal; the librarian cannot.
  expect(
    (
      await librarian.post(`/api/library/loans/${late2.id}/return`, { data: { waiveFine: true } })
    ).status(),
  ).toBe(403);
  const waived = await principal.post(`/api/library/loans/${late2.id}/return`, {
    data: { waiveFine: true },
  });
  expect(waived.status()).toBe(200);
  expect((await waived.json()).loan).toMatchObject({ fineStatus: "waived", fine: late2.daysLate });
  expect((await issue({ studentId: late2.borrowerId }, "LIB-0005")).status()).toBe(201);
  expect((await other.post(`/api/library/loans/${late2.id}/return`)).status()).toBe(404);
});

test("on-time returns are free and give the copy back", async () => {
  const [a] = free;
  const mine = (await (await librarian.get(`/api/library/loans?studentId=${a}&status=open`)).json())
    .items as Loan[];
  expect(mine.length).toBe(3);
  await refresh();
  const before = book("LIB-0001").availableCopies;
  const loan = mine.find(
    (l) => (l as unknown as { accessionNo: string }).accessionNo === "LIB-0001",
  )!;
  const ret = await librarian.post(`/api/library/loans/${loan.id}/return`);
  expect((await ret.json()).loan).toMatchObject({
    status: "returned",
    fine: 0,
    fineStatus: "none",
  });
  await refresh();
  expect(book("LIB-0001").availableCopies).toBe(before + 1);
  expect(
    (
      await librarian.patch(`/api/library/loans/${loan.id}/fine`, { data: { status: "paid" } })
    ).status(),
  ).toBe(409);
  expect(
    (await librarian.patch(`/api/library/loans/nope/fine`, { data: { status: "paid" } })).status(),
  ).toBe(404);
});

test("editing books: copies stay consistent, cannot drop below copies out or retire while lent", async () => {
  await refresh();
  const b = book("LIB-0005"); // 5 copies, 2 out (student a and late2)
  const out = b.totalCopies - b.availableCopies;
  expect(out).toBeGreaterThanOrEqual(1);
  expect(out).toBeGreaterThanOrEqual(2);
  expect(
    (await librarian.patch(`/api/library/books/${b.id}`, { data: { totalCopies: 1 } })).status(),
  ).toBe(409);
  expect(
    (await librarian.patch(`/api/library/books/${b.id}`, { data: { status: "retired" } })).status(),
  ).toBe(409);
  expect(
    (
      await librarian.patch(`/api/library/books/${b.id}`, {
        data: { totalCopies: b.totalCopies + 3 },
      })
    ).status(),
  ).toBe(200);
  const after = await (await librarian.get(`/api/library/books/${b.id}`)).json();
  expect(after.totalCopies).toBe(b.totalCopies + 3);
  expect(after.availableCopies).toBe(b.availableCopies + 3);
  expect(
    (
      await librarian.patch(`/api/library/books/${b.id}`, { data: { accessionNo: "LIB-9999" } })
    ).status(),
  ).toBe(422);
  expect((await other.patch(`/api/library/books/${b.id}`, { data: { shelf: "Z" } })).status()).toBe(
    404,
  );

  // A book nobody holds can be retired; it then disappears for readers and cannot be issued.
  const fresh = (
    await librarian.post("/api/library/books", {
      data: { title: "Old Almanac", author: "Anon", category: "Reference", totalCopies: 1 },
    })
  ).status();
  expect(fresh).toBe(201);
  await refresh();
  const alm = books.find((x) => x.title === "Old Almanac")!;
  expect(
    (
      await librarian.patch(`/api/library/books/${alm.id}`, { data: { status: "retired" } })
    ).status(),
  ).toBe(200);
  expect((await teacher.get(`/api/library/books/${alm.id}`)).status()).toBe(404);
  const hidden = (await (await teacher.get("/api/library/books?q=almanac")).json()).items;
  expect(hidden).toEqual([]);
  expect(
    (
      await librarian.post("/api/library/loans", { data: { bookId: alm.id, studentId: free[7] } })
    ).status(),
  ).toBe(422);
});

test("parents see only their own children's loans; other schools see none", async () => {
  const mine = (await (await parent.get("/api/library/loans")).json()).items as Loan[];
  expect(mine.length).toBeGreaterThan(0);
  const kids: { id: string }[] = await (await parent.get("/api/me/children")).json();
  expect(mine.every((l) => kids.some((k) => k.id === l.borrowerId))).toBe(true);
  expect(mine.some((l) => l.fineStatus === "paid" || l.fineStatus === "waived")).toBe(true);
  expect((await (await other.get("/api/library/loans")).json()).items).toEqual([]);
  expect((await parent.post("/api/library/loans/x/return")).status()).toBe(403);
});
