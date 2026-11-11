"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { ApiError, apiRequest } from "@/lib/api/client";

function Shell({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <main id="main" className="bg-paper min-h-screen px-4 py-12">
      <div className="mx-auto grid max-w-3xl gap-6">
        <BrandLogo />
        <div>
          <h1 className="text-[clamp(1.8rem,4vw,2.6rem)] leading-tight">{title}</h1>
          <p className="text-muted mt-1">{intro}</p>
        </div>
        {children}
        <p className="text-sm">
          <Link href="/sign-in" className="underline underline-offset-4">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

/** Asks for a reset e-mail. The answer is the same whether or not the address has an account. */
export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiRequest("/auth/forgot-password", { method: "POST", body: { email: email.trim() } });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send the e-mail. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell
      title="Forgot your password?"
      intro="Enter your e-mail and we will send you a link to choose a new one."
    >
      {done ? (
        <p role="status" className="text-sm font-medium">
          If that e-mail has an account, a link is on its way. It works for 1 hour. Check your spam
          folder too.
        </p>
      ) : (
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <Field id="email" label="E-mail" required>
            {(a) => (
              <Input
                {...a}
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </Field>
          {error ? (
            <p role="alert" className="text-bad text-sm font-medium">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={busy || !email}>
            {busy ? "Sending…" : "Send the link"}
          </Button>
        </form>
      )}
    </Shell>
  );
}

/** Chooses a new password from the e-mailed link (reset or first-time invite). */
export function ResetPassword({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== again) {
      setError("The two passwords are not the same.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiRequest("/auth/reset-password", { method: "POST", body: { token, password } });
      setDone(true);
    } catch (err) {
      const detail = err instanceof ApiError ? err.fieldErrors?.password?.[0] : undefined;
      setError(
        detail ??
          (err instanceof ApiError ? err.message : "Could not save the password. Try again."),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Choose a password" intro="At least 10 characters, with a letter and a digit.">
      {!token ? (
        <p role="alert" className="text-bad text-sm font-medium">
          This link is not complete. Open it again from the e-mail.
        </p>
      ) : done ? (
        <p role="status" className="text-sm font-medium">
          Password saved.{" "}
          <Link href="/sign-in" className="underline underline-offset-4">
            Sign in
          </Link>
        </p>
      ) : (
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <Field id="password" label="New password" required>
            {(a) => (
              <PasswordInput
                {...a}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </Field>
          <Field id="again" label="New password again" required>
            {(a) => (
              <PasswordInput
                {...a}
                autoComplete="new-password"
                value={again}
                onChange={(e) => setAgain(e.target.value)}
              />
            )}
          </Field>
          {error ? (
            <p role="alert" className="text-bad text-sm font-medium">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={busy || !password || !again}>
            {busy ? "Saving…" : "Save password"}
          </Button>
        </form>
      )}
    </Shell>
  );
}
