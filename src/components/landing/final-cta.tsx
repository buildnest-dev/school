import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Container, Eyebrow, Section } from "@/components/ui/primitives";
import { MaskHeading } from "@/components/motion/mask-heading";
import { Reveal } from "@/components/motion/reveal";
import { DemoForm } from "./demo-form";

export function FinalCta() {
  return (
    <Section id="demo" tone="dark" aria-labelledby="cta-title">
      <Container className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-24">
        <div>
          <Eyebrow className="text-accent-light">Get started</Eyebrow>
          <MaskHeading
            id="cta-title"
            text="Your schools. Their own workspaces. One connected platform."
            className="mb-4 text-[clamp(2rem,4vw,3.25rem)] text-white"
          />
          <Reveal>
            <p className="text-on-dark mb-8 max-w-[54ch] text-[clamp(1.05rem,1.5vw,1.2rem)]">
              Bring everyday school operations into a more organized, connected, and scalable
              system.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="light">
                <a href="#demo-name">
                  Book a Demo{" "}
                  <Icon
                    name="arrow"
                    className="size-[18px] transition-transform group-hover:translate-x-[3px]"
                  />
                </a>
              </Button>
              <Button asChild variant="outline-light">
                <Link href="/#concept">Explore the Platform</Link>
              </Button>
            </div>
          </Reveal>
        </div>
        <Reveal variant="media">
          <DemoForm />
        </Reveal>
      </Container>
    </Section>
  );
}
