/** The tile in front of a lesson. "Period 3" shows as a small word above a big number. */
export function PeriodBadge({ label }: { label: string }) {
  const number = /^period\s+(\d+)$/i.exec(label.trim())?.[1];
  return (
    <span className="bg-paper-2 text-ink grid size-16 flex-none place-content-center rounded-xl px-1 text-center leading-tight">
      {number ? (
        <>
          <span className="text-muted text-xs font-semibold">Period</span>
          <span className="text-2xl font-bold">{number}</span>
        </>
      ) : (
        <span className="text-sm font-bold break-words">{label}</span>
      )}
    </span>
  );
}
