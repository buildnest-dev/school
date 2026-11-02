import { Icon } from "@/components/ui/icon";
import { Container, Eyebrow, Section } from "@/components/ui/primitives";
import { MaskHeading } from "@/components/motion/mask-heading";
import { Stagger } from "@/components/motion/reveal";
import { LEAD_CAPABILITIES, LIST_CAPABILITIES } from "@/lib/data/content";

export function Capabilities() {
  return (
    <Section id="features" tone="alt" aria-labelledby="features-title">
      <Container>
        <div className="mb-12 max-w-[780px]">
          <Eyebrow>Core product capabilities</Eyebrow>
          <MaskHeading id="features-title" text="Everything a school runs on, in one workspace." />
        </div>

        <Stagger gap={0.12} className="border-ink bg-surface grid border lg:grid-cols-3">
          {LEAD_CAPABILITIES.map((cap) => (
            <article
              key={cap.title}
              className="border-line flex flex-col gap-3 border-t p-8 first:border-t-0 lg:border-t-0 lg:border-l lg:first:border-l-0"
            >
              <Icon name={cap.icon} className="text-accent-ink mb-4 size-8" />
              <h3 className="text-[1.3rem]">{cap.title}</h3>
              <p className="text-muted">{cap.body}</p>
              <ul className="mt-auto grid gap-1.5 pt-4 text-[0.88rem]">
                {cap.points?.map((p) => (
                  <li
                    key={p}
                    className="before:bg-accent flex items-baseline gap-2.5 before:h-px before:w-2.5 before:flex-none before:-translate-y-1"
                  >
                    {p}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </Stagger>

        <Stagger as="ul" gap={0.06} className="mt-8 grid gap-x-12 md:grid-cols-2">
          {LIST_CAPABILITIES.map((cap) => (
            <li
              key={cap.title}
              className="border-line group grid grid-cols-[40px_1fr] gap-x-4 border-t py-6"
            >
              <Icon
                name={cap.icon}
                className="text-accent-ink row-span-2 mt-0.5 size-[22px] transition-transform duration-300 group-hover:-translate-y-0.5"
              />
              <h3 className="mb-1 text-[1.15rem]">{cap.title}</h3>
              <p className="text-muted text-[0.95rem]">{cap.body}</p>
            </li>
          ))}
        </Stagger>
      </Container>
    </Section>
  );
}
