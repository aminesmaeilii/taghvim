import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Content, ContentFilters } from "@shared/types/domain";
import { contentRepository } from "../services/content-repository";

export const workspaceKey = ["workspace"] as const;
export const contentKey = (filters?: ContentFilters) => ["contents", filters ?? {}] as const;

export function useWorkspace() {
  return useQuery({ queryKey: workspaceKey, queryFn: () => contentRepository.bootstrap(), staleTime: Infinity });
}

export function useContents(filters?: ContentFilters) {
  return useQuery({ queryKey: contentKey(filters), queryFn: () => contentRepository.listContents(filters) });
}

export function useSaveContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: Content | Omit<Content, "id" | "createdAt" | "updatedAt" | "archivedAt" | "sortOrder" | "version" | "contentVersion">) => contentRepository.saveContent(content),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["contents"] }); void queryClient.invalidateQueries({ queryKey: workspaceKey }); },
  });
}
