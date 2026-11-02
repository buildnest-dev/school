import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ScreenHost } from "@/components/app/screen-host";
import { matchScreen, staticSlugs } from "@/config/screens";
import { BRAND } from "@/lib/site";
import type { Area } from "@/types";

const AREAS: readonly Area[] = ["platform", "school", "teacher", "parent", "student"];
const isArea = (v: string): v is Area => (AREAS as readonly string[]).includes(v);

type Params = { area: string; slug?: string[] };

export function generateStaticParams() {
  return AREAS.flatMap((area) => staticSlugs(area).map((slug) => ({ area, slug })));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { area, slug = [] } = await params;
  const m = isArea(area) ? matchScreen(area, slug) : null;
  return { title: m ? `${m.screen.title} · ${BRAND}` : BRAND };
}

export default async function AreaPage({ params }: { params: Promise<Params> }) {
  const { area, slug = [] } = await params;
  if (!isArea(area)) notFound();
  return <ScreenHost area={area} slug={slug} />;
}
