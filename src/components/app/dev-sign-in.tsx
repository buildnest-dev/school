"use client";

import { FlaskConical } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/layout/brand-logo";
import { Avatar } from "@/components/shared/blocks";
import { AREA_ROOT, ROLE_AREA, ROLE_LABEL } from "@/config/screens";
import { env } from "@/config/env";
import { useSession } from "@/hooks/use-session";
import { PERSONAS } from "@/mocks/data";

/**
 * Sign-in entry point. In mock mode it is a DEVELOPMENT role picker: no credentials, no real
 * authentication. In API mode the backend owns sign-in; this screen only explains that.
 */
export function DevSignIn() {
  const { devSignIn, user } = useSession();
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
              : "Sign-in is handled by the school platform’s backend. This build does not collect credentials."}
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
        ) : null}
        <p className="text-sm">
          <Link href="/" className="underline underline-offset-4">
            Back to the website
          </Link>
        </p>
      </div>
    </main>
  );
}
