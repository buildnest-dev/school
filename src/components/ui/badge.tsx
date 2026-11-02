import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  FileEdit,
  Info,
  MinusCircle,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "ok" | "warn" | "bad" | "info" | "neutral";

const TONE: Record<Tone, { cls: string; Icon: LucideIcon }> = {
  ok: { cls: "bg-[#e3f1ea] text-[#1d5a41]", Icon: CheckCircle2 },
  warn: { cls: "bg-[#f8ebd2] text-[#7d4a08]", Icon: Clock },
  bad: { cls: "bg-[#f6dede] text-[#8a2b2b]", Icon: XCircle },
  info: { cls: "bg-[#e1e9ee] text-[#1f4a63]", Icon: Info },
  neutral: { cls: "bg-paper-2 text-[#4a5a5b]", Icon: Circle },
};

/** Status vocabulary shared across screens: [label, tone, optional icon override]. */
const STATUS: Record<string, [string, Tone, LucideIcon?]> = {
  paid: ["Paid", "ok"],
  partial: ["Part-paid", "warn"],
  overdue: ["Overdue", "bad", AlertTriangle],
  pending: ["Pending", "warn"],
  active: ["Active", "ok"],
  inactive: ["Inactive", "neutral"],
  suspended: ["Suspended", "bad"],
  trial: ["Trial", "info"],
  on_leave: ["On leave", "warn"],
  withdrawn: ["Withdrawn", "neutral"],
  transferred: ["Transferred", "neutral"],
  graduated: ["Graduated", "neutral"],
  draft: ["Draft", "neutral", FileEdit],
  submitted: ["Submitted", "info"],
  published: ["Published", "ok"],
  approved: ["Approved", "ok"],
  rejected: ["Rejected", "bad"],
  issued: ["Issued", "ok"],
  reissued: ["Reissued", "info"],
  cancelled: ["Cancelled", "bad"],
  open: ["Open", "warn"],
  in_progress: ["In progress", "info"],
  closed: ["Closed", "ok"],
  resolved: ["Resolved", "ok"],
  new: ["New", "info"],
  documents: ["Documents", "warn"],
  review: ["In review", "info"],
  decision: ["Decision due", "warn"],
  enrolled: ["Enrolled", "ok"],
  declined: ["Declined", "bad"],
  planned: ["Planned", "neutral"],
  planning: ["Planning", "info"],
  confirmed: ["Confirmed", "ok"],
  done: ["Done", "ok"],
  operational: ["Operational", "ok"],
  degraded: ["Degraded", "warn"],
  unavailable: ["Not connected", "neutral", MinusCircle],
  on_track: ["On track", "ok"],
  blocked: ["Blocked", "bad"],
  low: ["Low", "neutral"],
  normal: ["Normal", "info"],
  high: ["High", "bad"],
  present: ["Present", "ok"],
  absent: ["Absent", "bad"],
  late: ["Late", "warn"],
  available: ["Available", "ok"],
  maintenance: ["Maintenance", "warn"],
  ok: ["Ready", "ok"],
  warning: ["Needs attention", "warn"],
  blocking: ["Blocking", "bad"],
  promote: ["Promote", "ok"],
  detain: ["Detain", "bad"],
  exception: ["Decision needed", "warn"],
};

/** Status chip. Always shows text and an icon, never colour alone. */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const [label, tone, Icon] = STATUS[status] ?? [status, "neutral" as Tone];
  const T = TONE[tone];
  const I = Icon ?? T.Icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        T.cls,
        className,
      )}
    >
      <I className="size-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}
