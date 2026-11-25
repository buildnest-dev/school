import { CalendarCheck, Coins, GraduationCap, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { BrandLogo } from "./brand-logo";

const POINTS: { icon: LucideIcon; text: string }[] = [
  { icon: GraduationCap, text: "Admissions, students and staff in one place" },
  { icon: CalendarCheck, text: "Attendance and timetable your teachers actually use" },
  { icon: Coins, text: "Fees, receipts and parent updates without the paperwork" },
];

/** Two-column frame for sign-in and sign-up: heritage brown story panel, cream form side. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main
      id="main"
      className="bg-page grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]"
    >
      <aside className="bg-sidebar relative hidden flex-col justify-between gap-10 p-10 text-white lg:flex xl:p-14">
        <BrandLogo onDark />
        <div className="grid gap-6">
          <h2 className="font-display text-[2.4rem] leading-tight font-bold text-[#f6d89a]">
            One calm place to run your school.
          </h2>
          <ul className="grid gap-4">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="text-on-dark flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="grid size-10 flex-none place-items-center rounded-xl bg-white/10 text-[#f7dc9c]"
                >
                  <Icon className="size-5" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-on-dark/80 text-sm">
          Staff, parents and the ZAQSA team, each on their own site.
        </p>
      </aside>
      <div className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="shadow-card border-line bg-surface grid w-full max-w-xl gap-6 rounded-3xl border p-6 sm:p-9">
          <BrandLogo className="lg:hidden" />
          {children}
        </div>
      </div>
    </main>
  );
}
