import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { WorkspaceData } from "@shared/types/domain";
import { ensureProfile, findProfile, touchProfile } from "../services/profile-service";
import { useAuth } from "./use-auth-context";
import { useWorkspace, workspaceKey } from "./use-workspace";

const HEARTBEAT_MS = 60_000;

function patchProfile(queryClient: ReturnType<typeof useQueryClient>, profile: { userId: string }) {
  queryClient.setQueryData<WorkspaceData>(workspaceKey, (current) => {
    if (!current) return current;
    const others = current.userProfiles.filter((item) => item.userId !== profile.userId);
    return { ...current, userProfiles: [...others, profile as WorkspaceData["userProfiles"][number]] };
  });
}

export function useProfileSync() {
  const { user } = useAuth();
  const workspace = useWorkspace();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user || !workspace.data) return;
    let cancelled = false;
    void ensureProfile(user, workspace.data.userProfiles).then((profile) => { if (!cancelled) patchProfile(queryClient, profile); });

    const heartbeat = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const current = queryClient.getQueryData<WorkspaceData>(workspaceKey);
      const existing = findProfile(current?.userProfiles, user.id);
      if (existing) void touchProfile(existing).then((updated) => { if (!cancelled) patchProfile(queryClient, updated); });
    }, HEARTBEAT_MS);

    return () => { cancelled = true; window.clearInterval(heartbeat); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, Boolean(workspace.data), queryClient]);
}
