import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authApi } from "@/services/authApi";
import { refreshSession } from "@/services/session";
import { setAccessToken } from "@/services/tokenStore";
import type { MeResult } from "@/types/auth";

type Status = "loading" | "authenticated" | "anonymous";

interface AuthValue {
  status: Status;
  me: MeResult | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [me, setMe] = useState<MeResult | null>(null);

  const loadMe = useCallback(async () => {
    setMe(await authApi.me());
    setStatus("authenticated");
  }, []);

  // On first load (or reload) the in-memory token is gone: the HttpOnly cookie silently restores the session.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (await refreshSession()) await loadMe();
        else if (!cancelled) setStatus("anonymous");
      } catch {
        if (!cancelled) setStatus("anonymous");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadMe]);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await authApi.login(email, password);
      setAccessToken(result.accessToken);
      await loadMe();
    },
    [loadMe]
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setAccessToken(null);
      setMe(null);
      setStatus("anonymous");
    }
  }, []);

  const value = useMemo(() => ({ status, me, login, logout }), [status, me, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
