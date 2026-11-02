"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { Container, Eyebrow, Section, SectionIntro } from "@/components/ui/primitives";
import { MaskHeading } from "@/components/motion/mask-heading";
import { Reveal } from "@/components/motion/reveal";
import { AppWindow } from "@/components/mockups/primitives";
import { ROLES } from "@/lib/data/content";

export function Roles() {
  return (
    <Section id="roles" tone="alt" aria-labelledby="roles-title">
      <Container>
        <SectionIntro
          eyebrow={<Eyebrow>Designed for every school role</Eyebrow>}
          heading={<MaskHeading id="roles-title" text="Everyone sees what is theirs." />}
        >
          <p>
            Access is role-based: each person sees only the information and actions permitted for
            their role inside their school’s workspace.
          </p>
        </SectionIntro>

        <Reveal variant="media">
          <Tabs.Root
            defaultValue={ROLES[0].id}
            orientation="vertical"
            className="grid items-start gap-6 lg:grid-cols-[260px_1fr] lg:gap-12"
          >
            <Tabs.List
              aria-label="Choose a role"
              className="border-line flex overflow-x-auto border-b lg:flex-col lg:overflow-visible lg:border-b-0 lg:border-l"
            >
              {ROLES.map((r) => (
                <Tabs.Trigger
                  key={r.id}
                  value={r.id}
                  className="text-muted hover:text-ink data-[state=active]:text-ink data-[state=active]:border-accent data-[state=active]:bg-surface hover:bg-ink/5 min-h-[52px] flex-none border-b-[3px] border-transparent px-[18px] text-left font-semibold whitespace-nowrap transition-colors lg:-ml-px lg:border-b-0 lg:border-l-[3px] lg:whitespace-normal"
                >
                  {r.label}
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            {ROLES.map((r) => (
              <Tabs.Content
                key={r.id}
                value={r.id}
                className="grid min-h-0 items-center gap-6 lg:min-h-[320px] lg:grid-cols-2 lg:gap-12"
              >
                <div>
                  <h3 className="mb-3 text-[clamp(1.4rem,2.4vw,1.9rem)]">{r.heading}</h3>
                  <p className="text-muted">{r.body}</p>
                </div>
                <AppWindow title={r.title} className="overflow-hidden">
                  <ul>
                    {r.rows.map(([label, value]) => (
                      <li
                        key={label}
                        className="border-line flex justify-between gap-4 border-b px-[18px] py-4 text-[0.9rem] last:border-b-0"
                      >
                        <span>{label}</span>
                        <b className="font-display text-ink text-[1.15rem] font-medium">{value}</b>
                      </li>
                    ))}
                  </ul>
                </AppWindow>
              </Tabs.Content>
            ))}
          </Tabs.Root>
        </Reveal>
      </Container>
    </Section>
  );
}
