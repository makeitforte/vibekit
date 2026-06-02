"use client";

import {
  createContext, useCallback, useContext, useEffect, useState,
} from "react";
import {
  Profile, GUEST_PROFILE,
  loadProfiles, saveProfiles, createProfile, deleteProfile,
  getActiveProfile, setActiveProfileId,
  hasCreatedProfiles,
} from "./profiles";

interface ProfilesContextValue {
  active: Profile;
  profiles: Profile[];           // non-guest profiles only
  needsOnboarding: boolean;      // true on first ever visit
  switchProfile: (id: string) => void;
  addProfile: (name: string, color: string) => Profile;
  removeProfile: (id: string) => void;
  completeOnboarding: () => void;
}

const ProfilesContext = createContext<ProfilesContextValue>({
  active: GUEST_PROFILE,
  profiles: [],
  needsOnboarding: false,
  switchProfile: () => {},
  addProfile: () => GUEST_PROFILE,
  removeProfile: () => {},
  completeOnboarding: () => {},
});

export function ProfilesProvider({ children }: { children: React.ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [active, setActive] = useState<Profile>(GUEST_PROFILE);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  // Hydrate from localStorage on mount (client-only)
  useEffect(() => {
    const stored = loadProfiles();
    setProfiles(stored);
    setActive(getActiveProfile());
    // Show onboarding only on very first visit (no profiles ever created)
    if (!hasCreatedProfiles()) setNeedsOnboarding(true);
  }, []);

  const switchProfile = useCallback((id: string) => {
    setActiveProfileId(id);
    if (id === GUEST_PROFILE.id) {
      setActive(GUEST_PROFILE);
    } else {
      const found = loadProfiles().find((p) => p.id === id);
      if (found) setActive(found);
    }
  }, []);

  const addProfile = useCallback((name: string, color: string): Profile => {
    const profile = createProfile(name, color);
    setProfiles(loadProfiles());
    return profile;
  }, []);

  const removeProfile = useCallback((id: string) => {
    deleteProfile(id);
    const remaining = loadProfiles();
    setProfiles(remaining);
    // If deleted the active, fall back to first remaining or guest
    if (active.id === id) {
      const next = remaining[0] ?? GUEST_PROFILE;
      setActiveProfileId(next.id);
      setActive(next);
    }
  }, [active]);

  const completeOnboarding = useCallback(() => {
    setNeedsOnboarding(false);
  }, []);

  return (
    <ProfilesContext.Provider value={{
      active, profiles, needsOnboarding,
      switchProfile, addProfile, removeProfile, completeOnboarding,
    }}>
      {children}
    </ProfilesContext.Provider>
  );
}

export function useProfiles() {
  return useContext(ProfilesContext);
}
