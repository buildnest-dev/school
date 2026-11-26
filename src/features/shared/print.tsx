"use client";

import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/states";
import { useAsync } from "@/hooks/use-async";
import { useServices } from "@/hooks/use-services";
import { fmtDate, rupees } from "./format";
import type { ScreenProps } from "./planned-screen";
import { useData } from "./use-data";

interface Certificate {
  status: string;
  document?: { title: string; statement: string; lines: [string, string][] };
}
interface Receipt {
  receiptNo: string;
  school: { name: string; address: string | null; phone: string | null };
  student: { name: string; admissionNo: string; classSection: string | null };
  invoice: { number: string; title: string; payable: number };
  payment: { amount: number; mode: string; reference: string | null; paidOn: string };
  balanceNow: number;
}
interface ReportCard {
  student: { name: string; admissionNo: string; classSection: string };
  cards: {
    exam: { name: string };
    subjects: { subject: string; score: number | null; max: number; grade: string | null }[];
    total: number;
    maxTotal: number;
    percent: number | null;
    grade: string | null;
    result: string;
    rank: number | null;
    classStrength: number;
  }[];
}
interface Slip {
  month: string;
  name: string;
  employeeNo: string;
  earnings: { label: string; rupees: number }[];
  deductions: { label: string; rupees: number }[];
  net: number;
}

