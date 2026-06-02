"use client";

import {
  createContext, useCallback, useContext, useEffect, useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabaseConfigured, createClient } from "./supabase/client";
import {
  Profile, GUEST_PROFILE,
  hasCompletedOnboarding, setOnboardingComplete,
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
  user: User | null;
  authLoading: boolean;
  needsOnboarding: boolean;
  loginModalOpen: boolean;
  openLogin: () => void;
  closeLogin: () => void;
  completeOnboarding: () => void;
  signOut: () => Promise<void>;
}

const ProfilesContext = createContext<ProfilesContextValue>({
  active: GUEST_PROFILE,
  user: null,
  authLoading: true,
  needsOnboarding: false,
  loginModalOpen: false,
  openLogin: () => {},
  closeLogin: () => {},
  completeOnboarding: () => {},
  signOut: async () => {},
});

export function ProfilesProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [supabaseProfile, setSupabaseProfile] = useState<DbProfile | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  useEffect(() => {
    // Show onboarding if user has never made a choice
    if (!hasCompletedOnboarding()) setNeedsOnboarding(true);

    if (!supabaseConfigured) {
      setAuthLoading(false);
      return;
    }

    const supabase = createClient();

    // ── Client-side 1-day inactivity logout (free-tier workaround) ──────────
    const INACTIVITY_KEY = "vk_last_active";
    const ONE_DAY_MS = 86_400_000;
    const lastActive = Number(localStorage.getItem(INACTIVITY_KEY) ?? 0);

    if (lastActive > 0 && Date.now() - lastActive > ONE_DAY_MS) {
      supabase.auth.signOut().finally(() => localStorage.removeItem(INACTIVITY_KEY));
    } else {
      localStorage.setItem(INACTIVITY_KEY, String(Date.now()));
    }

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
          // Auto-complete onboarding when user signs in
          setNeedsOnboarding(false);
          setOnboardingComplete();
        } else {
          setSupabaseProfile(null);
        }
        setAuthLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Logged-in → Supabase profile; otherwise → Guest
  const active: Profile = user && supabaseProfile
    ? {
        id: user.id,
        name: supabaseProfile.name,
        initials: supabaseProfile.initials,
        color: supabaseProfile.color,
        isGuest: false,
        createdAt: supabaseProfile.created_at,
      }
    : GUEST_PROFILE;

  const completeOnboarding = useCallback(() => {
    setNeedsOnboarding(false);
    setOnboardingComplete();
  }, []);

  const signOut = useCallback(async () => {
    if (!supabaseConfigured) return;
    await createClient().auth.signOut();
  }, []);

  return (
    <ProfilesContext.Provider value={{
      active,
      user,
      authLoading,
      needsOnboarding: needsOnboarding && !user,
      loginModalOpen,
      openLogin: () => setLoginModalOpen(true),
      closeLogin: () => setLoginModalOpen(false),
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
