import { HttpError } from "./auth";
import { STANDARD_CLASSES } from "./classes";
import { prisma } from "./db";

/**
 * Sample data for the demonstration school only (see isDemoSlug). Everything is fictional. It fills
 * the school with classes, students, fees, attendance, results, homework, timetable, library and
 * transport so every screen has something to show, on the school side and the parent side.
 * Nothing here is marked: removing it later means clearing the school's operational data.
 */
export const isDemoSlug = (slug: string) =>
  (process.env.DEMO_SCHOOL_SLUGS ?? "demoschool")
    .split(",")
    .map((s) => s.trim())
    .includes(slug);

const day = (offset: number) => {
  const t = Date.parse(new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10));
  return new Date(t + offset * 86_400_000);
};
const pad = (n: number, w = 4) => String(n).padStart(w, "0");
/** Repeatable "randomness": the same demo school every time. */
const pick = <T>(a: readonly T[], i: number) => a[i % a.length]!;
const mix = (i: number, m: number) => ((i * 2654435761) >>> 0) % m;

const FIRST_M = [
  "Aarav",
  "Vihaan",
  "Reyansh",
  "Arjun",
  "Kabir",
  "Ishaan",
  "Rohan",
  "Dev",
  "Yash",
  "Krish",
];
const FIRST_F = [
  "Ananya",
  "Diya",
  "Isha",
  "Meera",
  "Saanvi",
  "Kiara",
  "Riya",
  "Aditi",
  "Navya",
  "Tara",
];
const LAST = [
  "Verma",
  "Iyer",
  "Reddy",
  "Das",
  "Khan",
  "Mehta",
  "Gupta",
  "Nair",
  "Sharma",
  "Patel",
  "Roy",
  "Bose",
];
const FATHERS = [
  "Rajesh",
  "Sanjay",
  "Anil",
  "Manoj",
  "Vivek",
  "Sunil",
  "Amit",
  "Deepak",
  "Ramesh",
  "Suresh",
];

const SUBJECTS = ["English", "Mathematics", "Science", "Social Studies", "Hindi"];
const SECTIONS: [string, string][] = [
  ["Class 5", "A"],
  ["Class 8", "A"],
  ["Class 8", "B"],
  ["Class 10", "A"],
];

