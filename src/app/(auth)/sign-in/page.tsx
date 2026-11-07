import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DevSignIn } from "@/components/app/dev-sign-in";
import { currentHost } from "@/server/auth";
import { platformPasswordAllowed } from "@/server/sso";

export const metadata: Metadata = { title: "Sign In", robots: { index: false } };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  // Team members sign in through the website editor, so the team address has no password form.
  if ((await currentHost()).kind === "team" && !platformPasswordAllowed() && !error)
    redirect("/api/platform/sso/login");
  if (error === "sso")
    return (
      <main id="main" className="bg-paper min-h-screen px-4 py-12">
        <div className="mx-auto grid max-w-md gap-4">
          <h1 className="text-2xl">Could not sign you in</h1>
          <p className="text-muted">
            Your ZAQSA team account was not accepted. Try again, and ask an administrator if it keeps
            happening.
          </p>
          <a className="underline underline-offset-4" href="/api/platform/sso/login">
            Sign in again
          </a>
        </div>
      </main>
    );
  return <DevSignIn />;
}
