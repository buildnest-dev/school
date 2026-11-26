import type { Metadata } from "next";
import { VerifyForm } from "@/components/app/public-forms";

export const metadata: Metadata = { title: "Check a certificate", robots: { index: false } };

export default function VerifyPage() {
  return <VerifyForm />;
}