export function loadDemoData(tenantId: string, userId: string, userName: string) {
  // One transaction: either all the sample data is there or none of it.
  return prisma.$transaction((tx) => fill(tx, tenantId, userId, userName), {
    timeout: 55_000,
    maxWait: 10_000,
  });
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function fill(tx: Tx, tenantId: string, userId: string, userName: string) {
  const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  if (!isDemoSlug(tenant.slug))
    throw new HttpError(403, "not_demo", "Sample data can only be loaded into the demo school.");
  if ((await tx.student.count({ where: { tenantId } })) > 3)
    throw new HttpError(409, "already_loaded", "This school already has students.");

  const year =
    (await tx.academicYear.findFirst({ where: { tenantId, current: true } })) ??
    (await tx.academicYear.findFirstOrThrow({ where: { tenantId } }));
  const campus = await tx.campus.findFirst({ where: { tenantId } });

  // Classes and sections A and B (what is already there is kept).
  const have = new Set((await tx.classLevel.findMany({ where: { tenantId } })).map((c) => c.name));
  const fresh = STANDARD_CLASSES.map((c, position) => ({ ...c, position })).filter(
    (c) => !have.has(c.name),
  );
  if (fresh.length)
    await tx.classLevel.createMany({
      data: fresh.map((c) => ({
        tenantId,
        campusId: campus?.id,
        name: c.name,
        stage: c.stage,
        position: c.position,
      })),
    });
  const levels = await tx.classLevel.findMany({
    where: { tenantId },
    include: { sections: true },
  });
  const missing = levels.flatMap((l) =>
    ["A", "B"]
      .filter((n) => !l.sections.some((s) => s.name === n))
      .map((name) => ({ tenantId, classId: l.id, name })),
  );
  if (missing.length) await tx.section.createMany({ data: missing });

  // Subjects for every class.
  const haveSubj = new Set(
    (await tx.subject.findMany({ where: { tenantId } })).map((s) => `${s.classId}|${s.name}`),
  );
  const subjRows = levels.flatMap((l) =>
    SUBJECTS.filter((n) => !haveSubj.has(`${l.id}|${n}`)).map((name) => ({
      tenantId,
      classId: l.id,
      name,
    })),
  );
  if (subjRows.length) await tx.subject.createMany({ data: subjRows });

  const classes = await tx.classLevel.findMany({
    where: { tenantId },
    include: { sections: true, subjects: true },
  });
  const sectionDefs = SECTIONS.map(([cn, sn]) => {
    const c = classes.find((x) => x.name === cn)!;
    return { cls: c, section: c.sections.find((s) => s.name === sn)! };
  });

  // Staff.
  const staffSeed: [string, string, string, string][] = [
    ["Priya Nair", "teacher", "Senior Teacher, Mathematics", "9811100001"],
    ["Rahul Menon", "teacher", "Teacher, English", "9811100002"],
    ["Sunita Rao", "teacher", "Teacher, Science", "9811100003"],
    ["Neha Kapoor", "teacher", "Teacher, Social Studies", "9811100004"],
    ["Vikram Singh", "accountant", "Accounts Officer", "9811100005"],
    ["Meena Kulkarni", "librarian", "Librarian", "9811100006"],
    ["Ramesh Yadav", "driver", "Bus Driver", "9811100007"],
  ];
  const haveStaff = await tx.staff.count({ where: { tenantId } });
  await tx.staff.createMany({
    data: staffSeed.map(([name, role, designation, phone], i) => ({
      tenantId,
      employeeNo: `EMP-2026-${pad(haveStaff + i + 1)}`,
      name,
      role,
      designation,
      phone: `+91 ${phone}`,
      joinedOn: new Date("2024-06-03"),
    })),
  });
  const staff = await tx.staff.findMany({
    where: { tenantId },
    orderBy: { employeeNo: "asc" },
  });
  const teachers = staff.filter((s) => s.role === "teacher").slice(-4);
  const accountant = staff.find((s) => s.role === "accountant");
  const driver = staff.find((s) => s.role === "driver");

  // Students, in families (some brothers and sisters share a guardian).
  const existing = await tx.student.findMany({ where: { tenantId } });
  const taken = new Set(existing.map((s) => s.admissionNo));
  let adm = 0;
  const nextAdm = () => {
    for (;;) {
      const no = `ADM-2026-${pad(++adm)}`;
      if (!taken.has(no)) {
        taken.add(no);
        return no;
      }
    }
  };
  const PER_SECTION = 10;
  type Plan = { name: string; gender: string; sectionId: string; family: number };
  const plan: Plan[] = [];
  let fam = 0;
  sectionDefs.forEach((d, si) => {
    for (let k = 0; k < PER_SECTION; k++) {
      const male = (si + k) % 2 === 0;
      const lastName = pick(LAST, si * 3 + k * 5 + (k % 4 === 3 ? 0 : fam));
      plan.push({
        name: `${pick(male ? FIRST_M : FIRST_F, si * 7 + k)} ${lastName}`,
        gender: male ? "male" : "female",
        sectionId: d.section.id,
        family: k % 5 === 4 ? fam : ++fam, // every fifth child is a sibling of the previous family
      });
    }
  });
  const families = [...new Set(plan.map((p) => p.family))];
  await tx.guardian.createMany({
    data: families.map((f) => ({
      tenantId,
      name: `${pick(FATHERS, f)} ${pick(LAST, f * 5)}`,
      relation: "father",
      phone: `+91 98${pad(10000000 + mix(f, 89999999), 8)}`,
    })),
  });
  const newGuardians = await tx.guardian.findMany({
    where: { tenantId, userId: null, students: { none: {} } },
    orderBy: { id: "asc" },
  });
  const gByFamily = new Map(families.map((f, i) => [f, newGuardians[i]!.id]));
  await tx.student.createMany({
    data: plan.map((p, i) => ({
      tenantId,
      admissionNo: nextAdm(),
      name: p.name,
      gender: p.gender,
      sectionId: p.sectionId,
      guardianId: gByFamily.get(p.family),
      category: pick(["General", "General", "OBC", "SC"], i),
      dob: new Date(Date.UTC(2010 + (i % 5), i % 12, 1 + (i % 27))),
      address: `${10 + i}, Park Street, Kolkata`,
    })),
  });
  const demoSectionIds = sectionDefs.map((d) => d.section.id);
  const students = await tx.student.findMany({
    where: { tenantId, sectionId: { in: demoSectionIds }, status: "active" },
    orderBy: { admissionNo: "asc" },
  });

  // Fee heads, and two terms of tuition for everybody with realistic payments.
  await tx.feeHead.createMany({
    data: [
      { tenantId, name: "Tuition", gstPercent: 0 },
      { tenantId, name: "Transport", gstPercent: 0 },
      { tenantId, name: "Exam fee", gstPercent: 0 },
      { tenantId, name: "Annual charges", gstPercent: 0 },
    ],
  });
  const haveInv = await tx.invoice.count({ where: { tenantId } });
  const terms: [string, number, number][] = [
    ["Term 1 tuition fee", -120, 1_250_000],
    ["Term 2 tuition fee", 20, 1_250_000],
  ];
  const invoiceRows = students.flatMap((s, i) =>
    terms.map(([title, off, amountPaise], t) => ({
      tenantId,
      yearId: year.id,
      studentId: s.id,
      number: `INV-2026-${pad(haveInv + i * 2 + t + 1, 5)}`,
      title,
      amountPaise,
      dueOn: day(off),
    })),
  );
  await tx.invoice.createMany({ data: invoiceRows });
  const invoices = await tx.invoice.findMany({
    where: { tenantId, studentId: { in: students.map((s) => s.id) } },
    orderBy: { number: "asc" },
  });
  const havePay = await tx.payment.count({ where: { tenantId } });
  let rec = havePay;
  const payRows: {
    tenantId: string;
    invoiceId: string;
    amountPaise: number;
    mode: string;
    reference: string | null;
    receiptNo: string;
    paidOn: Date;
  }[] = [];
  invoices.forEach((inv, i) => {
    if (!inv.title.startsWith("Term 1")) return;
    const m = mix(i, 10);
    const amount = m < 5 ? inv.amountPaise : m < 7 ? 600_000 : 0; // paid, partly paid, unpaid (overdue)
    if (!amount) return;
    payRows.push({
      tenantId,
      invoiceId: inv.id,
      amountPaise: amount,
      mode: pick(["upi", "cash", "netbanking", "upi"], i),
      reference: m % 2 ? `DEMO-TXN-${pad(i + 1, 5)}` : null,
      receiptNo: `REC-2026-${pad(++rec, 5)}`,
      paidOn: day(-45 + (i % 45)), // some this month, so "collected this month" is not empty
    });
  });
  await tx.payment.createMany({ data: payRows });

  // Attendance for the last 15 school days.
  const dates: Date[] = [];
  for (let off = 0; dates.length < 15; off--) {
    const d = day(off);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) dates.push(d);
  }
  const attRows = dates.flatMap((d, di) =>
    students.map((s, si) => {
      const m = mix(di * 131 + si, 100);
      return {
        tenantId,
        sectionId: s.sectionId!,
        studentId: s.id,
        date: d,
        status: m < 88 ? "present" : m < 94 ? "absent" : m < 98 ? "late" : "leave",
      };
    }),
  );
  await tx.attendance.createMany({ data: attRows });
  await tx.attendanceSheet.createMany({
    data: dates.flatMap((d) =>
      demoSectionIds.map((sectionId) => ({
        tenantId,
        sectionId,
        date: d,
        status: "submitted",
        submittedBy: userName,
        submittedAt: d,
      })),
    ),
  });

  // Two exams with published results.
  const exams = await Promise.all(
    [
      ["Unit Test 1", 50],
      ["Term 1", 100],
    ].map(([name, maxMarks]) =>
      tx.exam.create({
        data: {
          tenantId,
          yearId: year.id,
          name: String(name),
          maxMarks: Number(maxMarks),
          approvedAt: day(-30),
          approvedById: userId,
          published: true,
          publishedAt: day(-28),
        },
      }),
    ),
  );
  const subjectsOf = (classId: string) => classes.find((c) => c.id === classId)!.subjects;
  const sectionClass = new Map(sectionDefs.map((d) => [d.section.id, d.cls.id]));
  const markRows = exams.flatMap((ex, ei) =>
    students.flatMap((s, si) =>
      subjectsOf(sectionClass.get(s.sectionId!)!)
        .filter((sub) => SUBJECTS.includes(sub.name))
        .map((sub, ui) => ({
          tenantId,
          examId: ex.id,
          subjectId: sub.id,
          studentId: s.id,
          score: Math.round(((40 + mix(si * 17 + ui * 5 + ei, 58)) / 100) * ex.maxMarks),
        })),
    ),
  );
  await tx.mark.createMany({ data: markRows });

  // Homework with who did it.
  const hwTitles: [string, string][] = [
    ["Chapter exercise", "Complete the exercise at the end of the chapter."],
    ["Revision worksheet", "Solve the worksheet given in class."],
    ["Reading and notes", "Read the next chapter and write five key points."],
  ];
  const hwRows = sectionDefs.flatMap((d, si) =>
    hwTitles.map(([title, description], hi) => {
      const sub = subjectsOf(d.cls.id)[(si + hi) % 5]!;
      return {
        tenantId,
        sectionId: d.section.id,
        subjectId: sub.id,
        title: `${sub.name}: ${title}`,
        description,
        assignedOn: day(-6 + hi),
        dueOn: day(hi === 0 ? -1 : hi + 1),
        status: "published",
        createdById: userId,
        authorName: userName,
      };
    }),
  );
  await tx.homework.createMany({ data: hwRows });
  const homework = await tx.homework.findMany({ where: { tenantId } });
  const hsRows = homework.flatMap((h, hi) =>
    students
      .filter((s) => s.sectionId === h.sectionId)
      .map((s, si) => ({
        tenantId,
        homeworkId: h.id,
        studentId: s.id,
        status: mix(hi * 13 + si, 10) < 7 ? "done" : "missing",
      })),
  );
  await tx.homeworkStatus.createMany({ data: hsRows });

  // Timetable: bell schedule plus a week for each demo section.
  const bell: [number, string, string, string, boolean][] = [
    [1, "Period 1", "08:00", "08:40", false],
    [2, "Period 2", "08:40", "09:20", false],
    [3, "Period 3", "09:20", "10:00", false],
    [4, "Break", "10:00", "10:20", true],
    [5, "Period 4", "10:20", "11:00", false],
    [6, "Period 5", "11:00", "11:40", false],
    [7, "Period 6", "11:40", "12:20", false],
  ];
  if ((await tx.bellSlot.count({ where: { tenantId } })) === 0)
    await tx.bellSlot.createMany({
      data: bell.map(([slot, label, startsAt, endsAt, isBreak]) => ({
        tenantId,
        slot,
        label,
        startsAt,
        endsAt,
        isBreak,
      })),
    });
  const lessonSlots = [1, 2, 3, 5, 6, 7];
  const periodRows = sectionDefs.flatMap((d, si) =>
    [1, 2, 3, 4, 5].flatMap((dayNo) =>
      lessonSlots.map((slot, k) => ({
        tenantId,
        sectionId: d.section.id,
        day: dayNo,
        slot,
        subjectId: subjectsOf(d.cls.id)[(k + dayNo + si) % 5]!.id,
        staffId: teachers[(si + k) % 4]!.id,
        room: `Room ${d.cls.name.replace("Class ", "")}${d.section.name}`,
      })),
    ),
  );
  await tx.period.createMany({ data: periodRows });

  // Library.
  const books: [string, string, string, string, number][] = [
    ["Wings of Fire", "A. P. J. Abdul Kalam", "Biography", "Shelf A1", 3],
    ["Malgudi Days", "R. K. Narayan", "Fiction", "Shelf B2", 2],
    ["The Discovery of India", "Jawaharlal Nehru", "History", "Shelf C1", 1],
    ["Panchatantra Tales", "Vishnu Sharma", "Children", "Shelf D4", 4],
    ["Concise Mathematics Class 8", "Selina Publishers", "Textbook", "Shelf E1", 5],
    ["Gitanjali", "Rabindranath Tagore", "Poetry", "Shelf B5", 2],
  ];
  await tx.book.createMany({
    data: books.map(([title, author, category, shelf, copies], i) => ({
      tenantId,
      accessionNo: `LIB-${pad(i + 1)}`,
      title,
      author,
      category,
      shelf,
      totalCopies: copies,
      availableCopies: copies,
    })),
  });
  const lent = await tx.book.findFirstOrThrow({ where: { tenantId, accessionNo: "LIB-0004" } });
  const borrowers = students.slice(0, 2);
  await tx.loan.createMany({
    data: borrowers.map((s, i) => ({
      tenantId,
      bookId: lent.id,
      studentId: s.id,
      issuedOn: day(-20 - i),
      dueOn: day(-6 - i),
      issuedById: accountant?.userId ?? userId,
    })),
  });
  await tx.book.update({
    where: { id: lent.id },
    data: { availableCopies: { decrement: borrowers.length } },
  });

  // Transport: two vehicles (one with an expired fitness certificate), one route, riders.
  const bus = await tx.vehicle.create({
    data: {
      tenantId,
      regNo: "WB02AB1234",
      type: "bus",
      capacity: 40,
      insuranceExpiry: day(200),
      fitnessExpiry: day(200),
    },
  });
  await tx.vehicle.create({
    data: {
      tenantId,
      regNo: "WB02CD5678",
      type: "van",
      capacity: 12,
      insuranceExpiry: day(200),
      fitnessExpiry: day(-10),
    },
  });
  const route = await tx.transportRoute.create({
    data: {
      tenantId,
      name: "Route 1 - North",
      vehicleId: bus.id,
      driverId: driver?.id,
      monthlyFeePaise: 120_000,
    },
  });
  const stops: [string, string, string][] = [
    ["Hebbal Circle", "07:00", "15:30"],
    ["Yelahanka Gate", "07:15", "15:15"],
    ["School Gate", "07:45", "15:00"],
  ];
  await tx.routeStop.createMany({
    data: stops.map(([name, pickupTime, dropTime], i) => ({
      tenantId,
      routeId: route.id,
      name,
      sequence: i + 1,
      pickupTime,
      dropTime,
    })),
  });
  const routeStops = await tx.routeStop.findMany({ where: { routeId: route.id } });
  await tx.studentTransport.createMany({
    data: students.slice(0, 9).map((s, i) => ({
      tenantId,
      studentId: s.id,
      routeId: route.id,
      stopId: routeStops[i % routeStops.length]!.id,
    })),
  });

  // Notices and admission enquiries.
  await tx.notice.createMany({
    data: [
      [
        "Annual sports day",
        "Annual sports day will be held on 14 December. All students to wear house colours.",
      ],
      [
        "Parent-teacher meeting",
        "The parent-teacher meeting is on Saturday, 29 November, 10 am to 1 pm.",
      ],
      ["Winter uniform", "Winter uniform is to be worn from 1 December."],
      [
        "Fee reminder",
        "Term 1 fees that are still due must be paid this week to avoid a late fee.",
      ],
    ].map(([title, body], i) => ({
      tenantId,
      title: title!,
      body: body!,
      status: "published",
      authorName: userName,
      publishedAt: day(-3 - i),
    })),
  });
  const c1 = classes.find((c) => c.name === "Class 1")!;
  await tx.admission.createMany({
    data: ["new", "documents", "review", "decision"].map((stage, i) => ({
      tenantId,
      studentName: ["Riya Menon", "Dev Kapoor", "Sana Sheikh", "Om Tiwari"][i]!,
      applyingForId: c1.id,
      guardianName: `Parent ${i + 1}`,
      guardianPhone: `+91 98${pad(76543210 + i, 8)}`,
      stage,
    })),
  });
  // The demonstration school is fictional, so it needs no go-live checklist; families can sign in.
  await tx.tenant.update({
    where: { id: tenantId },
    data: { status: "live", wentLiveAt: new Date() },
  });
  await tx.auditLog.create({
    data: { tenantId, userId, action: "demo.load", entity: "tenant", entityId: tenantId },
  });
  return {
    students: students.length,
    invoices: invoices.length,
    payments: payRows.length,
    attendance: attRows.length,
    marks: markRows.length,
  };
}

