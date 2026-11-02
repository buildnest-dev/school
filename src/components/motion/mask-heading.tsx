"use client";

import { Fragment, useRef } from "react";
import { cn } from "@/lib/utils";
import { gsap, useGsap } from "./gsap";

/** Heading whose words rise out of a clipping mask when it scrolls into view. */
export function MaskHeading({
  as = "h2",
  text,
  className,
  id,
}: {
  as?: "h1" | "h2" | "h3";
  text: string;
  className?: string;
  id?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  useGsap(({ motion }) => {
    if (!motion || !ref.current) return;
    gsap.fromTo(
      ref.current.querySelectorAll("[data-word]"),
      { yPercent: 110, y: 0 },
      {
        yPercent: 0,
        y: 0,
        duration: 0.9,
        ease: "power3.out",
        stagger: 0.045,
        scrollTrigger: { trigger: ref.current, start: "top 88%", once: true },
      },
    );
  }, ref);

  const words = text.split(" ");
  const Tag = as;
  return (
    <Tag
      ref={ref as never}
      id={id}
      className={cn("text-[clamp(1.9rem,3.6vw,2.9rem)] leading-[1.1]", className)}
    >
      {words.map((word, i) => (
        <Fragment key={`${word}-${i}`}>
          <span className="-mb-[0.12em] inline-block overflow-hidden pb-[0.12em] align-top">
            <span data-word className="inline-block">
              {word}
            </span>
          </span>
          {i < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </Tag>
  );
}
