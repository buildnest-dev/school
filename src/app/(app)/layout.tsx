import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppProviders } from "@/components/app/app-providers";

/** Everything below is the authenticated product, separate from the public marketing shell. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppProviders>{children}</AppProviders>;
}
