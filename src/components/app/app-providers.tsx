"use client";

import type { ReactNode } from "react";
import { MfaGate } from "@/components/app/mfa-gate";
import { ToastProvider } from "@/components/ui/toast";
import { ServicesProvider } from "@/hooks/use-services";
import { SessionProvider } from "@/hooks/use-session";

/** Client providers for everything behind the sign-in: session, data services, toasts. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ServicesProvider>
        <ToastProvider>
          <MfaGate>{children}</MfaGate>
        </ToastProvider>
      </ServicesProvider>
    </SessionProvider>
  );
}
