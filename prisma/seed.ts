/**
 * Development seed: reference data (boards, states, districts) plus ONE fictional demo school.
 * The demo logins below are for local development only. Never run this against production.
 */
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { ALL_BOARDS } from "../src/data/boards";
import { STATES_AND_DISTRICTS, UT_NAMES } from "../src/data/india-geo";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }),
});

const DEV_PASSWORD = "ChangeMe#2026";

async function reference() {
  for (const [name, districts] of Object.entries(STATES_AND_DISTRICTS)) {
    const state = await prisma.state.upsert({
      where: { name },
      update: {},
      create: { name, kind: UT_NAMES.has(name) ? "ut" : "state" },
    });
    for (const d of districts) {
      await prisma.district.upsert({
        where: { stateId_name: { stateId: state.id, name: d } },
        update: {},
        create: { name: d, stateId: state.id },
      });
    }
  }
  for (const b of ALL_BOARDS) {
    await prisma.board.upsert({
      where: { code: b.code },
      update: { name: b.name, gradeScale: JSON.stringify(b.scale) },
      create: {
        code: b.code,
        name: b.name,
        kind: b.kind,
        stateCode: b.stateName ?? null,
        gradeScale: JSON.stringify(b.scale),
      },
    });
  }
}

const CLASSES: [string, string][] = [
  ["Nursery", "pre-primary"],
  ["LKG", "pre-primary"],
  ["UKG", "pre-primary"],
  ...Array.from({ length: 12 }, (_, i): [string, string] => [
    `Class ${i + 1}`,
    i < 5 ? "primary" : i < 8 ? "middle" : i < 10 ? "secondary" : "senior-secondary",
  ]),
];

