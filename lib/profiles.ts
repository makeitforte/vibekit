// Profile system — localStorage-backed, no server required.

export interface Profile {
  id: string;
  name: string;
  initials: string;
  color: string;
  isGuest: boolean;
  createdAt: string;
}

export const AVATAR_COLORS = [
  "#16a268", // green (brand accent)
  "#7c3aed", // purple
  "#2a6fdb", // blue
  "#e2834a", // orange
  "#e2438c", // pink
  "#0d9488", // teal
] as const;

export const GUEST_PROFILE: Profile = {
  id: "guest",
  name: "Guest",
  initials: "G",
  color: "#a6a6ae",
  isGuest: true,
  createdAt: new Date(0).toISOString(),
};

const STORAGE_KEY = "vk_profiles";
const ACTIVE_KEY  = "vk_active_profile_id";

export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export function loadProfiles(): Profile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Profile[]) : [];
  } catch {
    return [];
  }
}

export function saveProfiles(profiles: Profile[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

export function createProfile(name: string, color: string): Profile {
  const profile: Profile = {
    id: crypto.randomUUID(),
    name: name.trim(),
    initials: getInitials(name),
    color,
    isGuest: false,
    createdAt: new Date().toISOString(),
  };
  const existing = loadProfiles();
  saveProfiles([...existing, profile]);
  return profile;
}

export function deleteProfile(id: string): void {
  const profiles = loadProfiles().filter((p) => p.id !== id);
  saveProfiles(profiles);
}

// ── Active profile ────────────────────────────────────────────────────────────

export function getActiveProfileId(): string {
  if (typeof window === "undefined") return GUEST_PROFILE.id;
  return localStorage.getItem(ACTIVE_KEY) ?? GUEST_PROFILE.id;
}

export function setActiveProfileId(id: string): void {
  localStorage.setItem(ACTIVE_KEY, id);
}

export function getActiveProfile(): Profile {
  const id = getActiveProfileId();
  if (id === GUEST_PROFILE.id) return GUEST_PROFILE;
  const profiles = loadProfiles();
  return profiles.find((p) => p.id === id) ?? GUEST_PROFILE;
}

// True if user has ever created at least one non-guest profile
export function hasCreatedProfiles(): boolean {
  return loadProfiles().length > 0;
}
