import Link from "next/link";
import { BRAND } from "@/lib/site";
import { cn } from "@/lib/utils";

/** Text placeholder logo. Replace the mark/wordmark here once the real brand exists. */
export function BrandLogo({ onDark = false, className }: { onDark?: boolean; className?: string }) {
  return (
    <Link
      href="/"
      aria-label={`${BRAND} home`}
      className={cn(
        "inline-flex items-center gap-2.5 no-underline",
        onDark ? "text-white" : "text-ink",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "font-display grid size-9 place-items-center rounded-xl border text-xl font-bold",
          onDark ? "border-gold text-gold bg-white/5" : "border-gold bg-ink text-accent-light",
        )}
      >
        {BRAND.charAt(0)}
      </span>
      <span className="font-display text-[1.375rem] font-bold tracking-tight">{BRAND}</span>
    </Link>
  );
}
