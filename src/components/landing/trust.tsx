import { Container, Eyebrow, Section } from "@/components/ui/primitives";
import { MaskHeading } from "@/components/motion/mask-heading";
import { Reveal, Stagger } from "@/components/motion/reveal";
import { TRUST_ITEMS } from "@/lib/data/content";

export function Trust() {
  return (
    <Section id="trust" aria-labelledby="trust-title">
      <Container className="grid items-start gap-8 lg:grid-cols-[0.9fr_1.3fr] lg:gap-24">
        <div className="lg:sticky lg:top-28">
          <Eyebrow>Trust, security &amp; control</Eyebrow>
          <MaskHeading
            id="trust-title"
            text="Built around the idea that school data is private."
            className="mb-4"
          />
          <Reveal>
            <p className="text-muted max-w-[56ch]">
              These describe what the platform is being designed to provide. They are product goals,
              not certifications or verified guarantees.
            </p>
          </Reveal>
        </div>
        <Stagger as="ul" className="border-ink border-t-2">
          {TRUST_ITEMS.map((item) => (
            <li
              key={item.title}
              className="border-line grid gap-x-6 border-b py-6 sm:grid-cols-[110px_1fr]"
            >
              <span className="text-accent-ink row-span-2 pt-1.5 text-[0.68rem] font-bold tracking-widest uppercase">
                Design goal
              </span>
              <h3 className="mb-1 text-xl">{item.title}</h3>
              <p className="text-muted">{item.body}</p>
            </li>
          ))}
        </Stagger>
      </Container>
    </Section>
  );
}
