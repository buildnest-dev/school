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
          "font-display grid size-8 place-items-center rounded-[2px] text-xl font-semibold",
          onDark ? "bg-accent-light text-ink" : "bg-ink text-accent-light",
        )}
      >
        {BRAND.charAt(0)}
      </span>
      <span className="font-display text-[1.35rem] font-semibold tracking-tight">{BRAND}</span>
    </Link>
  );
}
