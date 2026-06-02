"use client";

import { LogIn, Zap } from "lucide-react";
import { useProfiles } from "@/lib/profiles-context";

export function OnboardingModal() {
  const { openLogin, completeOnboarding } = useProfiles();

  const handleSignIn = () => {
    completeOnboarding();
    openLogin();
  };

  const handleGuest = () => {
    completeOnboarding();
  };

  return (
    <div className="ob-scrim">
      <div className="ob-card">
        {/* Brand */}
        <div className="ob-brand">
          <div className="ob-logo">
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none">
              <path d="M3 7l4-4 3 3 3-3 4 4M3 13l4 4 3-3 3 3 4-4"
                stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="ob-brand-name">VibeKit</span>
        </div>

        <h1 className="ob-title">Welcome to VibeKit</h1>
        <p className="ob-sub">
          Your personal developer toolkit. Sign in to save your preferences and history across devices.
        </p>

        <button className="btn btn-primary ob-cta" onClick={handleSignIn} type="button">
          <LogIn size={16} /> Sign in
        </button>

        <div className="ob-divider"><span>or</span></div>

        <button className="ob-alt-btn" onClick={handleGuest} type="button">
          <Zap size={14} />
          Continue as Guest
        </button>
      </div>
    </div>
  );
}
