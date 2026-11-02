"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useLayoutEffect, type RefObject } from "react";

declare global {
  interface Window {
    /** Set once GSAP is registered; the layout's failsafe script checks it. */
    __gsapReady?: boolean;
  }
}

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
  window.__gsapReady = true;
}

export { gsap, ScrollTrigger };

/** Media queries used across the motion system. */
export const MQ = {
  motion: "(prefers-reduced-motion: no-preference)",
  desktop: "(min-width: 977px)",
} as const;

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export type MotionConditions = { motion?: boolean; desktop?: boolean };

/**
 * Runs `setup` inside a gsap.matchMedia scoped to `scope`, only when the visitor accepts motion.
 * Everything created inside is reverted automatically on unmount or when the media query changes,
 * so there are no leaked tweens or ScrollTriggers.
 */
export function useGsap(
  setup: (conditions: MotionConditions) => void | (() => void),
  scope: RefObject<Element | null>,
  deps: unknown[] = [],
) {
  useIsoLayoutEffect(() => {
    const mm = gsap.matchMedia(scope.current ?? undefined);
    mm.add(MQ, (ctx) => setup((ctx.conditions ?? {}) as MotionConditions));
    return () => mm.revert();
  }, deps);
}
