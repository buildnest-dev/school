"use client";

import { useRef } from "react";
import { Icon } from "@/components/ui/icon";
import { Container, Eyebrow, Section, SectionIntro } from "@/components/ui/primitives";
import { MaskHeading } from "@/components/motion/mask-heading";
import { Reveal } from "@/components/motion/reveal";
import { gsap, useGsap } from "@/components/motion/gsap";
import { PRESERVED, YEAR_STEPS } from "@/lib/data/content";

/** Five-step rollover timeline: the rule draws across, then each step settles in. */
function Timeline() {
  const ref = useRef<HTMLOListElement>(null);
  useGsap(({ motion }) => {
    const el = ref.current;
    if (!motion || !el) return;
    const trigger = { trigger: el, start: "top 80%", once: true };
    gsap.fromTo(
      "[data-tl-line]",
      { scaleX: 0, scaleY: 0 },
      { scaleX: 1, scaleY: 1, duration: 1.6, ease: "power2.inOut", scrollTrigger: trigger },
    );
    gsap.fromTo(
      Array.from(el.querySelectorAll("[data-tl-item]")),
      { opacity: 0, y: 18 },
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
        stagger: 0.25,
        ease: "power3.out",
        scrollTrigger: trigger,
      },
    );
  }, ref);

  return (
    <ol ref={ref} className="relative grid gap-6 pl-7 lg:grid-cols-5 lg:gap-4 lg:pt-7 lg:pl-0">
      <span
        aria-hidden="true"
        className="bg-line absolute top-1.5 bottom-1.5 left-1.5 w-px lg:right-0 lg:bottom-auto lg:h-px lg:w-auto"
      />
      <span
        aria-hidden="true"
        data-tl-line
        className="bg-accent absolute top-1.5 bottom-1.5 left-1.5 w-0.5 origin-top lg:right-0 lg:bottom-auto lg:h-0.5 lg:w-auto lg:origin-left"
      />
      {YEAR_STEPS.map((step, i) => (
        <li key={step.title} data-tl-item className="relative">
          <span
            aria-hidden="true"
            className="border-accent bg-paper absolute top-1 -left-7 size-[13px] rounded-full border-2 lg:-top-7 lg:left-0"
          />
          <span className="text-accent-ink text-xs font-bold tracking-widest uppercase">
            Step {i + 1}
          </span>
          <h3 className="mt-1 mb-1.5 text-[1.15rem]">{step.title}</h3>
          <p className="text-muted text-[0.9rem]">{step.body}</p>
        </li>
      ))}
    </ol>
  );
}

export function AcademicYear() {
  return (
    <Section id="academic-year" aria-labelledby="year-title">
      <Container>
        <SectionIntro
          eyebrow={<Eyebrow>Academic-year continuity</Eyebrow>}
          heading={
            <MaskHeading
              id="year-title"
              text="Close one year. Open the next. Keep what happened."
            />
          }
        >
          <p>
            Year-end is designed as a guided plan: promotions, sections, fee plans, calendars and
            exam setup are prepared together while historical records stay available.
          </p>
        </SectionIntro>

        <Timeline />

        <Reveal variant="media">
          <div className="border-line bg-surface mt-18 rounded-[10px] border">
            <div className="border-line flex flex-wrap items-center gap-3 border-b px-6 py-4">
              <Icon name="archive" className="text-accent-ink size-[22px]" />
              <strong>2025–26 · Closed</strong>
              <span className="text-muted text-[0.9rem]">
                Historical records remain available for reference
              </span>
            </div>
            <ul className="grid sm:grid-cols-2 lg:grid-cols-4">
              {PRESERVED.map((p) => (
                <li
                  key={p}
                  className="border-line flex items-center gap-2.5 border-t px-6 py-4 text-[0.9rem] first:border-t-0 sm:nth-[-n+2]:border-t-0 lg:border-t-0 lg:border-l lg:first:border-l-0"
                >
                  <Icon name="lock" className="text-ok size-[18px]" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