function Rows({ rows }: { rows: [string, string | number][] }) {
  return (
    <dl className="grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-6 gap-y-1 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className="text-ink font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Sheet<T>({
  path,
  sample,
  render,
}: {
  path: string;
  sample: T;
  render: (data: T) => React.ReactNode;
}) {
  const d = useData<T>(path, sample);
  if (d.error) return <ErrorState message={d.error.message} onRetry={d.reload} />;
  if (!d.data) return <LoadingBlock />;
  return (
    <>
      <div className="no-print mb-4 flex flex-wrap gap-2">
        <Button onClick={() => window.print()}>Print or save as PDF</Button>
        <Button variant="ghost" onClick={() => window.history.back()}>
          Back
        </Button>
      </div>
      <Card className="print-sheet max-w-3xl">{render(d.data)}</Card>
    </>
  );
}

function CertificateSheet({ id }: { id: string }) {
  return (
    <Sheet<Certificate>
      path={`/certificates/${id}`}
      sample={{
        status: "issued",
        document: {
          title: "Bonafide Certificate",
          statement:
            "This is to certify that Aarav Mehta is a bonafide student of this school, studying in 7 B.",
          lines: [
            ["Certificate no.", "BON/2026/0004"],
            ["Date of issue", "2026-10-12"],
          ],
        },
      }}
      render={(c) =>
        !c.document || c.status !== "issued" ? (
          <p>This certificate has not been issued, or was cancelled.</p>
        ) : (
          <div className="grid gap-6">
            <h2 className="text-ink text-center text-2xl">{c.document.title}</h2>
            <p className="leading-7">{c.document.statement}</p>
            <Rows rows={c.document.lines} />
            <p className="mt-12 text-right text-sm">Signature and school seal</p>
          </div>
        )
      }
    />
  );
}

function ReceiptSheet({ id }: { id: string }) {
  return (
    <Sheet<Receipt>
      path={`/fees/payments/${id}/receipt`}
      sample={{
        receiptNo: "RCP-0192",
        school: { name: "Sample School", address: "MG Road", phone: "080 0000 0000" },
        student: { name: "Aarav Mehta", admissionNo: "A-001", classSection: "7 B" },
        invoice: { number: "INV-0101", title: "Term 2 tuition", payable: 14500 },
        payment: { amount: 14500, mode: "upi", reference: "UTR1234", paidOn: "2026-10-03" },
        balanceNow: 0,
      }}
      render={(r) => (
        <div className="grid gap-5">
          <div className="text-center">
            <h2 className="text-ink text-2xl">{r.school.name}</h2>
            <p className="text-muted text-sm">
              {[r.school.address, r.school.phone].filter(Boolean).join(" · ")}
            </p>
            <p className="mt-2 font-semibold">Fee receipt {r.receiptNo}</p>
          </div>
          <Rows
            rows={[
              ["Student", r.student.name],
              ["Admission no.", r.student.admissionNo],
              ["Class", r.student.classSection ?? "-"],
              ["Fee", `${r.invoice.title} (${r.invoice.number})`],
              ["Fee amount", rupees(r.invoice.payable)],
              ["Received", rupees(r.payment.amount)],
              ["Paid by", r.payment.mode.toUpperCase()],
              ["Reference", r.payment.reference ?? "-"],
              ["Date", fmtDate(r.payment.paidOn)],
              ["Balance now", rupees(r.balanceNow)],
            ]}
          />
          <p className="mt-10 text-right text-sm">Received by</p>
        </div>
      )}
    />
  );
}

function ReportCardSheet({ id }: { id: string }) {
  return (
    <Sheet<ReportCard>
      path={`/report-cards/students/${id}`}
      sample={{
        student: { name: "Aarav Mehta", admissionNo: "A-001", classSection: "7 B" },
        cards: [
          {
            exam: { name: "Half yearly" },
            subjects: [
              { subject: "English", score: 72, max: 100, grade: "B1" },
              { subject: "Mathematics", score: 81, max: 100, grade: "A2" },
            ],
            total: 153,
            maxTotal: 200,
            percent: 76.5,
            grade: "B1",
            result: "pass",
            rank: 4,
            classStrength: 32,
          },
        ],
      }}
      render={(r) => (
        <div className="grid gap-6">
          <div className="text-center">
            <h2 className="text-ink text-2xl">Report card</h2>
            <p className="text-sm">
              {r.student.name} · {r.student.classSection} · Admission no. {r.student.admissionNo}
            </p>
          </div>
          {!r.cards.length ? <p>No published result yet.</p> : null}
          {r.cards.map((c) => (
            <section key={c.exam.name}>
              <h3 className="text-ink mb-2 text-lg">{c.exam.name}</h3>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    {["Subject", "Marks", "Out of", "Grade"].map((h) => (
                      <th key={h} scope="col" className="border-line border-b py-1 pr-4">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {c.subjects.map((s) => (
                    <tr key={s.subject}>
                      <td className="py-1 pr-4">{s.subject}</td>
                      <td>{s.score ?? "-"}</td>
                      <td>{s.max}</td>
                      <td>{s.grade ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-sm font-semibold">
                Total {c.total} / {c.maxTotal} · {c.percent === null ? "-" : `${c.percent}%`} ·{" "}
                {c.grade ?? "-"} · {c.result.toUpperCase()}
                {c.rank ? ` · Rank ${c.rank} of ${c.classStrength}` : ""}
              </p>
            </section>
          ))}
          <p className="mt-10 flex justify-between text-sm">
            <span>Class teacher</span>
            <span>Principal</span>
          </p>
        </div>
      )}
    />
  );
}

function PayslipSheet({ id }: { id: string }) {
  const total = (l: Slip["earnings"]) => l.reduce((s, x) => s + x.rupees, 0);
  return (
    <Sheet<Slip>
      path={`/payroll/${id}`}
      sample={{
        month: "2026-09",
        name: "Kavita Iyer",
        employeeNo: "EMP-001",
        earnings: [{ label: "Basic", rupees: 34000 }],
        deductions: [{ label: "Advance", rupees: 1000 }],
        net: 33000,
      }}
      render={(s) => (
        <div className="grid gap-5">
          <div className="text-center">
            <h2 className="text-ink text-2xl">Payslip {s.month}</h2>
            <p className="text-sm">
              {s.name} · {s.employeeNo}
            </p>
          </div>
          <Rows
            rows={[
              ...s.earnings.map((l): [string, string] => [l.label, rupees(l.rupees)]),
              ["Total earnings", rupees(total(s.earnings))],
              ...s.deductions.map((l): [string, string] => [`Less ${l.label}`, rupees(l.rupees)]),
              ["Total deductions", rupees(total(s.deductions))],
              ["Net pay", rupees(s.net)],
            ]}
          />
        </div>
      )}
    />
  );
}

const SHEETS: Record<string, (p: { id: string }) => React.ReactNode> = {
  certificate: CertificateSheet,
  receipt: ReceiptSheet,
  reportcard: ReportCardSheet,
  payslip: PayslipSheet,
};

export function PrintScreen({ params }: ScreenProps) {
  const View = SHEETS[params.kind ?? ""];
  if (!View) return <EmptyState title="Nothing to print here" />;
  return <View id={params.ref ?? ""} />;
}

interface Doc {
  id: string;
  kind: string;
  title: string;
  reference: string;
  date: string;
}

function StudentPapers({ id }: { id: string }) {
  const d = useData<Doc[]>(`/students/${id}/documents`, [
    {
      id: "d1",
      kind: "Certificate",
      title: "Bonafide certificate",
      reference: "BON/2026/0004",
      date: "2026-10-12",
    },
    {
      id: "d2",
      kind: "Fee payment",
      title: "Term 2 tuition",
      reference: "RCP-0192",
      date: "2026-10-03",
    },
  ]);
  if (d.error) return <ErrorState message={d.error.message} onRetry={d.reload} />;
  if (!d.data) return <LoadingBlock rows={2} />;
  return (
    <ul className="grid max-w-3xl gap-3">
      <li>
        <Card className="flex items-center justify-between gap-3">
          <span className="text-ink font-semibold">Report card</span>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/school/print/reportcard/${id}`}>Open</Link>
          </Button>
        </Card>
      </li>
      {d.data.map((x) => (
        <li key={x.id}>
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <span>
              <span className="text-ink block font-semibold">{x.title}</span>
              <span className="text-muted text-sm">
                {x.kind}
                {x.reference ? ` · ${x.reference}` : ""} · {fmtDate(x.date)}
              </span>
            </span>
            <Button asChild variant="ghost" size="sm">
              <Link
                href={`/school/print/${x.kind === "Certificate" ? "certificate" : "receipt"}/${x.id}`}
              >
                Open
              </Link>
            </Button>
          </Card>
        </li>
      ))}
    </ul>
  );
}

/** Office: choose a student, then print a report card, certificate or fee receipt. */
export function PrintCentre() {
  const s = useServices();
  const students = useAsync(
    () => s.resource("students").list({ pageSize: 200, sort: "name", order: "asc" }),
    [s],
  );
  const [id, setId] = useState("");
  return (
    <>
      <PageHeader
        title="Print centre"
        description="Report cards, certificates and fee receipts. Use the print window to save a PDF."
      />
      <div className="mb-5 max-w-sm">
        <label htmlFor="print-student" className="mb-1.5 block text-sm font-semibold">
          Student
        </label>
        <Select id="print-student" value={id} onChange={(e) => setId(e.target.value)}>
          <option value="">Choose a student</option>
          {students.data?.items.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name} · {x.classSection} · {x.admissionNo}
            </option>
          ))}
        </Select>
      </div>
      {id ? <StudentPapers key={id} id={id} /> : <EmptyState title="Choose a student" />}
    </>
  );
}
