"use client";

import Link from "next/link";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Container, Eyebrow } from "@/components/ui/primitives";
import { gsap, useGsap } from "@/components/motion/gsap";
import { ROUTES } from "@/lib/site";
import { HeroDashboard } from "./hero-dashboard";

const LINES = ["One platform.", "Every school.", "A better way to run education."] as const;

/** Names of the other sample workspaces, peeking out behind the dashboard like stacked tabs. */
const GHOSTS = [
  {
    name: "Riverstone Public School",
    color: "#2b5fa8",
    inset: "left-[calc(1.5rem+28px)] w-[230px]",
    top: "-top-8",
    depth: -0.03,
  },
  {
    name: "Lakeview Junior Campus",
    color: "#2d7556",
    inset: "left-[calc(1.5rem+270px)] w-[230px]",
    top: "-top-8",
    depth: -0.045,
  },
] as const;

/**
 * Hero choreography (one GSAP timeline):
 * eyebrow → masked headline lines → copy → CTAs → dashboard emerges → widgets stagger
 * (count-ups start inside the widgets) → notification settles. Parallax layers follow on scroll.
 */
export function Hero() {
  const root = useRef<HTMLElement>(null);

  useGsap(({ motion, desktop }) => {
    const el = root.current;
    if (!motion || !el) return;
    const q = (name: string) => el.querySelectorAll(`[data-hero="${name}"]`);

    const tl = gsap.timeline({
      defaults: { ease: "power3.out" },
      delay: 0.15,
      onComplete: () => el.setAttribute("data-hero-state", "done"),
    });
    tl.fromTo(q("eyebrow"), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.7 }, 0)
      .fromTo(
        q("line"),
        { yPercent: 110, y: 0, opacity: 1 },
        { yPercent: 0, y: 0, duration: 1, stagger: 0.14 },
        0.1,
      )
      .fromTo(q("sub"), { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.8 }, 0.75)
      .fromTo(
        q("cta"),
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.7, stagger: 0.1 },
        0.9,
      )
      .fromTo(
        q("ghost"),
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.9, stagger: 0.12 },
        0.95,
      )
      .fromTo(
        q("app"),
        { opacity: 0, y: 90, scale: 0.965, transformOrigin: "50% 0" },
        { opacity: 1, y: 0, scale: 1, duration: 1.2 },
        1,
      )
      .fromTo(
        q("panel"),
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.8, stagger: 0.12 },
        1.45,
      )
      .fromTo(
        q("notif"),
        { opacity: 0, x: 28 },
        { opacity: 1, x: 0, duration: 0.9, ease: "back.out(1.4)" },
        3.2,
      );

    // Layered parallax on selected layers only (desktop), scrubbed against the hero's own scroll.
    if (desktop) {
      el.querySelectorAll<HTMLElement>("[data-parallax]").forEach((layer) => {
        gsap.to(layer, {
          y: () => Number(layer.dataset.parallax) * 400,
          ease: "none",
          scrollTrigger: { trigger: el, start: "top top", end: "bottom top", scrub: 0.6 },
        });
      });
    }

    return () => el.setAttribute("data-hero-state", "done"); // never leave content hidden on revert
  }, root);

  return (
    <section
      ref={root}
      id="platform"
      data-hero-state="pending"
      aria-labelledby="hero-title"
      className="relative -mt-18 overflow-clip pt-[calc(72px+clamp(32px,6vw,72px))] pb-[clamp(56px,7vw,96px)]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background-image:linear-gradient(var(--color-line)_1px,transparent_1px),linear-gradient(90deg,var(--color-line)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_25%,#000_20%,transparent_75%)] [background-size:56px_56px] opacity-45"
      />
      <Container className="relative">
        <Eyebrow data-hero="eyebrow">A unified operating system for schools</Eyebrow>
        <h1
          id="hero-title"
          className="mb-8 text-[clamp(2.5rem,6.4vw,5.1rem)] leading-[1.02] tracking-[-0.03em]"
        >
          {LINES.map((line, i) => (
            <span key={line} className="-mb-[0.1em] block overflow-hidden pr-[0.06em] pb-[0.1em]">
              <span data-hero="line" className={i === 2 ? "text-accent-ink block italic" : "block"}>
                {line}
              </span>
            </span>
          ))}
        </h1>
        <div className="grid items-end gap-5 lg:grid-cols-[minmax(0,1.2fr)_auto] lg:gap-8">
          <p
            data-hero="sub"
            className="text-muted max-w-[54ch] text-[clamp(1.05rem,1.5vw,1.2rem)] leading-relaxed"
          >
            Bring school administration, academics, attendance, fees, and communication together in
            one connected platform, designed to support institutions of every size.
          </p>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <span data-hero="cta">
              <Button asChild>
                <Link href={ROUTES.demo}>
                  Book a Demo{" "}
                  <Icon
                    name="arrow"
                    className="size-[18px] transition-transform group-hover:translate-x-[3px]"
                  />
                </Link>
              </Button>
            </span>
            <span data-hero="cta">
              <Button asChild variant="ghost">
                <Link href="/#concept">Explore the Platform</Link>
              </Button>
            </span>
          </div>
        </div>
      </Container>

      <Container className="relative mt-[clamp(48px,7vw,80px)]">
        {GHOSTS.map((g) => (
          <div
            key={g.name}
            data-parallax={g.depth}
            aria-hidden="true"
            className={`absolute z-0 hidden md:block ${g.inset} ${g.top}`}
          >
            <div
              data-hero="ghost"
              className="border-line bg-surface text-muted h-10 rounded-t-[10px] border border-b-0 px-4 pt-2 text-xs font-semibold"
              style={{ borderTop: `3px solid ${g.color}` }}
            >
              {g.name}
            </div>
          </div>
        ))}
        <figure className="relative z-10">
          <HeroDashboard />
          <div
            data-parallax="0.04"
            className="absolute top-16 right-3 z-20 hidden lg:block xl:-right-4"
          >
            <div
              data-hero="notif"
              role="status"
              className="bg-ink flex max-w-[260px] items-start gap-2.5 rounded-lg px-4 py-3 text-[0.78rem] text-white shadow-[0_16px_32px_-12px_rgb(15_42_45/0.5)]"
            >
              <span
                aria-hidden="true"
                className="bg-accent-light mt-[5px] size-2 flex-none rounded-full"
              />
              <div>
                <strong className="block text-[0.8rem]">Fee receipt issued</strong>
                <span className="text-on-dark">₹14,500 · Class 6B · just now</span>
              </div>
            </div>
          </div>
          <figcaption className="text-muted mt-3 max-w-[70ch] text-xs">
            Illustrative interface with fictional schools and sample data. Workspace switching here
            is a visual demonstration only.
          </figcaption>
        </figure>
      </Container>
    </section>
  );
}
