"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AuditHistory, DevNote, PageHeader, Stepper, StatGrid } from "@/components/shared/blocks";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { ErrorState, LoadingBlock } from "@/components/ui/states";
import { useAsync } from "@/hooks/use-async";
import { useServices } from "@/hooks/use-services";
import type { PromotionRules, RolloverResult } from "@/types";

const STEPS = [
  "Review year",
  "Pending items",
  "Rules",
  "Preview",
  "Sections",
  "Fees",
  "Timetable & calendar",
  "Confirm",
  "Summary",
];
const CONFIRM_TEXT = "ROLLOVER 2026-27";

/**
 * Guided academic-year rollover. This screen prepares and previews a plan; the FINAL EXECUTION must be
 * authorised and run by the backend (with approval, audit trail and a recovery plan). Closed-year
 * records must never be overwritten; that guarantee is a backend responsibility.
 */
export function Rollover() {
  const s = useServices();
  const [step, setStep] = useState(0);
  const [rules, setRules] = useState<PromotionRules>({
    minAttendancePct: 75,
    minOverallPct: 40,
    conditionalPromotion: true,
  });
  const [ack, setAck] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RolloverResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState("");

  const checks = useAsync(() => s.rollover.checks(), [s]);
  const preview = useAsync(
    () => s.rollover.preview(rules),
    [s, rules.minAttendancePct, rules.minOverallPct, rules.conditionalPromotion],
  );
  const sections = useAsync(() => s.rollover.sections(), [s]);
  const audit = useAsync(
    () => s.resource("audit").list({ pageSize: 5, filters: { area: "rollover" } }),
    [s],
  );

  const blockers = checks.data?.filter((c) => c.state === "blocking") ?? [];
  const warnings = checks.data?.filter((c) => c.state === "warning") ?? [];
  const ruleErrors = useMemo(
    () => ({
      att:
        rules.minAttendancePct < 0 ||
        rules.minAttendancePct > 100 ||
        Number.isNaN(rules.minAttendancePct)
          ? "Enter a percentage from 0 to 100."
          : "",
      overall:
        rules.minOverallPct < 0 || rules.minOverallPct > 100 || Number.isNaN(rules.minOverallPct)
          ? "Enter a percentage from 0 to 100."
          : "",
    }),
    [rules],
  );
  const overCapacity =
    sections.data?.flatMap((c) =>
      c.sections.filter((x) => x.assigned > x.capacity).map((x) => `${c.className} ${x.name}`),
    ) ?? [];
  const canConfirm =
    blockers.length === 0 && (warnings.length === 0 || ack) && confirmText.trim() === CONFIRM_TEXT;

  const next = () => setStep((n) => Math.min(STEPS.length - 1, n + 1));
  const back = () => setStep((n) => Math.max(0, n - 1));
  const rulesOk = !ruleErrors.att && !ruleErrors.overall;

  const submit = async () => {
    setBusy(true);
    setSubmitError(null);
    try {
      const r = await s.rollover.submit({ rules, acknowledgedWarnings: ack, confirmText });
      setResult(r);
      setConfirmOpen(false);
      setStep(8);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "The request failed.");
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const counts = preview.data
    ? {
        promote: preview.data.filter((r) => r.outcome === "promote").length,
        detain: preview.data.filter((r) => r.outcome === "detain").length,
        exception: preview.data.filter((r) => r.outcome === "exception").length,
      }
    : null;

  return (
    <>
      <PageHeader
        title="Academic-year rollover"
        description="Close 2025–26 and prepare 2026–27 in nine guided steps. Nothing changes until the backend authorises it."
      />
      <div className="mb-6">
        <Stepper steps={STEPS} current={step} onSelect={setStep} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0" aria-live="polite">
          {step === 0 ? (
            <Card>
              <CardHeader
                title="1. Review the current year"
                hint="2025–26 will be closed and kept as read-only history."
              />
              <StatGrid
                stats={[
                  { label: "Students", value: "1,248" },
                  { label: "Classes", value: "12" },
                  { label: "Sections", value: "38" },
                  {
                    label: "Outstanding dues",
                    value: "₹13.4L",
                    hint: "carried forward with links to 2025–26",
                  },
                ]}
              />
              <p className="text-muted mt-4 text-sm">
                Previous-year results, attendance, fee ledgers and certificates stay exactly as they
                are. The rollover creates the new year; it never rewrites the old one.
              </p>
            </Card>
          ) : null}

          {step === 1 ? (
            <Card>
              <CardHeader
                title="2. Check pending items"
                hint="Fix these before confirming. Blocking items stop the rollover."
              />
              {checks.error ? (
                <ErrorState message={checks.error.message} onRetry={checks.reload} />
              ) : !checks.data ? (
                <LoadingBlock rows={3} />
              ) : (
                <ul className="grid gap-3">
                  {checks.data.map((c) => (
                    <li
                      key={c.id}
                      className="border-line flex flex-wrap items-start justify-between gap-3 border-b pb-3 last:border-b-0"
                    >
                      <span>
                        <span className="block font-semibold">{c.label}</span>
                        <span className="text-muted text-sm">{c.detail}</span>
                      </span>
                      <StatusBadge status={c.state} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}

          {step === 2 ? (
            <Card>
              <CardHeader
                title="3. Promotion and detention rules"
                hint="Students who don’t meet these rules appear as exceptions you decide on."
              />
              <div className="grid max-w-md gap-5">
                <Field id="r-att" label="Minimum attendance (%)" error={ruleErrors.att}>
                  {(a) => (
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={100}
                      value={Number.isNaN(rules.minAttendancePct) ? "" : rules.minAttendancePct}
                      onChange={(e) =>
                        setRules({
                          ...rules,
                          minAttendancePct: e.target.value === "" ? NaN : Number(e.target.value),
                        })
                      }
                      {...a}
                    />
                  )}
                </Field>
                <Field id="r-overall" label="Minimum overall marks (%)" error={ruleErrors.overall}>
                  {(a) => (
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={100}
                      value={Number.isNaN(rules.minOverallPct) ? "" : rules.minOverallPct}
                      onChange={(e) =>
                        setRules({
                          ...rules,
                          minOverallPct: e.target.value === "" ? NaN : Number(e.target.value),
                        })
                      }
                      {...a}
                    />
                  )}
                </Field>
                <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
                  <input
                    type="checkbox"
                    className="size-5 accent-[#0f2a2d]"
                    checked={rules.conditionalPromotion}
                    onChange={(e) => setRules({ ...rules, conditionalPromotion: e.target.checked })}
                  />
                  Allow conditional promotion (flag instead of detain)
                </label>
              </div>
            </Card>
          ) : null}

          {step === 3 ? (
            <Card>
              <CardHeader title="4. Preview promotions" hint="A dry run. Nothing is changed." />
              {preview.error ? (
                <ErrorState message={preview.error.message} onRetry={preview.reload} />
              ) : !preview.data || !counts ? (
                <LoadingBlock rows={4} />
              ) : (
                <>
                  <StatGrid
                    stats={[
                      { label: "Promote", value: String(counts.promote) },
                      { label: "Detain", value: String(counts.detain) },
                      { label: "Need a decision", value: String(counts.exception) },
                      {
                        label: "Shown",
                        value: `${preview.data.length}`,
                        hint: "sample of students",
                      },
                    ]}
                  />
                  <div className="border-line mt-4 overflow-x-auto rounded-lg border">
                    <table className="w-full text-left text-sm">
                      <caption className="sr-only">Promotion preview</caption>
                      <thead>
                        <tr className="bg-paper text-muted border-line border-b text-xs tracking-wider uppercase">
                          <th scope="col" className="px-3 py-2">
                            Student
                          </th>
                          <th scope="col" className="px-3 py-2">
                            From
                          </th>
                          <th scope="col" className="px-3 py-2">
                            To
                          </th>
                          <th scope="col" className="px-3 py-2">
                            Outcome
                          </th>
                          <th scope="col" className="px-3 py-2">
                            Note
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.data.map((r) => (
                          <tr key={r.id} className="border-line border-b last:border-b-0">
                            <td className="px-3 py-2 font-semibold">{r.studentName}</td>
                            <td className="px-3 py-2">{r.from}</td>
                            <td className="px-3 py-2">{r.to}</td>
                            <td className="px-3 py-2">
                              <StatusBadge status={r.outcome} />
                            </td>
                            <td className="text-muted px-3 py-2">{r.note}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </Card>
          ) : null}

          {step === 4 ? (
            <Card>
              <CardHeader
                title="5. Allocate classes and sections"
                hint="Capacity is checked. Manual overrides are made by the backend workflow."
              />
              {sections.error ? (
                <ErrorState message={sections.error.message} onRetry={sections.reload} />
              ) : !sections.data ? (
                <LoadingBlock rows={3} />
              ) : (
                <div className="grid gap-5">
                  {sections.data.map((c) => (
                    <div key={c.className}>
                      <h3 className="mb-2 font-sans text-base font-bold">{c.className}</h3>
                      <ul className="grid gap-2 sm:grid-cols-3">
                        {c.sections.map((x) => (
                          <li key={x.name} className="border-line rounded-md border p-3 text-sm">
                            <span className="font-semibold">Section {x.name}</span>
                            <span className="text-muted block">
                              {x.assigned} of {x.capacity} seats
                            </span>
                            {x.assigned > x.capacity ? (
                              <StatusBadge status="blocking" className="mt-1" />
                            ) : x.assigned === x.capacity ? (
                              <StatusBadge status="warning" className="mt-1" />
                            ) : (
                              <StatusBadge status="ok" className="mt-1" />
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  {overCapacity.length ? (
                    <p role="alert" className="text-bad text-sm font-semibold">
                      Over capacity: {overCapacity.join(", ")}
                    </p>
                  ) : null}
                </div>
              )}
            </Card>
          ) : null}

          {step === 5 ? (
            <Card>
              <CardHeader
                title="6. New-year fees and structures"
                hint="Fee plans, instalments, due dates, late-fee rules and concessions for 2026–27."
              />
              <ul className="grid gap-3 text-sm">
                {(checks.data ?? [])
                  .filter((c) => c.id === "c3" || c.id === "c5")
                  .map((c) => (
                    <li key={c.id} className="flex items-start justify-between gap-3">
                      <span>
                        <span className="block font-semibold">{c.label}</span>
                        <span className="text-muted">{c.detail}</span>
                      </span>
                      <StatusBadge status={c.state} />
                    </li>
                  ))}
              </ul>
              <p className="mt-4 text-sm">
                <Link href="/school/fees/structure" className="underline underline-offset-4">
                  Open the fee structure
                </Link>
              </p>
            </Card>
          ) : null}

          {step === 6 ? (
            <Card>
              <CardHeader title="7. Timetable and calendar readiness" />
              <ul className="grid gap-3 text-sm">
                {[
                  ["Academic calendar and holidays for 2026–27", "ok"],
                  ["Period structure and rooms", "ok"],
                  ["Teacher assignments", "warning"],
                  ["Timetable conflicts", "warning"],
                ].map(([l, st]) => (
                  <li key={l} className="flex items-center justify-between gap-3">
                    <span>{l}</span>
                    <StatusBadge status={st!} />
                  </li>
                ))}
              </ul>
              <div className="mt-3">
                <DevNote>
                  Readiness items on this step are sample values. The timetable builder is planned.
                </DevNote>
              </div>
            </Card>
          ) : null}

          {step === 7 ? (
            <Card>
              <CardHeader title="8. Confirm" hint="Review, then send the plan for authorisation." />
              <ul className="mb-5 grid gap-2 text-sm">
                <li className="flex justify-between">
                  <span>Blocking items</span>
                  <strong>{blockers.length}</strong>
                </li>
                <li className="flex justify-between">
                  <span>Warnings</span>
                  <strong>{warnings.length}</strong>
                </li>
                <li className="flex justify-between">
                  <span>Rules</span>
                  <strong>
                    ≥ {rules.minAttendancePct}% attendance, ≥ {rules.minOverallPct}% marks
                  </strong>
                </li>
              </ul>
              {blockers.length ? (
                <p role="alert" className="text-bad mb-4 text-sm font-semibold">
                  Resolve the blocking items on step 2 before you can confirm.
                </p>
              ) : null}
              {warnings.length ? (
                <label className="mb-4 flex min-h-11 items-start gap-3 text-sm font-semibold">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-5 accent-[#0f2a2d]"
                    checked={ack}
                    onChange={(e) => setAck(e.target.checked)}
                  />
                  I understand there are {warnings.length} warnings and want to continue.
                </label>
              ) : null}
              <Field id="r-confirm" label={`Type ${CONFIRM_TEXT} to confirm`}>
                {(a) => (
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    autoComplete="off"
                    {...a}
                  />
                )}
              </Field>
              {submitError ? (
                <div className="mt-4">
                  <ErrorState title="The plan could not be sent" message={submitError} />
                </div>
              ) : null}
              <div className="mt-5">
                <Button
                  disabled={!canConfirm}
                  onClick={() => setConfirmOpen(true)}
                  className="min-h-12 px-6"
                >
                  Send for authorisation
                </Button>
              </div>
              <div className="mt-4">
                <DevNote>
                  This sends the plan to the development mock only. A real rollover needs
                  authorisation, an audit entry and a recovery plan on the backend. This screen
                  cannot change any records.
                </DevNote>
              </div>
            </Card>
          ) : null}

          {step === 8 ? (
            <Card>
              <CardHeader title="9. Summary" />
              {result ? (
                <div role="status" className="grid gap-3">
                  <p className="text-lg font-semibold">Plan submitted</p>
                  <p>
                    <StatusBadge status="pending" />{" "}
                    <span className="ml-1 text-sm">Awaiting backend authorisation</span>
                  </p>
                  <p className="text-muted text-sm">{result.message}</p>
                  <p className="text-sm">
                    Nothing has been promoted, moved or created. When the backend authorises and
                    runs the rollover, 2025–26 becomes a read-only archive.
                  </p>
                </div>
              ) : (
                <p className="text-muted text-sm">
                  No plan has been submitted yet. Go back to step 8 to confirm.
                </p>
              )}
            </Card>
          ) : null}

          <div className="mt-5 flex justify-between gap-3">
            <Button variant="ghost" onClick={back} disabled={step === 0}>
              Back
            </Button>
            {step < 7 ? (
              <Button
                onClick={() => {
                  if (step === 2 && !rulesOk) return;
                  if (step === 4 && overCapacity.length) {
                    setOutcome("Fix the over-capacity sections first.");
                    return;
                  }
                  setOutcome("");
                  next();
                }}
                disabled={step === 2 && !rulesOk}
              >
                Next
              </Button>
            ) : null}
          </div>
          {outcome ? (
            <p role="alert" className="text-bad mt-2 text-sm font-semibold">
              {outcome}
            </p>
          ) : null}
        </div>

        <aside className="grid content-start gap-4">
          <Card>
            <CardHeader title="Recent rollover activity" />
            {audit.data && audit.data.items.length ? (
              <AuditHistory entries={audit.data.items} />
            ) : (
              <p className="text-muted text-sm">No rollover activity yet.</p>
            )}
          </Card>
          <Card>
            <p className="text-muted text-sm">
              A closed year can be reopened only through an authorised, audited correction. That
              process belongs to the backend.
            </p>
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Send this rollover plan for authorisation?"
        description="This does not change any records. It asks the backend to review the plan."
        confirmLabel="Send plan"
        busy={busy}
        onConfirm={submit}
      />
    </>
  );
}
