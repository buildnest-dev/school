import type { Metadata } from "next";
import { ResetPassword } from "@/components/app/password-forms";

export const metadata: Metadata = {
  title: "Choose a password",
  robots: { index: false },
  referrer: "no-referrer",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  return <ResetPassword token={typeof token === "string" ? token : ""} />;
}
