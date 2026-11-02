import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container, Eyebrow } from "@/components/ui/primitives";
import { BrandLogo } from "./brand-logo";

/** Shared body for destinations that are not built yet, so no link is ever dead or misleading. */
export function PlaceholderPage({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="py-24">
      <Container className="max-w-[720px]">
        <BrandLogo className="mb-10" />
        <Eyebrow>Placeholder</Eyebrow>
        <h1 className="mb-4 text-[clamp(2rem,4vw,3rem)] leading-tight">{title}</h1>
        <p className="text-muted mb-4 text-lg">
          {children ??
            "This page has not been built yet. It exists so the link works while the product is in development."}
        </p>
        <Button asChild variant="ghost" className="mt-4">
          <Link href="/">Back to the home page</Link>
        </Button>
      </Container>
    </section>
  );
}
