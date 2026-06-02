export interface Profile {
  id: string;
  name: string;
  initials: string;
  color: string;
  isGuest: boolean;
  createdAt: string;
}

export const GUEST_PROFILE: Profile = {
  id: "guest",
  name: "Guest",
  initials: "G",
  color: "#a6a6ae",
  isGuest: true,
  createdAt: new Date(0).toISOString(),
};

export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// ── Onboarding flag ───────────────────────────────────────────────────────────
// Tracks whether the user has dismissed the welcome screen (chose Sign in OR Guest).
// No local profile creation — only Supabase auth or Guest.

export function hasCompletedOnboarding(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("vk_onboarded") === "true";
}

export function setOnboardingComplete(): void {
  localStorage.setItem("vk_onboarded", "true");
}