/**
 * Clears the demonstration school's operational data (students, fees, attendance, results,
 * homework, timetable, library, transport, notices, staff, admissions) so it can be filled again,
 * or so the school can start clean. Classes, the school's own settings and every login stay. A
 * student whose guardian has a login is kept, with that guardian.
 */
export async function clearDemoData(tenantId: string) {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  if (!isDemoSlug(tenant.slug))
    throw new HttpError(403, "not_demo", "Only the demo school can be cleared this way.");
  return prisma.$transaction(
    async (tx) => {
      const where = { tenantId };
      await tx.refund.deleteMany({ where });
      await tx.feeReminder.deleteMany({ where });
      await tx.paymentProof.deleteMany({ where });
      await tx.paymentAttempt.deleteMany({ where });
      await tx.ledgerEntry.deleteMany({ where });
      await tx.certificate.deleteMany({ where });
      await tx.payment.deleteMany({ where });
      await tx.invoice.deleteMany({ where });
      await tx.feeHead.deleteMany({ where });
      await tx.attendance.deleteMany({ where });
      await tx.attendanceSheet.deleteMany({ where });
      await tx.mark.deleteMany({ where });
      await tx.markSheet.deleteMany({ where });
      await tx.exam.deleteMany({ where });
      await tx.homeworkStatus.deleteMany({ where });
      await tx.homework.deleteMany({ where });
      await tx.period.deleteMany({ where });
      await tx.bellSlot.deleteMany({ where });
      await tx.loan.deleteMany({ where });
      await tx.book.deleteMany({ where });
      await tx.studentTransport.deleteMany({ where });
      await tx.routeStop.deleteMany({ where });
      await tx.transportRoute.deleteMany({ where });
      await tx.vehicle.deleteMany({ where });
      await tx.notice.deleteMany({ where });
      await tx.admission.deleteMany({ where });
      await tx.staff.deleteMany({ where: { tenantId, userId: null } });
      const students = await tx.student.deleteMany({
        where: {
          tenantId,
          userId: null,
          OR: [{ guardianId: null }, { guardian: { userId: null } }],
        },
      });
      await tx.guardian.deleteMany({ where: { tenantId, userId: null, students: { none: {} } } });
      await tx.auditLog.create({
        data: { tenantId, action: "demo.clear", entity: "tenant", entityId: tenantId },
      });
      return { studentsRemoved: students.count };
    },
    { timeout: 55_000, maxWait: 10_000 },
  );
}