async function demoSchool() {
  const karnataka = await prisma.state.findUnique({ where: { name: "Karnataka" } });
  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo-school" },
    update: {},
    create: {
      slug: "demo-school",
      name: "Demo Public School (fictional)",
      plan: "trial",
      stateId: karnataka?.id,
    },
  });
  const cbse = await prisma.board.findUniqueOrThrow({ where: { code: "CBSE" } });
  await prisma.tenantBoard.upsert({
    where: { tenantId_boardId: { tenantId: tenant.id, boardId: cbse.id } },
    update: { isDefault: true },
    create: { tenantId: tenant.id, boardId: cbse.id, isDefault: true },
  });

  const year = await prisma.academicYear.upsert({
    where: { tenantId_label: { tenantId: tenant.id, label: "2026-27" } },
    update: {},
    create: {
      tenantId: tenant.id,
      label: "2026-27",
      startsOn: new Date("2026-04-01"),
      endsOn: new Date("2027-03-31"),
      current: true,
    },
  });

  const hash = await bcrypt.hash(DEV_PASSWORD, 10);
  const people: [string, string, string][] = [
    ["principal@demo.test", "Anita Sharma", "principal"],
    ["teacher@demo.test", "Priya Nair", "teacher"],
    ["accountant@demo.test", "Vikram Singh", "accountant"],
    ["librarian@demo.test", "Meena Kulkarni", "librarian"],
    ["transport@demo.test", "Dinesh Patil", "transport"],
    ["parent@demo.test", "Suresh Patel", "parent"],
  ];
  for (const [email, name, role] of people) {
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name, passwordHash: hash },
    });
    await prisma.membership.upsert({
      where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
      update: { role },
      create: { userId: user.id, tenantId: tenant.id, role },
    });
  }
  await prisma.user.upsert({
    where: { email: "platform@demo.test" },
    update: {},
    create: {
      email: "platform@demo.test",
      name: "Platform Admin",
      passwordHash: hash,
      isPlatformAdmin: true,
    },
  });

  const sections: string[] = [];
  for (const [i, [name, stage]] of CLASSES.entries()) {
    const c = await prisma.classLevel.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name } },
      update: {},
      create: { tenantId: tenant.id, name, stage, position: i },
    });
    for (const sec of ["A", "B"]) {
      const s = await prisma.section.upsert({
        where: { classId_name: { classId: c.id, name: sec } },
        update: {},
        create: { tenantId: tenant.id, classId: c.id, name: sec },
      });
      if (name === "Class 8" || name === "Class 9") sections.push(s.id);
    }
  }

  const first = ["Aarav", "Ananya", "Vihaan", "Diya", "Reyansh", "Isha", "Arjun", "Meera"];
  const last = ["Verma", "Iyer", "Reddy", "Das", "Khan", "Mehta", "Gupta", "Nair"];
  const parentUser = await prisma.user.findUniqueOrThrow({ where: { email: "parent@demo.test" } });
  const guardian = await prisma.guardian.create({
    data: {
      tenantId: tenant.id,
      userId: parentUser.id,
      name: "Suresh Patel",
      relation: "father",
      phone: "+91 9876543210",
    },
  });
  let n = 0;
  for (const sectionId of sections) {
    for (let k = 0; k < 4; k++, n++) {
      const admissionNo = `ADM-${String(n + 1).padStart(4, "0")}`;
      await prisma.student.upsert({
        where: { tenantId_admissionNo: { tenantId: tenant.id, admissionNo } },
        update: {},
        create: {
          tenantId: tenant.id,
          admissionNo,
          name: `${first[n % 8]} ${last[(n * 3) % 8]}`,
          gender: n % 2 ? "female" : "male",
          sectionId,
          guardianId: guardian.id,
          category: "General",
        },
      });
    }
  }

  const students = await prisma.student.findMany({ where: { tenantId: tenant.id } });
  for (const [i, s] of students.entries()) {
    await prisma.invoice.upsert({
      where: {
        tenantId_number: {
          tenantId: tenant.id,
          number: `INV-2026-${String(i + 1).padStart(4, "0")}`,
        },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        yearId: year.id,
        studentId: s.id,
        number: `INV-2026-${String(i + 1).padStart(4, "0")}`,
        title: "Term 1 tuition fee",
        amountPaise: 1_250_000,
        dueOn: new Date("2026-07-10"),
      },
    });
  }

  // Subjects for every class, one exam, and a couple of notices.
  const classes = await prisma.classLevel.findMany({ where: { tenantId: tenant.id } });
  for (const c of classes) {
    for (const name of ["English", "Mathematics", "Science"]) {
      await prisma.subject.upsert({
        where: { classId_name: { classId: c.id, name } },
        update: {},
        create: { tenantId: tenant.id, classId: c.id, name },
      });
    }
  }
  // Staff directory (fictional) and the bell schedule.
  const teacherUser = await prisma.user.findUniqueOrThrow({
    where: { email: "teacher@demo.test" },
  });
  const acctUser = await prisma.user.findUniqueOrThrow({
    where: { email: "accountant@demo.test" },
  });
  const staffSeed: [string, string, string, string, string | null][] = [
    ["EMP-2026-0001", "Priya Nair", "teacher", "Senior Teacher, Mathematics", teacherUser.id],
    ["EMP-2026-0002", "Rahul Menon", "teacher", "Teacher, English", null],
    ["EMP-2026-0003", "Sunita Rao", "teacher", "Teacher, Science", null],
    ["EMP-2026-0004", "Vikram Singh", "accountant", "Accounts Officer", acctUser.id],
  ];
  for (const [employeeNo, name, role, designation, userId] of staffSeed) {
    await prisma.staff.upsert({
      where: { tenantId_employeeNo: { tenantId: tenant.id, employeeNo } },
      update: {},
      create: {
        tenantId: tenant.id,
        employeeNo,
        name,
        role,
        designation,
        userId,
        joinedOn: new Date("2024-06-03"),
      },
    });
  }
  const bell: [number, string, string, string, boolean][] = [
    [1, "Period 1", "08:00", "08:40", false],
    [2, "Period 2", "08:40", "09:20", false],
    [3, "Period 3", "09:20", "10:00", false],
    [4, "Break", "10:00", "10:20", true],
    [5, "Period 4", "10:20", "11:00", false],
    [6, "Period 5", "11:00", "11:40", false],
    [7, "Period 6", "11:40", "12:20", false],
    [8, "Period 7", "12:20", "13:00", false],
  ];
  for (const [slot, label, startsAt, endsAt, isBreak] of bell) {
    await prisma.bellSlot.upsert({
      where: { tenantId_slot: { tenantId: tenant.id, slot } },
      update: {},
      create: { tenantId: tenant.id, slot, label, startsAt, endsAt, isBreak },
    });
  }
  const books: [string, string, string, string, number][] = [
    ["LIB-0001", "Wings of Fire", "A. P. J. Abdul Kalam", "Biography", 3],
    ["LIB-0002", "Malgudi Days", "R. K. Narayan", "Fiction", 2],
    ["LIB-0003", "The Discovery of India", "Jawaharlal Nehru", "History", 1],
    ["LIB-0004", "Panchatantra Tales", "Vishnu Sharma", "Children", 4],
    ["LIB-0005", "Concise Mathematics Class 8", "Selina Publishers", "Textbook", 5],
  ];
  for (const [accessionNo, title, author, category, copies] of books) {
    await prisma.book.upsert({
      where: { tenantId_accessionNo: { tenantId: tenant.id, accessionNo } },
      update: {},
      create: {
        tenantId: tenant.id,
        accessionNo,
        title,
        author,
        category,
        totalCopies: copies,
        availableCopies: copies,
      },
    });
  }
  // Two overdue loans (issued weeks ago) so late-return fines can be exercised.
  if ((await prisma.loan.count({ where: { tenantId: tenant.id } })) === 0) {
    const istDay = (offset: number) =>
      new Date(
        Date.parse(new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10)) +
          offset * 86400_000,
      );
    const borrowers = await prisma.student.findMany({
      where: { tenantId: tenant.id },
      orderBy: { admissionNo: "asc" },
      take: 2,
    });
    const lent = await prisma.book.findFirstOrThrow({
      where: { tenantId: tenant.id, accessionNo: "LIB-0004" },
    });
    for (const [i, st] of borrowers.entries()) {
      await prisma.loan.create({
        data: {
          tenantId: tenant.id,
          bookId: lent.id,
          studentId: st.id,
          issuedOn: istDay(-20 - i),
          dueOn: istDay(-6 - i),
          issuedById: acctUser.id,
        },
      });
    }
    await prisma.book.update({
      where: { id: lent.id },
      data: { availableCopies: { decrement: borrowers.length } },
    });
  }
  // Transport: two vehicles (one with an expired fitness certificate), a driver, one route.
  {
    const day = (offset: number) =>
      new Date(
        Date.parse(new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10)) +
          offset * 86400_000,
      );
    const driver = await prisma.staff.upsert({
      where: { tenantId_employeeNo: { tenantId: tenant.id, employeeNo: "EMP-2026-0005" } },
      update: {},
      create: {
        tenantId: tenant.id,
        employeeNo: "EMP-2026-0005",
        name: "Ramesh Yadav",
        role: "driver",
        designation: "Bus Driver",
        phone: "+91 9811100011",
      },
    });
    const bus = await prisma.vehicle.upsert({
      where: { tenantId_regNo: { tenantId: tenant.id, regNo: "KA01AB1234" } },
      update: {},
      create: {
        tenantId: tenant.id,
        regNo: "KA01AB1234",
        type: "bus",
        capacity: 40,
        insuranceExpiry: day(200),
        fitnessExpiry: day(200),
      },
    });
    await prisma.vehicle.upsert({
      where: { tenantId_regNo: { tenantId: tenant.id, regNo: "KA01CD5678" } },
      update: {},
      create: {
        tenantId: tenant.id,
        regNo: "KA01CD5678",
        type: "van",
        capacity: 12,
        insuranceExpiry: day(200),
        fitnessExpiry: day(-10),
      },
    });
    const route = await prisma.transportRoute.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: "Route 1 - North" } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: "Route 1 - North",
        vehicleId: bus.id,
        driverId: driver.id,
        monthlyFeePaise: 120000,
      },
    });
    const stops: [string, string, string][] = [
      ["Hebbal Circle", "07:00", "15:30"],
      ["Yelahanka Gate", "07:15", "15:15"],
      ["School Gate", "07:45", "15:00"],
    ];
    for (const [i, [name, pickupTime, dropTime]] of stops.entries()) {
      await prisma.routeStop.upsert({
        where: { routeId_name: { routeId: route.id, name } },
        update: {},
        create: {
          tenantId: tenant.id,
          routeId: route.id,
          name,
          sequence: i + 1,
          pickupTime,
          dropTime,
        },
      });
    }
  }
  await prisma.exam.create({
    data: { tenantId: tenant.id, yearId: year.id, name: "Term 1", maxMarks: 100 },
  });
  await prisma.notice.createMany({
    data: [
      {
        tenantId: tenant.id,
        title: "Annual sports day",
        body: "Annual sports day will be held on 14 November.",
        status: "published",
        authorName: "Anita Sharma",
        publishedAt: new Date("2026-10-20"),
      },
      {
        tenantId: tenant.id,
        title: "Draft: winter timings",
        body: "School timings change from 1 December.",
        status: "draft",
        authorName: "Anita Sharma",
      },
    ],
  });
  const firstInvoice = await prisma.invoice.findFirstOrThrow({ where: { tenantId: tenant.id } });
  await prisma.payment.create({
    data: {
      tenantId: tenant.id,
      invoiceId: firstInvoice.id,
      amountPaise: 500_000,
      mode: "upi",
      reference: "DEMO-UPI-0001",
    },
  });

  const c1 = await prisma.classLevel.findFirstOrThrow({
    where: { tenantId: tenant.id, name: "Class 1" },
  });
  const stages = ["new", "documents", "review", "decision"];
  for (const [i, stage] of stages.entries()) {
    await prisma.admission.create({
      data: {
        tenantId: tenant.id,
        studentName: ["Riya Menon", "Dev Kapoor", "Sana Sheikh", "Om Tiwari"][i]!,
        applyingForId: c1.id,
        guardianName: "Parent " + (i + 1),
        guardianPhone: "+91 98" + String(76543210 + i),
        stage,
      },
    });
  }
}

