import type { Metadata } from "next";
import { DevSignIn } from "@/components/app/dev-sign-in";

export const metadata: Metadata = { title: "Sign In", robots: { index: false } };

export default function SignInPage() {
  return <DevSignIn />;
}
