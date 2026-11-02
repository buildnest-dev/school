import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = { title: "Get started", robots: { index: false } };

/** Entry point for school registration and onboarding. Not implemented yet. */
export default function GetStartedPage() {
  return (
    <main id="main">
      <PlaceholderPage title="Get started">
        School registration and workspace onboarding are placeholders. For now, use the demo request
        form on the home page.
      </PlaceholderPage>
    </main>
  );
}
