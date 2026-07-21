import { createContext } from "react";
import type { Permission, SafeUser } from "@shared/types/auth";

export interface AuthContextValue {
  user: SafeUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (identifier: string, password: string, remember: boolean) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
