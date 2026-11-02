import { Check } from "lucide-react";
import { AppWindow, DateRow, HBars, Panel, Tag } from "@/components/mockups/primitives";

/** Four illustrative interface previews for the product showcase. `.pv-i` items animate in per stage. */
export function InstitutionPreview() {
  return (
    <AppWindow className="stage-pv" title="Northfield Academy · Workspace setup">
      <div className="grid gap-3 p-4">
        <Panel className="pv-i" title="Setup progress" meta="3 of 4">
          <ul className="grid gap-2.5 text-[0.85rem]">
            {["Workspace created", "Branding and academic structure", "Classes and sections"].map(
              (t) => (
                <li key={t} className="flex items-center gap-2.5">
                  <Check
                    className="bg-ok size-[18px] rounded-full p-[3px] text-white"
                    aria-hidden="true"
                    strokeWidth={2.4}
                  />
                  {t}
                </li>
              ),
            )}
            <li className="text-ink flex items-center gap-2.5 font-semibold">
              <span
                aria-hidden="true"
                className="border-accent size-[18px] flex-none rounded-full border-2"
              />
              Invite authorized users
            </li>
          </ul>
        </Panel>
        <Panel className="pv-i" title="Users by role" meta="Invited">
          <HBars
            rows={[
              { label: "Administrators", pct: 12, text: "3" },
              { label: "Teachers", pct: 88, text: "64" },
              { label: "Accounts", pct: 18, text: "4" },
            ]}
          />
        </Panel>
        <Panel className="pv-i" title="Campuses" meta="Group">
          <ul className="grid gap-2">
            <DateRow day="1" month="Main">
              Northfield Academy
            </DateRow>
            <DateRow day="2" month="Jr.">
              Lakeview Junior Campus
            </DateRow>
          </ul>
        </Panel>
      </div>
    </AppWindow>
  );
}

const TT_ROWS = [
  ["P1", "Maths", "Eng", "Sci", "Maths", "Hin"],
  ["P2", "Eng", "Sci", "Maths", "SSt", "Eng"],
  ["P3", "Sci", "Maths", "Maths!", "Eng", "Art"],
];

export function AcademicsPreview() {
  return (
    <AppWindow className="stage-pv" title="Class 8B · This week">
      <div className="grid gap-3 p-4">
        <Panel className="pv-i" title="Timetable" meta="Mon–Fri">
          <table className="w-full text-center text-[0.74rem]">
            <caption className="sr-only">Sample timetable for Class 8B</caption>
            <thead>
              <tr>
                <th />
                {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => (
                  <th
                    key={d}
                    scope="col"
                    className="border-line bg-paper text-muted border px-1 py-1.5 font-semibold"
                  >
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TT_ROWS.map(([p, ...cells]) => (
                <tr key={p}>
                  <th
                    scope="row"
                    className="border-line bg-paper text-muted border px-1 py-1.5 font-semibold"
                  >
                    {p}
                  </th>
                  {cells.map((c, i) => (
                    <td
                      key={i}
                      className={`border-line border px-1 py-1.5 ${c === "Maths!" ? "text-bad bg-[#f4dcdc] font-bold" : ""}`}
                    >
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2.5 flex items-center gap-2 text-xs">
            <Tag tone="red">Clash</Tag>Wed P3 · teacher double-booked
          </p>
        </Panel>
        <Panel className="pv-i" title="Attendance" meta="This week">
          <HBars
            rows={[
              { label: "Mon", pct: 95 },
              { label: "Tue", pct: 93 },
              { label: "Wed", pct: 96 },
            ]}
          />
        </Panel>
        <Panel className="pv-i" title="Examinations" meta="Unit Test 2">
          <ul className="grid gap-2">
            <DateRow day="24" month="Oct">
              Science · Class 9
            </DateRow>
            <DateRow day="26" month="Oct">
              Maths · Class 10
            </DateRow>
          </ul>
        </Panel>
      </div>
    </AppWindow>
  );
}

export function FinancePreview() {
  return (
    <AppWindow className="stage-pv" title="Accounts & administration">
      <div className="grid gap-3 p-4">
        <Panel className="pv-i" title="Fee ledger" meta="Today">
          <ul className="mb-2 grid gap-2">
            {[
              ["Receipt 2041 · Class 6B", "₹14,500"],
              ["Receipt 2042 · Class 3A", "₹9,800"],
              ["Receipt 2043 · Class 10C", "₹18,200"],
            ].map(([a, b]) => (
              <li
                key={a}
                className="border-line flex justify-between gap-2 border-b border-dashed pb-2 text-[0.78rem]"
              >
                <span>{a}</span>
                <b className="text-ink tabular-nums">{b}</b>
              </li>
            ))}
          </ul>
          <span className="bg-paper-2 block h-[5px] overflow-hidden rounded-[3px]">
            <span className="bg-accent block h-full w-3/4 rounded-[3px]" />
          </span>
          <p className="text-muted mt-1 text-xs">74% of Term 2 collected</p>
        </Panel>
        <Panel className="pv-i" title="Transfer certificate · Class 8" meta="Request #118">
          <ol className="grid grid-cols-4 gap-1 text-[0.68rem] font-semibold">
            {[
              ["Requested", "ok"],
              ["Verified", "ok"],
              ["Approval", "now"],
              ["Issued", ""],
            ].map(([t, s]) => (
              <li
                key={t}
                className={`border-t-[3px] px-1 py-2 text-center ${s === "ok" ? "border-ok text-ok" : s === "now" ? "border-accent text-accent-ink" : "border-line text-muted"}`}
              >
                {t}
              </li>
            ))}
          </ol>
        </Panel>
        <Panel className="pv-i" title="Approvals" meta="3 pending">
          <ul className="grid gap-2 text-[0.75rem]">
            <li className="flex items-center gap-2">
              <Tag tone="amber">Today</Tag>Fee concession · Class 7B
            </li>
            <li className="flex items-center gap-2">
              <Tag>Fri</Tag>Staff leave · 22–23 Oct
            </li>
          </ul>
        </Panel>
      </div>
    </AppWindow>
  );
}

export function CommunicationPreview() {
  return (
    <AppWindow className="stage-pv" title="Parent & student view">
      <div className="grid gap-3 p-4">
        <Panel className="pv-i" title="Notice · Class 7B" meta="09:15">
          <p className="bg-paper max-w-[92%] rounded-[8px_8px_8px_2px] px-3 py-2.5 text-[0.78rem]">
            Unit Test 2 begins on 24 Oct. Syllabus and timetable are attached.
          </p>
          <p className="bg-ink mt-2 ml-auto max-w-[92%] rounded-[8px_8px_2px_8px] px-3 py-2.5 text-[0.78rem] text-white">
            Noted, thank you.
            <span className="text-on-dark mt-0.5 block text-[0.65rem]">Parent of Aarav</span>
          </p>
        </Panel>
        <Panel className="pv-i" title="Aarav Mehta · Class 7B" meta="Student profile">
          <HBars
            rows={[
              { label: "Attendance", pct: 96 },
              { label: "Term 1 marks", pct: 82 },
            ]}
          />
        </Panel>
        <Panel className="pv-i" title="Report · Class 7 results" meta="Principal">
          <div className="flex h-16 items-end gap-2" aria-hidden="true">
            {[48, 62, 55, 74, 68, 82].map((h, i) => (
              <i key={i} className="bg-ink-2 flex-1 rounded-t-[2px]" style={{ height: `${h}%` }} />
            ))}
          </div>
          <p className="text-muted mt-1 text-xs">Average by section · sample data</p>
        </Panel>
      </div>
    </AppWindow>
  );
}
