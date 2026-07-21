import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { authService } from "../services/auth-service";
import type { SafeUser } from "../types/auth";
import { AuthContext, type AuthContextValue } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setUser(await authService.bootstrap());
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login = useCallback(async (identifier: string, password: string, remember: boolean) => {
    const result = await authService.login(identifier, password, remember);
    setUser(result.user);
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    refresh,
    login,
    logout,
    hasPermission: (permission) => authService.hasPermission(user, permission),
  }), [loading, login, logout, refresh, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
