"use client";

import { FlaskConical } from "lucide-react";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/layout/brand-logo";
import { Avatar } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { AREA_ROOT, ROLE_AREA, ROLE_LABEL } from "@/config/screens";
import { env } from "@/config/env";
import { useSession } from "@/hooks/use-session";
import { ApiError } from "@/lib/api/client";
import { PERSONAS } from "@/mocks/data";

/**
 * Sign-in entry point. In mock mode it is a DEVELOPMENT role picker: no credentials, no real
 * authentication. In API mode the backend owns sign-in; this screen only explains that.
 */
export function DevSignIn() {
  const { devSignIn, signIn, user } = useSession();
  const [form, setForm] = useState({ email: "", password: "", code: "" });
  const [needsCode, setNeedsCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const me = await signIn(
        form.email.trim(),
        form.password,
        needsCode ? form.code.trim() : undefined,
      );
      // The website editor sends people here and expects them back; only that one path is honoured.
      const next = new URLSearchParams(window.location.search).get("next");
      if (me.role === "platform_admin" && next?.startsWith("/api/platform/sso/start?")) {
        window.location.assign(next);
        return;
      }
      router.push(AREA_ROOT[ROLE_AREA[me.role]]);
    } catch (err) {
      if (err instanceof ApiError && err.code === "mfa_required") {
        setNeedsCode(true);
        setError(null);
      } else {
        setError(err instanceof ApiError ? err.message : "Could not sign in. Try again.");
      }
    } finally {
      setBusy(false);
    }
  };
  const router = useRouter();
  const go = (id: string) => {
    const p = PERSONAS.find((x) => x.id === id);
    if (!p) return;
    devSignIn(id);
    router.push(AREA_ROOT[ROLE_AREA[p.role]]);
  };
  return (
    <main id="main" className="bg-paper min-h-screen px-4 py-12">
      <div className="mx-auto grid max-w-3xl gap-6">
        <BrandLogo />
        <div>
          <h1 className="text-[clamp(1.8rem,4vw,2.6rem)] leading-tight">Sign in</h1>
          <p className="text-muted mt-1">
            {env.dataSource === "mock"
              ? "Real sign-in is built with the backend. For now, pick a role to explore the product with sample data."
              : "Use the e-mail and password your school gave you."}
          </p>
        </div>

        {env.dataSource === "mock" ? (
          <>
            <p className="border-warn/40 flex items-start gap-2 rounded-md border bg-[#fbf3e1] px-3 py-2 text-sm text-[#6b4306]">
              <FlaskConical className="mt-0.5 size-4 flex-none" aria-hidden="true" />
              <span>
                <strong>Development only.</strong> No password, no account, no security. Roles only
                change what the screens show. Real permissions are enforced by the backend.
              </span>
            </p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {PERSONAS.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => go(p.id)}
                    aria-current={user?.id === p.id ? "true" : undefined}
                    className="border-line bg-surface hover:border-ink flex min-h-16 w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors"
                  >
                    <Avatar name={p.name} />
                    <span>
                      <span className="block font-semibold">{ROLE_LABEL[p.role]}</span>
                      <span className="text-muted text-sm">
                        {p.name}
                        {p.tenantName ? ` · ${p.tenantName}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <form onSubmit={submit} className="grid gap-4" noValidate>
            <Field id="email" label="E-mail" required>
              {(a) => (
                <Input
                  {...a}
                  type="email"
                  autoComplete="username"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              )}
            </Field>
            <Field id="password" label="Password" required>
              {(a) => (
                <Input
                  {...a}
                  type="password"
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              )}
            </Field>
            {needsCode ? (
              <Field
                id="code"
                label="Authenticator code"
                hint="The 6-digit code from your authenticator app."
                required
              >
                {(a) => (
                  <Input
                    {...a}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                  />
                )}
              </Field>
            ) : null}
            {error ? (
              <p role="alert" className="text-bad text-sm font-medium">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={busy || !form.email || !form.password}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        )}
        <p className="text-sm">
          <Link href="/" className="underline underline-offset-4">
            Back to the website
          </Link>
        </p>
      </div>
    </main>
  );
}
