"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createServices, type Services } from "@/services";

const Ctx = createContext<Services | null>(null);

/** Provides the active data adapter (mock or API). Tests can pass their own `services`. */
export function ServicesProvider({
  children,
  services,
}: {
  children: ReactNode;
  services?: Services;
}) {
  const value = useMemo(() => services ?? createServices(), [services]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useServices(): Services {
  const s = useContext(Ctx);
  if (!s) throw new Error("useServices must be used inside <ServicesProvider>");
  return s;
}
