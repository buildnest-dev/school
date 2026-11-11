"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { BrandLogo } from "@/components/layout/brand-logo";
import { Button } from "@/components/ui/button";
import { LoadingBlock } from "@/components/ui/states";
import { isDemoHost } from "@/config/demo";
import { env } from "@/config/env";
import {
  AREA_ROOT,
  NO_BACKEND_YET,
  ROLE_AREA,
  ROLE_LABEL,
  canAccess,
  matchScreen,
} from "@/config/screens";
import { SCREEN_COMPONENTS } from "@/features/registry";
import { ComingSoon, PlannedScreen } from "@/features/shared/planned-screen";
import { useSession } from "@/hooks/use-session";
import type { Area } from "@/types";

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-paper grid min-h-screen place-items-center p-6">
      <div className="grid max-w-md gap-4 text-center">
        <BrandLogo className="mx-auto" />
        {children}
      </div>
    </main>
  );
}

function Unauthorized({
  role,
  homeHref,
  inShell,
}: {
  role: string;
  homeHref: string;
  inShell: boolean;
}) {
  const body = (
    <div className="grid max-w-md gap-3" role="alert">
      <h1 className="text-2xl">You don’t have access to this page</h1>
      <p className="text-muted">
        Your role ({role}) isn’t allowed here. The menu only shows what your role can use. The
        server must also enforce this: hiding a link is never real protection.
      </p>
      <div>
        <Button asChild variant="ghost">
          <Link href={homeHref}>Go to my home</Link>
        </Button>
      </div>
    </div>
  );
  return inShell ? body : <Centered>{body}</Centered>;
}

/**
 * Client-side route guard + screen renderer. This is permission-aware UI only.
 * Real authorization (and tenant isolation) must be enforced by the backend on every request.
 */
export function ScreenHost({ area, slug }: { area: Area; slug: string[] }) {
  const { status, user } = useSession();
  const router = useRouter();
  const match = matchScreen(area, slug);

  useEffect(() => {
    if (status === "signedOut") router.replace("/sign-in");
  }, [status, router]);

  useEffect(() => {
    if (match) document.title = `${match.screen.title} · ${user?.tenantName ?? "Platform"}`;
  }, [match, user]);

  if (status !== "ready" || !user) {
    return (
      <Centered>
        <LoadingBlock
          label={status === "signedOut" ? "Redirecting to sign-in" : "Loading your workspace"}
          rows={2}
        />
      </Centered>
    );
  }

  const ownArea = ROLE_AREA[user.role];
  if (ownArea !== area) {
    return (
      <Unauthorized role={ROLE_LABEL[user.role]} homeHref={AREA_ROOT[ownArea]} inShell={false} />
    );
  }

  if (!match) {
    return (
      <AppShell area={area}>
        <div className="grid max-w-md gap-3">
          <h1 className="text-2xl">Page not found</h1>
          <p className="text-muted">There is no page at this address.</p>
          <div>
            <Button asChild variant="ghost">
              <Link href={AREA_ROOT[area]}>Back to home</Link>
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!canAccess(user.role, match.screen)) {
    return (
      <AppShell area={area}>
        <Unauthorized role={ROLE_LABEL[user.role]} homeHref={AREA_ROOT[area]} inShell />
      </AppShell>
    );
  }

  const Component = SCREEN_COMPONENTS[match.screen.id];
  // With the real backend, a screen whose backend is not built must not show sample data or an
  // error: say plainly that it is coming.
  const comingSoon =
    env.dataSource === "api" && NO_BACKEND_YET.has(match.screen.id) && !isDemoHost();
  return (
    <AppShell area={area}>
      {comingSoon ? (
        <ComingSoon screen={match.screen} />
      ) : Component ? (
        <Component screen={match.screen} params={match.params} />
      ) : (
        <PlannedScreen screen={match.screen} />
      )}
    </AppShell>
  );
}
