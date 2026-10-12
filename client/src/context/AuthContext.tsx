import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import * as T from "@/api/types";
import { login as apiLogin, logout as apiLogout, mePrincipal } from "@/api/client";

type Status = "loading" | "anon" | "auth";

type AuthContextValue = {
  status: Status;
  principal: T.Principal | null;
  isAdmin: boolean;
  isTeam: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [principal, setPrincipal] = useState<T.Principal | null>(null);

  const refresh = useCallback(async () => {
    try {
      const p = await mePrincipal();
      setPrincipal(p);
      setStatus("auth");
    } catch {
      setPrincipal(null);
      setStatus("anon");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    const p = await apiLogin(username, password);
    setPrincipal(p);
    setStatus("auth");
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setPrincipal(null);
      setStatus("anon");
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      principal,
      isAdmin: principal?.type === "admin",
      isTeam: principal?.type === "team",
      login,
      logout,
      refresh,
    }),
    [status, principal, login, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}