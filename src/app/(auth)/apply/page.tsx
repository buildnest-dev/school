import type { Metadata } from "next";
import { ApplyForm } from "@/components/app/public-forms";

export const metadata: Metadata = { title: "Admission enquiry", robots: { index: false } };

export default function ApplyPage() {
  return <ApplyForm />;
}
