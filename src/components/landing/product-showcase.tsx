"use client";

import { useRef, useState } from "react";
import { Container, Eyebrow, Section } from "@/components/ui/primitives";
import { MaskHeading } from "@/components/motion/mask-heading";
import { Reveal } from "@/components/motion/reveal";
import { ScrollTrigger, useGsap } from "@/components/motion/gsap";
import { SHOWCASE_STAGES } from "@/lib/data/content";
import { cn } from "@/lib/utils";
import {
  AcademicsPreview,
  CommunicationPreview,
  FinancePreview,
  InstitutionPreview,
} from "./showcase-previews";

const PREVIEWS = [InstitutionPreview, AcademicsPreview, FinancePreview, CommunicationPreview];

/**
 * Sticky, scroll-driven product tour. Normal browser scrolling is never hijacked: the track is simply
 * tall, and a ScrollTrigger reads progress to pick the active stage. Below the desktop breakpoint, or
 * with reduced motion, the CSS lays the four stages out as an ordinary stacked sequence.
 */
export function ProductShowcase() {
  const track = useRef<HTMLDivElement>(null);
  const trigger = useRef<ScrollTrigger | null>(null);
  const [active, setActive] = useState(0);

  useGsap(({ motion, desktop }) => {
    const el = track.current;
    if (!motion || !desktop || !el) return;
    const st = ScrollTrigger.create({
      trigger: el,
      start: "top top+=72",
      end: "bottom bottom",
      onUpdate: (self) => {
        el.style.setProperty("--sp", self.progress.toFixed(3));
        setActive(
          Math.min(SHOWCASE_STAGES.length - 1, Math.floor(self.progress * SHOWCASE_STAGES.length)),
        );
      },
    });
    trigger.current = st;
    return () => {
      trigger.current = null;
      setActive(0);
    };
  }, track);

  const goTo = (i: number) => {
    const st = trigger.current;
    if (!st) return;
    const y = st.start + ((i + 0.5) / SHOWCASE_STAGES.length) * (st.end - st.start);
    window.scrollTo({ top: y });
  };

  return (
    <Section id="showcase" aria-labelledby="show-title" className="pb-0 lg:pb-0">
      <Container>
        <div className="mb-12 max-w-[780px]">
          <Reveal>
            <Eyebrow>Inside the platform</Eyebrow>
          </Reveal>
          <MaskHeading id="show-title" text="One workspace, four views of the school." />
        </div>
      </Container>

      <div ref={track} className="showcase-track">
        <div className="showcase-sticky">
          <Container className="showcase-inner w-full">
            <ol
              aria-label="Product tour stages"
              className="showcase-nav relative hidden flex-col justify-center gap-1 pl-3.5"
            >
              {SHOWCASE_STAGES.map((s, i) => (
                <li key={s.nav}>
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    aria-current={active === i ? "step" : undefined}
                    className={cn(
                      "flex w-full items-baseline gap-2.5 py-2.5 text-left text-[0.9rem] font-semibold transition-colors",
                      active === i ? "text-ink" : "text-muted hover:text-ink",
                    )}
                  >
                    <span
                      className={cn(
                        "font-display text-[0.8rem]",
                        active === i ? "text-accent-ink" : "text-muted",
                      )}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {s.nav}
                  </button>
                </li>
              ))}
              <li
                aria-hidden="true"
                className="bg-line absolute top-[12%] bottom-[12%] left-0 w-0.5"
              >
                <i
                  className="bg-accent absolute top-0 left-0 w-0.5"
                  style={{ height: "calc(var(--sp, 0) * 100%)" }}
                />
              </li>
            </ol>

            <div className="showcase-stages grid gap-16 pb-16 lg:pb-0">
              {SHOWCASE_STAGES.map((stage, i) => {
                const Preview = PREVIEWS[i]!;
                return (
                  <article
                    key={stage.nav}
                    data-active={active === i}
                    aria-labelledby={`stage-${i}`}
                    className="stage grid items-center gap-5 lg:grid-cols-[0.8fr_1.2fr] lg:gap-12"
                  >
                    <div className="stage-text">
                      <Eyebrow>Stage {String(i + 1).padStart(2, "0")}</Eyebrow>
                      <h3
                        id={`stage-${i}`}
                        className="mb-3 text-[clamp(1.5rem,2.6vw,2.1rem)] leading-tight"
                      >
                        {stage.title}
                      </h3>
                      <p className="text-muted max-w-[48ch]">{stage.body}</p>
                    </div>
                    <Preview />
                  </article>
                );
              })}
            </div>
          </Container>
        </div>
      </div>
    </Section>
  );
}
