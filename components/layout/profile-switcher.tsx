"use client";

import { useEffect, useRef, useState } from "react";
import { Check, X, LogIn, LogOut } from "lucide-react";
import { GUEST_PROFILE } from "@/lib/profiles";
import { useProfiles } from "@/lib/profiles-context";

export function ProfileSwitcher() {
  const { active, user, openLogin, signOut } = useProfiles();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
  };

  // ── Logged-in view ─────────────────────────────────────────────────────────
  if (user) {
    return (
      <div ref={ref} className="ps-wrap">
        <button className="ps-trigger" onClick={() => setOpen(o => !o)} type="button">
          <div className="avatar" style={{ background: active.color }}>{active.initials}</div>
          <div className="min-w-0">
            <div className="footer-name">{active.name}</div>
            <div className="footer-plan" style={{ color: "var(--accent-text)" }}>Signed in</div>
          </div>
          <ChevronIcon open={open} />
        </button>

        {open && (
          <div className="ps-popover">
            <div className="ps-popover-header">
              <span>Account</span>
              <button className="icon-btn" style={{ width: 26, height: 26 }}
                onClick={() => setOpen(false)} type="button"><X size={14} /></button>
            </div>
            <div className="ps-list">
              <div className="ps-item active" style={{ cursor: "default" }}>
                <div className="ps-avatar" style={{ background: active.color }}>{active.initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="ps-name">{active.name}</div>
                  <div style={{ fontSize: 11, color: "var(--fg-4)", fontFamily: "var(--font-mono)" }}>
                    {user.email}
                  </div>
                </div>
                <Check size={14} className="ps-check" />
              </div>
            </div>
            <button className="ps-new-btn" style={{ color: "var(--danger-text)" }}
              onClick={handleSignOut} type="button">
              <LogOut size={14} /> Sign out
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Guest view ─────────────────────────────────────────────────────────────
  return (
    <div ref={ref} className="ps-wrap">
      <button className="ps-trigger" onClick={() => setOpen(o => !o)} type="button">
        <div className="avatar" style={{ background: GUEST_PROFILE.color }}>{GUEST_PROFILE.initials}</div>
        <div className="min-w-0">
          <div className="footer-name">Guest</div>
          <div className="footer-plan">Not signed in</div>
        </div>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div className="ps-popover">
          <div className="ps-popover-header">
            <span>Account</span>
            <button className="icon-btn" style={{ width: 26, height: 26 }}
              onClick={() => setOpen(false)} type="button"><X size={14} /></button>
          </div>
          <div className="ps-list">
            <div className="ps-item active" style={{ cursor: "default" }}>
              <div className="ps-avatar" style={{ background: GUEST_PROFILE.color }}>G</div>
              <span className="ps-name">Guest</span>
              <Check size={14} className="ps-check" />
            </div>
          </div>
          <button
            className="ps-signin-cta"
            onClick={() => { setOpen(false); openLogin(); }}
            type="button"
          >
            <LogIn size={14} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 12 }}>Sign in to VibeKit</div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>Sync preferences across devices</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ color: "var(--fg-4)", flexShrink: 0, transition: "transform 120ms",
               transform: open ? "rotate(180deg)" : "none" }}>
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}
