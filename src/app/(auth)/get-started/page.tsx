import type { Metadata } from "next";
import { GetStartedForm } from "@/components/app/get-started-form";
import { AuthShell } from "@/components/layout/auth-shell";

export const metadata: Metadata = { title: "Get started", robots: { index: false } };

/** Sign-up: a request to the ZAQSA team, who set the school up. */
export default function GetStartedPage() {
  return (
    <AuthShell>
      <GetStartedForm />
    </AuthShell>
  );
}
