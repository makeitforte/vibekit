"use client";

import {
  createContext, useCallback, useContext, useEffect, useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabaseConfigured, createClient } from "./supabase/client";
import {
  Profile, GUEST_PROFILE,
  loadProfiles, createProfile, deleteProfile,
  getActiveProfile, setActiveProfileId,
  hasCreatedProfiles,
} from "./profiles";

interface DbProfile {
  id: string;
  name: string;
  initials: string;
  color: string;
  created_at: string;
}

interface ProfilesContextValue {
  active: Profile;
  localProfiles: Profile[];
  user: User | null;
  authLoading: boolean;
  needsOnboarding: boolean;
  loginModalOpen: boolean;
  openLogin: () => void;
  closeLogin: () => void;
  switchLocalProfile: (id: string) => void;
  addLocalProfile: (name: string, color: string) => Profile;
  removeLocalProfile: (id: string) => void;
  completeOnboarding: () => void;
  signOut: () => Promise<void>;
}

const ProfilesContext = createContext<ProfilesContextValue>({
  active: GUEST_PROFILE,
  localProfiles: [],
  user: null,
  authLoading: true,
  needsOnboarding: false,
  loginModalOpen: false,
  openLogin: () => {},
  closeLogin: () => {},
  switchLocalProfile: () => {},
  addLocalProfile: () => GUEST_PROFILE,
  removeLocalProfile: () => {},
  completeOnboarding: () => {},
  signOut: async () => {},
});

export function ProfilesProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [supabaseProfile, setSupabaseProfile] = useState<DbProfile | null>(null);
  const [localProfiles, setLocalProfiles] = useState<Profile[]>([]);
  const [localActive, setLocalActive] = useState<Profile>(GUEST_PROFILE);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  // ── Hydrate client-side only (useEffect = never runs on server) ────────────
  useEffect(() => {
    // Local profiles (always)
    setLocalProfiles(loadProfiles());
    setLocalActive(getActiveProfile());
    if (!hasCreatedProfiles()) setNeedsOnboarding(true);

    // Supabase auth (only if configured)
    if (!supabaseConfigured) {
      setAuthLoading(false);
      return;
    }

    const supabase = createClient();

    const fetchProfile = async (uid: string) => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", uid)
        .single();
      if (data) setSupabaseProfile(data as DbProfile);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) fetchProfile(u.id);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const u = session?.user ?? null;
        setUser(u);
        if (u) {
          fetchProfile(u.id);
          setNeedsOnboarding(false);
        } else {
          setSupabaseProfile(null);
        }
        setAuthLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived active profile ─────────────────────────────────────────────────
  const active: Profile = user && supabaseProfile
    ? {
        id: user.id,
        name: supabaseProfile.name,
        initials: supabaseProfile.initials,
        color: supabaseProfile.color,
        isGuest: false,
        createdAt: supabaseProfile.created_at,
      }
    : localActive;

  // ── Local profile actions ──────────────────────────────────────────────────
  const switchLocalProfile = useCallback((id: string) => {
    setActiveProfileId(id);
    if (id === GUEST_PROFILE.id) {
      setLocalActive(GUEST_PROFILE);
    } else {
      const found = loadProfiles().find((p) => p.id === id);
      if (found) setLocalActive(found);
    }
  }, []);

  const addLocalProfile = useCallback((name: string, color: string): Profile => {
    const profile = createProfile(name, color);
    setLocalProfiles(loadProfiles());
    return profile;
  }, []);

  const removeLocalProfile = useCallback((id: string) => {
    deleteProfile(id);
    const remaining = loadProfiles();
    setLocalProfiles(remaining);
    if (localActive.id === id) {
      const next = remaining[0] ?? GUEST_PROFILE;
      setActiveProfileId(next.id);
      setLocalActive(next);
    }
  }, [localActive]);

  const completeOnboarding = useCallback(() => setNeedsOnboarding(false), []);

  // ── Auth actions ───────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    if (!supabaseConfigured) return;
    const supabase = createClient();
    await supabase.auth.signOut();
  }, []);

  return (
    <ProfilesContext.Provider value={{
      active,
      localProfiles,
      user,
      authLoading,
      needsOnboarding: needsOnboarding && !user,
      loginModalOpen,
      openLogin: () => setLoginModalOpen(true),
      closeLogin: () => setLoginModalOpen(false),
      switchLocalProfile,
      addLocalProfile,
      removeLocalProfile,
      completeOnboarding,
      signOut,
    }}>
      {children}
    </ProfilesContext.Provider>
  );
}

export function useProfiles() {
  return useContext(ProfilesContext);
}
