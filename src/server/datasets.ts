import type { Role } from "@/types";
import { prisma } from "./db";
import { paidOf } from "./fees";
import { dayStr } from "./homework";

interface Dataset {
  key: string;
  title: string;
  roles: readonly Role[];
  columns: string[];
  rows: (tenantId: string) => Promise<(string | number)[][]>;
}

const LEAD = ["school_owner", "principal"] as const;
const withClass = { section: { include: { class: true } } } as const;
const classOf = (s: { section: { name: string; class: { name: string } } | null }) =>
  s.section ? `${s.section.class.name} ${s.section.name}` : "";

export const DATASETS: readonly Dataset[] = [
  {
    key: "students",
    title: "Students",
    roles: [...LEAD, "vice_principal", "admission_officer"],
    columns: ["Admission no.", "Name", "Class", "Gender", "Status", "Guardian", "Phone"],
    rows: async (tenantId) =>
      (
        await prisma.student.findMany({
          where: { tenantId },
          include: { ...withClass, guardian: true },
          orderBy: { name: "asc" },
          take: 5000,
        })
      ).map((s) => [
        s.admissionNo,
        s.name,
        classOf(s),
        s.gender ?? "",
        s.status,
        s.guardian?.name ?? "",
        s.guardian?.phone ?? "",
      ]),
  },
  {
    key: "staff",
    title: "Staff",
    roles: [...LEAD, "hr"],
    columns: ["Employee no.", "Name", "Role", "Department", "Phone", "Status"],
    rows: async (tenantId) =>
      (await prisma.staff.findMany({ where: { tenantId }, orderBy: { name: "asc" } })).map((s) => [
        s.employeeNo,
        s.name,
        s.role,
        s.department ?? "",
        s.phone ?? "",
        s.status,
      ]),
  },
  {
    key: "attendance",
    title: "Student attendance",
    roles: [...LEAD, "vice_principal"],
    columns: ["Student", "Class", "Days marked", "Present or late", "Absent", "Leave", "Percent"],
    rows: async (tenantId) => {
      const students = await prisma.student.findMany({
        where: { tenantId, status: "active" },
        include: { ...withClass, attendance: { select: { status: true } } },
        orderBy: { name: "asc" },
        take: 5000,
      });
      return students.map((s) => {
        const n = (x: string[]) => s.attendance.filter((a) => x.includes(a.status)).length;
        const total = s.attendance.length;
        const here = n(["present", "late"]);
        return [
          s.name,
          classOf(s),
          total,
          here,
          n(["absent"]),
          n(["leave"]),
          total ? Math.round((here / total) * 100) : "",
        ];
      });
    },
  },
  {
    key: "fees",
    title: "Fee invoices",
    roles: [...LEAD, "accountant"],
    columns: ["Invoice", "Student", "Title", "Due on", "Amount", "Paid", "Balance"],
    rows: async (tenantId) =>
      (
        await prisma.invoice.findMany({
          where: { tenantId },
          include: { student: { select: { name: true } }, payments: true },
          orderBy: { dueOn: "desc" },
          take: 5000,
        })
      ).map((i) => [
        i.number,
        i.student.name,
        i.title,
        dayStr(i.dueOn),
        i.amountPaise / 100,
        paidOf(i) / 100,
        (i.amountPaise - paidOf(i)) / 100,
      ]),
  },
  {
    key: "admissions",
    title: "Admission enquiries",
    roles: [...LEAD, "vice_principal", "admission_officer"],
    columns: ["Child", "Guardian", "Phone", "Source", "Stage", "Received"],
    rows: async (tenantId) =>
      (
        await prisma.admission.findMany({
          where: { tenantId },
          orderBy: { createdAt: "desc" },
          take: 5000,
        })
      ).map((a) => [
        a.studentName,
        a.guardianName,
        a.guardianPhone,
        a.source,
        a.stage,
        dayStr(a.createdAt),
      ]),
  },
  {
    key: "workload",
    title: "Teacher workload",
    roles: [...LEAD, "vice_principal"],
    columns: ["Teacher", "Periods a week", "Classes", "Homework set"],
    rows: async (tenantId) => {
      const [teachers, homework] = await Promise.all([
        prisma.staff.findMany({
          where: { tenantId, role: "teacher", status: "active" },
          include: { periods: { select: { sectionId: true } } },
          orderBy: { name: "asc" },
        }),
        prisma.homework.findMany({ where: { tenantId }, select: { createdById: true } }),
      ]);
      return teachers.map((t) => [
        t.name,
        t.periods.length,
        new Set(t.periods.map((p) => p.sectionId)).size,
        homework.filter((h) => h.createdById === t.userId).length,
      ]);
    },
  },
];