/** A second, unrelated school: used to prove one school can never see another school's data. */
async function otherSchool() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "other-school" },
    update: {},
    create: { slug: "other-school", name: "Other Academy (fictional)", plan: "trial" },
  });
  const icse = await prisma.board.findUniqueOrThrow({ where: { code: "ICSE" } });
  await prisma.tenantBoard.create({
    data: { tenantId: tenant.id, boardId: icse.id, isDefault: true },
  });
  const user = await prisma.user.upsert({
    where: { email: "principal@other.test" },
    update: {},
    create: {
      email: "principal@other.test",
      name: "Neha Rao",
      passwordHash: await bcrypt.hash(DEV_PASSWORD, 10),
    },
  });
  await prisma.membership.upsert({
    where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
    update: {},
    create: { userId: user.id, tenantId: tenant.id, role: "principal" },
  });
  const c = await prisma.classLevel.create({
    data: { tenantId: tenant.id, name: "Class 8", stage: "middle", position: 10 },
  });
  const s = await prisma.section.create({
    data: { tenantId: tenant.id, classId: c.id, name: "A" },
  });
  await prisma.student.create({
    data: { tenantId: tenant.id, admissionNo: "OA-0001", name: "Kabir Joshi", sectionId: s.id },
  });
}

async function main() {
  await reference();
  await demoSchool();
  await otherSchool();
  console.log("Seeded. Dev logins use password:", DEV_PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
