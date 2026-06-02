"use client";

import { useState } from "react";
import { UserPlus, Zap } from "lucide-react";
import { AVATAR_COLORS, getInitials } from "@/lib/profiles";
import { useProfiles } from "@/lib/profiles-context";

export function OnboardingModal() {
  const { addProfile, switchProfile, completeOnboarding } = useProfiles();
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(AVATAR_COLORS[0]);
  const [error, setError] = useState("");

  const initials = name.trim() ? getInitials(name) : "?";

  const handleCreate = () => {
    if (!name.trim()) { setError("Please enter your name."); return; }
    const profile = addProfile(name.trim(), color);
    switchProfile(profile.id);
    completeOnboarding();
  };

  const handleGuest = () => {
    switchProfile("guest");
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
        <p className="ob-sub">Your personal developer toolkit. Set up a profile to get started.</p>

        {/* Avatar preview */}
        <div className="ob-avatar-preview" style={{ background: color }}>
          {initials}
        </div>

        {/* Name input */}
        <div className="ob-field-group">
          <label className="ob-label" htmlFor="ob-name">Your name</label>
          <input
            id="ob-name"
            className="ob-input"
            placeholder="e.g. Jordan Kessler"
            value={name}
            autoFocus
            onChange={(e) => { setName(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          {error && <span className="ob-error">{error}</span>}
        </div>

        {/* Color picker */}
        <div className="ob-field-group">
          <label className="ob-label">Avatar color</label>
          <div className="ob-color-row">
            {AVATAR_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`ob-color-swatch${color === c ? " selected" : ""}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>

        {/* CTA */}
        <button className="btn btn-primary ob-cta" onClick={handleCreate} type="button">
          <UserPlus size={16} /> Get started
        </button>

        <div className="ob-divider"><span>or</span></div>

        <button className="ob-guest-btn" onClick={handleGuest} type="button">
          <Zap size={14} /> Continue as Guest
        </button>
      </div>
    </div>
  );
}
