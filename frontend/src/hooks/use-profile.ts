import { useCallback, useMemo } from "react";
import { findProfile, isProfileOnline, logActivity } from "../services/profile-service";
import { useAuth } from "./use-auth-context";
import { useWorkspace } from "./use-workspace";

export function useCurrentProfile() {
  const { user } = useAuth();
  const workspace = useWorkspace();
  const profile = useMemo(() => findProfile(workspace.data?.userProfiles, user?.id), [workspace.data, user?.id]);
  return { profile, online: isProfileOnline(profile) };
}

export function useActivityLogger() {
  const { user } = useAuth();
  const { profile } = useCurrentProfile();
  return useCallback((action: string, entityType: string, entityId: string, entityLabel: string) => {
    if (!user) return;
    void logActivity(user, profile, action, entityType, entityId, entityLabel);
  }, [user, profile]);
}
