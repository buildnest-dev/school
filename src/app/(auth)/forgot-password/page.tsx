import type { Metadata } from "next";
import { ForgotPassword } from "@/components/app/password-forms";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return <ForgotPassword />;
}
