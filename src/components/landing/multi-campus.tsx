"use client";

import { useRef } from "react";
import { Container, Eyebrow, Section } from "@/components/ui/primitives";
import { MaskHeading } from "@/components/motion/mask-heading";
import { Reveal } from "@/components/motion/reveal";
import { gsap, useGsap } from "@/components/motion/gsap";

const CAMPUS_NODES = [
  { x: 16, name: "Northfield", metric: "Attendance 94.2%" },
  { x: 176, name: "Riverstone", metric: "Attendance 91.8%" },
  { x: 336, name: "Lakeview Jr.", metric: "Attendance 95.1%" },
] as const;

const POINTS = [
  ["Group level", "Consolidated, read-oriented overview for authorized administrators."],
  ["Campus level", "Day-to-day operations stay with each campus’s own staff."],
  ["Role-based", "What anyone can see is set by their role, not by where they log in from."],
] as const;

/** Group overview linked to separate campus workspaces. Lines draw in, then the campuses appear. */
function CampusDiagram() {
  const ref = useRef<SVGSVGElement>(null);
  useGsap(({ motion }) => {
    const svg = ref.current;
    if (!motion || !svg) return;
    const tl = gsap.timeline({ scrollTrigger: { trigger: svg, start: "top 80%", once: true } });
    tl.fromTo(
      svg.querySelectorAll(".diagram-line"),
      { strokeDashoffset: 1 },
      { strokeDashoffset: 0, duration: 1.4, ease: "power2.inOut", stagger: 0.12 },
      0.2,
    ).fromTo(
      svg.querySelectorAll(".diagram-node"),
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.7, stagger: 0.15, ease: "power3.out" },
      0.9,
    );
  }, ref);

  return (
    <svg
      ref={ref}
      viewBox="0 0 480 420"
      role="img"
      aria-label="Diagram: a group overview connected to three separate campus workspaces, each inside its own boundary."
      className="h-auto max-h-[520px] w-full"
    >
      <g fill="none" stroke="#f2a766" strokeWidth="1.5">
        <path className="diagram-line" pathLength={1} d="M240 112 C240 190 80 190 80 262" />
        <path className="diagram-line" pathLength={1} d="M240 112 L240 262" />
        <path className="diagram-line" pathLength={1} d="M240 112 C240 190 400 190 400 262" />
      </g>
      <g>
        <rect x="140" y="40" width="200" height="72" rx="6" fill="#17383c" stroke="#f2a766" />
        <text x="240" y="70" textAnchor="middle" fill="#fff" fontSize="15" fontWeight="600">
          Group overview
        </text>
        <text x="240" y="92" textAnchor="middle" fill="#b4c4c3" fontSize="12.5">
          2,520 students · sample
        </text>
      </g>
      {CAMPUS_NODES.map((c) => (
        <g key={c.name} className="diagram-node">
          <rect
            x={c.x}
            y="262"
            width="128"
            height="120"
            rx="6"
            fill="none"
            stroke="#5d7b7e"
            strokeDasharray="4 4"
          />
          <text x={c.x + 64} y="294" textAnchor="middle" fill="#fff" fontSize="15" fontWeight="600">
            {c.name}
          </text>
          <text x={c.x + 64} y="316" textAnchor="middle" fill="#b4c4c3" fontSize="12.5">
            Own workspace
          </text>
          <text x={c.x + 64} y="352" textAnchor="middle" fill="#b4c4c3" fontSize="12.5">
            {c.metric}
          </text>
        </g>
      ))}
      <text x="240" y="408" textAnchor="middle" fill="#b4c4c3" fontSize="12.5">
        Dashed outline = workspace boundary
      </text>
    </svg>
  );
}

export function MultiCampus() {
  return (
    <Section id="campuses" tone="dark" aria-labelledby="campus-title">
      <Container className="grid items-center gap-8 lg:grid-cols-2 lg:gap-24">
        <div>
          <Eyebrow className="text-accent-light">Multi-campus visibility</Eyebrow>
          <MaskHeading
            id="campus-title"
            text="One view across campuses. Boundaries between them."
            className="mb-4 text-white"
          />
          <Reveal>
            <p className="text-on-dark max-w-[56ch]">
              Authorized school-group leaders can see consolidated figures. Each campus works in its
              own workspace, with its own users and permissions.
            </p>
            <ul className="mt-8 grid">
              {POINTS.map(([t, b]) => (
                <li key={t} className="border-ink-line text-on-dark border-t py-4 text-[0.95rem]">
                  <strong className="font-display block text-[1.1rem] font-medium text-white">
                    {t}
                  </strong>
                  {b}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
        <figure>
          <CampusDiagram />
          <figcaption className="text-on-dark mt-3 text-xs">
            Illustrative diagram with fictional schools.
          </figcaption>
        </figure>
      </Container>
    </Section>
  );
}
