import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Container({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("mx-auto w-full max-w-[1200px] px-6", className)} {...props} />;
}

export function Eyebrow({ className, children, ...props }: ComponentPropsWithoutRef<"p">) {
  return (
    <p
      className={cn(
        "text-accent-ink mb-4 flex items-center gap-3 text-xs font-semibold tracking-[0.14em] uppercase before:h-px before:w-7 before:flex-none before:bg-current",
        className,
      )}
      {...props}
    >
      {children}
    </p>
  );
}

type SectionProps = ComponentPropsWithoutRef<"section"> & { tone?: "paper" | "alt" | "dark" };

export function Section({ tone = "paper", className, ...props }: SectionProps) {
  return (
    <section
      className={cn(
        "py-18 lg:py-28",
        tone === "alt" && "bg-paper-2",
        tone === "dark" && "on-dark bg-ink text-white",
        className,
      )}
      {...props}
    />
  );
}

/** Two-column section intro: headline left, supporting copy right. */
export function SectionIntro({
  eyebrow,
  heading,
  children,
  dark,
}: {
  eyebrow: ReactNode;
  heading: ReactNode;
  children?: ReactNode;
  dark?: boolean;
}) {
  return (
    <div className="mb-12 grid items-end gap-4 lg:grid-cols-[1.2fr_1fr] lg:gap-12">
      <div>
        {eyebrow}
        {heading}
      </div>
      {children ? (
        <div className={cn("max-w-[56ch]", dark ? "text-on-dark" : "text-muted")}>{children}</div>
      ) : null}
    </div>
  );
}
