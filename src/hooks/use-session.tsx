"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { env } from "@/config/env";
import { apiRequest } from "@/lib/api/client";
import { PERSONAS } from "@/mocks/data";
import type { SessionUser } from "@/types";

type Status = "loading" | "signedOut" | "ready";
interface SessionApi {
  status: Status;
  user: SessionUser | null;
  /** Development sign-in only (mock mode). The real session comes from the backend. */
  devSignIn: (personaId: string) => void;
  /** API mode: signs in with the backend (sets its cookie) and loads the session. Throws ApiError. */
  signIn: (email: string, password: string, code?: string) => Promise<SessionUser>;
  signOut: () => void;
}

const Ctx = createContext<SessionApi | null>(null);
const KEY = "schoolos.dev.persona"; // UI-only dev convenience; never real credentials

/**
 * Mock mode: the "session" is a development persona remembered for this browser tab.
 * API mode: the session is whatever the backend returns from GET /me (cookie-based, proposed).
 * Either way, hiding UI is NOT authorization: the backend must enforce every permission.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ status: Status; user: SessionUser | null }>({
    status: "loading",
    user: null,
  });

  useEffect(() => {
    let alive = true;
    if (env.dataSource === "api") {
      apiRequest<SessionUser>("/me")
        .then((user) => alive && setState({ status: "ready", user }))
        .catch(() => alive && setState({ status: "signedOut", user: null }));
    } else {
      let id: string | null = null;
      try {
        id = sessionStorage.getItem(KEY);
      } catch {
        /* storage unavailable */
      }
      const user = PERSONAS.find((p) => p.id === id) ?? null;
      // Reading sessionStorage is only possible after mount (it would differ from the server render).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState(user ? { status: "ready", user } : { status: "signedOut", user: null });
    }
    return () => {
      alive = false;
    };
  }, []);

  const devSignIn = useCallback((personaId: string) => {
    const user = PERSONAS.find((p) => p.id === personaId);
    if (!user) return;
    try {
      sessionStorage.setItem(KEY, personaId);
    } catch {
      /* ignore */
    }
    setState({ status: "ready", user });
  }, []);
  const signIn = useCallback(async (email: string, password: string, code?: string) => {
    await apiRequest("/auth/login", {
      method: "POST",
      body: { email, password, ...(code ? { code } : {}) },
    });
    const user = await apiRequest<SessionUser>("/me");
    setState({ status: "ready", user });
    return user;
  }, []);
  const signOut = useCallback(() => {
    // The server ends the session and clears its cookie; the screen does not wait for it.
    if (env.dataSource === "api")
      void apiRequest("/auth/logout", { method: "POST" }).catch(() => {});
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setState({ status: "signedOut", user: null });
  }, []);

  const value = useMemo(
    () => ({ ...state, devSignIn, signIn, signOut }),
    [state, devSignIn, signIn, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionApi {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSession must be used inside <SessionProvider>");
  return c;
}
