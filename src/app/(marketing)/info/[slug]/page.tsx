import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/primitives";
import { INFO_PAGES } from "@/lib/data/info-pages";
import { INFO_TITLES, ROUTES, type InfoSlug } from "@/lib/site";

type Params = { slug: string };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return Object.keys(INFO_TITLES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const title = INFO_TITLES[slug as InfoSlug];
  return { title: title ?? "Not found", robots: { index: false } };
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const title = INFO_TITLES[slug as InfoSlug];
  if (!title) notFound();
  const page = INFO_PAGES[slug as InfoSlug];
  return (
    <section className="py-16">
      <Container className="max-w-[760px]">
        <h1 className="mb-3 text-[clamp(2rem,4vw,2.8rem)] leading-tight">{title}</h1>
        <p className="text-muted mb-8 text-lg">{page.intro}</p>
        {page.draft ? (
          <p className="border-warn/40 mb-8 rounded-2xl border bg-[#fef5e4] px-4 py-3 text-sm text-[#6b4306]">
            Draft: this wording is waiting for legal review and is not yet final.
          </p>
        ) : null}
        <div className="grid gap-4">
          {page.sections.map((s) => (
            <article
              key={s.title}
              className="border-line bg-surface shadow-card rounded-2xl border p-5"
            >
              <h2 className="mb-2 text-xl">{s.title}</h2>
              {s.body.map((p) => (
                <p key={p} className="mt-1.5">
                  {p}
                </p>
              ))}
            </article>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <Link href={ROUTES.getStarted}>Get started</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/">Back to the home page</Link>
          </Button>
        </div>
      </Container>
    </section>
  );
}
