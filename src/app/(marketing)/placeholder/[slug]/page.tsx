import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { PLACEHOLDER_PAGES, type PlaceholderSlug } from "@/lib/site";

type Params = { slug: string };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return Object.keys(PLACEHOLDER_PAGES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const title = PLACEHOLDER_PAGES[slug as PlaceholderSlug];
  return { title: title ?? "Not found", robots: { index: false } };
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const title = PLACEHOLDER_PAGES[slug as PlaceholderSlug];
  if (!title) notFound();
  return <PlaceholderPage title={title} />;
}
