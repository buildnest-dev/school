"use client";

import { useRef } from "react";
import { formatters } from "@/lib/data/schools";
import { gsap, useGsap } from "./gsap";

/**
 * Counts from 0 to `value`. Server-rendered text is already the final value, so reduced-motion
 * visitors and no-JS visitors see correct numbers. `initialDelay` only applies to the first run.
 */
export function CountUp({
  value,
  format,
  initialDelay = 0,
  className,
}: {
  value: number;
  format: keyof typeof formatters;
  initialDelay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const first = useRef(true);
  const fmt = formatters[format];

  useGsap(
    ({ motion }) => {
      const el = ref.current;
      if (!motion || !el) return;
      const state = { v: 0 };
      el.textContent = fmt(0);
      const tween = gsap.to(state, {
        v: value,
        duration: 1.1,
        delay: first.current ? initialDelay : 0,
        ease: "power3.out",
        onUpdate: () => {
          el.textContent = fmt(state.v);
        },
        onComplete: () => {
          el.textContent = fmt(value);
        },
      });
      first.current = false;
      return () => {
        tween.kill();
        el.textContent = fmt(value);
      };
    },
    ref,
    [value],
  );

  return (
    <span ref={ref} className={className}>
      {fmt(value)}
    </span>
  );
}
