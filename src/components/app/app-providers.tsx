"use client";

import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { ServicesProvider } from "@/hooks/use-services";
import { SessionProvider } from "@/hooks/use-session";

/** Client providers for everything behind the sign-in: session, data services, toasts. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ServicesProvider>
        <ToastProvider>{children}</ToastProvider>
      </ServicesProvider>
    </SessionProvider>
  );
}
