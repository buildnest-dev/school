import { AcademicYear } from "@/components/landing/academic-year";
import { Capabilities } from "@/components/landing/capabilities";
import { FinalCta } from "@/components/landing/final-cta";
import { Hero } from "@/components/landing/hero";
import { MultiCampus } from "@/components/landing/multi-campus";
import { PlatformConcept } from "@/components/landing/platform-concept";
import { ProductShowcase } from "@/components/landing/product-showcase";
import { Roles } from "@/components/landing/roles";
import { Trust } from "@/components/landing/trust";

export default function HomePage() {
  return (
    <>
      <Hero />
      <PlatformConcept />
      <Capabilities />
      <ProductShowcase />
      <Roles />
      <AcademicYear />
      <MultiCampus />
      <Trust />
      <FinalCta />
    </>
  );
}
