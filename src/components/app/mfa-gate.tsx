"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useSession } from "@/hooks/use-session";
import { ApiError, apiRequest } from "@/lib/api/client";

/**
 * Platform accounts must use an authenticator app. Until it is on, the only screen they get is
 * this one: add the key to the app, then enter a code to prove it works. The server enforces the
 * same rule, so hiding the screens is a convenience, not the protection.
 */
export function MfaGate({ children }: { children: ReactNode }) {
  const { user, signOut } = useSession();
  if (!user?.mfaSetupRequired) return <>{children}</>;
  return <Enroll onSignOut={signOut} />;
}

function Enroll({ onSignOut }: { onSignOut: () => void }) {
  const [key, setKey] = useState<{ secret: string; otpauth: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await apiRequest<{ secret: string; otpauth: string }>("/auth/mfa/setup", {
        method: "POST",
      });
      setKey({ secret: r.secret, otpauth: r.otpauth });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start the setup. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiRequest("/auth/mfa/enable", { method: "POST", body: { code: code.trim() } });
      window.location.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not confirm the code. Try again.");
      setBusy(false);
    }
  };

  return (
    <main id="main" className="bg-paper min-h-screen px-4 py-12">
      <div className="mx-auto grid max-w-xl gap-6">
        <BrandLogo />
        <div>
          <h1 className="text-[clamp(1.6rem,4vw,2.2rem)] leading-tight">
            Turn on your authenticator app
          </h1>
          <p className="text-muted mt-1">
            ZAQSA team accounts must sign in with a one-time code as well as a password. This takes
            a minute and is needed only once.
          </p>
        </div>

        {!key ? (
          <Button onClick={start} disabled={busy}>
            {busy ? "Preparing…" : "Start setup"}
          </Button>
        ) : (
          <form onSubmit={confirm} className="grid gap-4" noValidate>
            <ol className="text-muted grid list-decimal gap-2 pl-5 text-sm">
              <li>
                In an authenticator app (Google Authenticator, Microsoft Authenticator, Authy), add
                a new account with this key.
              </li>
              <li>Enter the 6-digit code the app shows.</li>
            </ol>
            <div className="border-line bg-surface rounded-md border p-3">
              <p className="text-muted text-xs">Setup key</p>
              <p className="font-mono text-base break-all select-all" data-testid="mfa-secret">
                {key.secret}
              </p>
              <a href={key.otpauth} className="mt-2 inline-block text-sm underline">
                Open in an authenticator app on this device
              </a>
            </div>
            <Field id="mfa-code" label="Code from the app" required>
              {(a) => (
                <Input
                  {...a}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              )}
            </Field>
            <Button type="submit" disabled={busy || code.trim().length !== 6}>
              {busy ? "Checking…" : "Turn on and continue"}
            </Button>
          </form>
        )}

        {error ? (
          <p role="alert" className="text-bad text-sm font-medium">
            {error}
          </p>
        ) : null}
        <p className="text-sm">
          <button type="button" onClick={onSignOut} className="underline underline-offset-4">
            Sign out
          </button>
        </p>
      </div>
    </main>
  );
}
