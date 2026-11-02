import {
  Archive,
  ArrowRight,
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
  CalendarDays,
  Check,
  FileText,
  IndianRupee,
  Lock,
  MessageSquare,
  Award,
  ShieldCheck,
  SlidersHorizontal,
  UserPlus,
  type LucideProps,
} from "lucide-react";
import type { ComponentType } from "react";

const ICONS = {
  setup: SlidersHorizontal,
  admissions: UserPlus,
  campus: Building2,
  safety: ShieldCheck,
  fees: IndianRupee,
  exams: FileText,
  timetable: CalendarDays,
  certs: Award,
  staff: Briefcase,
  comms: MessageSquare,
  learning: BookOpen,
  analytics: BarChart3,
  arrow: ArrowRight,
  lock: Lock,
  archive: Archive,
  check: Check,
} satisfies Record<string, ComponentType<LucideProps>>;

export type IconName = keyof typeof ICONS;

/** One icon family (Lucide), one stroke weight, decorative by default. */
export function Icon({ name, className, ...props }: { name: IconName } & LucideProps) {
  const Component = ICONS[name];
  return <Component aria-hidden="true" strokeWidth={1.6} className={className} {...props} />;
}
