import type { SafeUser } from "@shared/types/auth";
import type { MarketingRole, UserProfile } from "@shared/types/domain";
import { MARKETING_ROLE_LABELS } from "@shared/constants/defaults";
import { contentRepository } from "./content-repository";

const ONLINE_WINDOW_MS = 2 * 60_000;
const REFRESH_THROTTLE_MS = 60_000;

export function findProfile(profiles: UserProfile[] | undefined, userId: string | undefined): UserProfile | null {
  if (!profiles || !userId) return null;
  return profiles.find((item) => item.userId === userId) ?? null;
}

export function isProfileOnline(profile: Pick<UserProfile, "lastSeenAt"> | null | undefined): boolean {
  if (!profile?.lastSeenAt) return false;
  return Date.now() - new Date(profile.lastSeenAt).getTime() < ONLINE_WINDOW_MS;
}

export function marketingRoleLabel(role: MarketingRole | null | undefined): string {
  return role ? MARKETING_ROLE_LABELS[role] : "بدون نقش شغلی";
}

function displayNameFor(user: SafeUser): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

export async function ensureProfile(user: SafeUser, profiles: UserProfile[]): Promise<UserProfile> {
  const existing = findProfile(profiles, user.id);
  const displayName = displayNameFor(user);
  if (existing) {
    const fresh = Date.now() - new Date(existing.lastSeenAt).getTime() < REFRESH_THROTTLE_MS;
    if (fresh && existing.displayName === displayName) return existing;
    return contentRepository.saveProfile({ ...existing, displayName, lastSeenAt: new Date().toISOString() });
  }
  const now = new Date().toISOString();
  return contentRepository.saveProfile({
    id: user.id, userId: user.id, displayName, avatarUrl: user.avatarUrl ?? null,
    jobRole: null, lastSeenAt: now, createdAt: now, updatedAt: now,
  });
}

export async function touchProfile(profile: UserProfile): Promise<UserProfile> {
  return contentRepository.saveProfile({ ...profile, lastSeenAt: new Date().toISOString() });
}

export async function logActivity(user: SafeUser, profile: UserProfile | null, action: string, entityType: string, entityId: string, entityLabel: string): Promise<void> {
  await contentRepository.logActivity({
    actorUserId: user.id, actorName: displayNameFor(user), actorRole: profile?.jobRole ?? null,
    action, entityType, entityId, entityLabel,
  });
}
