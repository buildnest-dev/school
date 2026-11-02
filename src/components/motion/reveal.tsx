"use client";

import { useRef, type ReactNode } from "react";
import { gsap, useGsap } from "./gsap";

type Variant = "up" | "media";

/** Fade-up reveal when scrolled into view. `media` travels further and runs longer (for mockups). */
export function Reveal({
  variant = "up",
  delay = 0,
  className,
  children,
}: {
  variant?: Variant;
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useGsap(({ motion }) => {
    if (!motion || !ref.current) return;
    gsap.fromTo(
      ref.current,
      { opacity: 0, y: variant === "media" ? 44 : 16 },
      {
        opacity: 1,
        y: 0,
        delay,
        duration: variant === "media" ? 1 : 0.7,
        ease: "power3.out",
        scrollTrigger: { trigger: ref.current, start: "top 88%", once: true },
      },
    );
  }, ref);
  return (
    <div ref={ref} data-reveal className={className}>
      {children}
    </div>
  );
}

/** Reveals direct children one after another. Use `as="ul"`/`"ol"` to keep list semantics. */
export function Stagger({
  as = "div",
  className,
  gap = 0.08,
  children,
}: {
  as?: "div" | "ul" | "ol";
  className?: string;
  gap?: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  useGsap(({ motion }) => {
    if (!motion || !ref.current) return;
    gsap.fromTo(
      Array.from(ref.current.children),
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: "power3.out",
        stagger: gap,
        scrollTrigger: { trigger: ref.current, start: "top 85%", once: true },
      },
    );
  }, ref);
  const Tag = as;
  return (
    <Tag ref={ref as never} data-stagger className={className}>
      {children}
    </Tag>
  );
}
