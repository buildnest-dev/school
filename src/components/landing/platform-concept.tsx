import { Icon } from "@/components/ui/icon";
import { Container, Eyebrow, Section, SectionIntro } from "@/components/ui/primitives";
import { MaskHeading } from "@/components/motion/mask-heading";
import { Reveal, Stagger } from "@/components/motion/reveal";
import { FLOW_STEPS } from "@/lib/data/content";

const WORKSPACES = [
  { name: "Northfield Academy", color: "#b8501e" },
  { name: "Riverstone Public School", color: "#2b5fa8" },
  { name: "Lakeview Junior Campus", color: "#2d7556" },
];
const chip = "rounded-full border bg-surface px-3 py-2 text-[0.82rem] font-semibold text-ink";

function FlowVisual({ index }: { index: number }) {
  if (index === 0)
    return (
      <div className="bg-ink flex items-center gap-3 rounded-sm p-5 font-semibold text-white">
        <Icon name="setup" className="text-accent-light size-[22px]" />
        Shared platform
      </div>
    );
  if (index === 1)
    return (
      <>
        {WORKSPACES.map((w) => (
          <div
            key={w.name}
            className="border-line bg-surface text-ink rounded-sm border border-l-4 px-3.5 py-3 text-[0.85rem] font-semibold"
            style={{ borderLeftColor: w.color }}
          >
            {w.name}
          </div>
        ))}
      </>
    );
  const items =
    index === 2
      ? ["Principal", "Teacher", "Accounts", "Parent", "Student"]
      : ["Admissions", "Attendance", "Fees", "Exams", "Notices"];
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((t) => (
        <span
          key={t}
          className={`${chip} ${index === 2 ? "border-ink" : "border-line border-dashed"}`}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

export function PlatformConcept() {
  return (
    <Section id="concept" aria-labelledby="concept-title">
      <Container>
        <SectionIntro
          eyebrow={<Eyebrow>Universal platform</Eyebrow>}
          heading={
            <MaskHeading
              id="concept-title"
              text="Software for many schools, not a website for one."
            />
          }
        >
          <p>
            Each institution subscribes to the same platform and works inside its own configured
            workspace, with its own branding, structure, users and permissions.
          </p>
        </SectionIntro>

        <Stagger
          as="ol"
          gap={0.12}
          className="border-ink grid border-t-2 sm:grid-cols-2 lg:grid-cols-4"
        >
          {FLOW_STEPS.map((step, i) => (
            <li
              key={step.n}
              className="border-line border-b py-6 pr-4 sm:odd:pl-0 sm:even:border-l sm:even:pl-4 lg:border-b-0 lg:border-l lg:pr-6 lg:pl-6 lg:first:border-l-0 lg:first:pl-0"
            >
              <span className="font-display text-accent-ink mb-4 block text-[0.95rem]">
                {step.n}
              </span>
              <div className="mb-5 flex min-h-[150px] flex-col justify-center gap-2">
                <FlowVisual index={i} />
              </div>
              <h3 className="mb-2 text-xl">{step.title}</h3>
              <p className="text-muted text-[0.95rem]">{step.body}</p>
            </li>
          ))}
        </Stagger>

        <Reveal>
          <p className="bg-paper-2 border-accent mt-12 flex max-w-[820px] items-start gap-3.5 border-l-[3px] p-6">
            <Icon name="lock" className="text-accent-ink mt-1 size-[22px]" />
            <span>
              <strong>The boundary is the point.</strong> Platform administration is meant to
              operate the service, not to browse a school’s private records, and one school should
              never reach another’s data.
            </span>
          </p>
        </Reveal>
      </Container>
    </Section>
  );
}
