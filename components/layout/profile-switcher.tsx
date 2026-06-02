"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";
import { AVATAR_COLORS, GUEST_PROFILE, getInitials } from "@/lib/profiles";
import { useProfiles } from "@/lib/profiles-context";

export function ProfileSwitcher() {
  const { active, profiles, switchProfile, addProfile, removeProfile } = useProfiles();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(AVATAR_COLORS[0]);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleCreate = () => {
    if (!newName.trim()) return;
    const profile = addProfile(newName.trim(), newColor);
    switchProfile(profile.id);
    setCreating(false);
    setNewName("");
    setNewColor(AVATAR_COLORS[0]);
    setOpen(false);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    // Must keep at least 1 profile if any exist
    if (profiles.length <= 1 && id !== GUEST_PROFILE.id) return;
    removeProfile(id);
  };

  const canDelete = (id: string) =>
    id !== GUEST_PROFILE.id && !(profiles.length === 1 && active.id === id);

  return (
    <div ref={ref} className="ps-wrap">
      {/* Trigger: the sidebar footer row */}
      <button className="ps-trigger" onClick={() => { setOpen((o) => !o); setCreating(false); }} type="button">
        <div className="avatar" style={{ background: active.color }}>{active.initials}</div>
        <div className="min-w-0">
          <div className="footer-name">{active.name}</div>
          <div className="footer-plan">{active.isGuest ? "Guest" : "Free plan"}</div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ color: "var(--fg-4)", flexShrink: 0, transition: "transform 120ms",
                   transform: open ? "rotate(180deg)" : "none" }}>
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>

      {/* Popover */}
      {open && (
        <div className="ps-popover">
          <div className="ps-popover-header">
            <span>Profiles</span>
            <button className="icon-btn" style={{ width: 26, height: 26 }}
              onClick={() => setOpen(false)} type="button">
              <X size={14} />
            </button>
          </div>

          <div className="ps-list">
            {/* Guest */}
            <button
              className={`ps-item${active.id === GUEST_PROFILE.id ? " active" : ""}`}
              onClick={() => { switchProfile(GUEST_PROFILE.id); setOpen(false); }}
              type="button"
            >
              <div className="ps-avatar" style={{ background: GUEST_PROFILE.color }}>
                {GUEST_PROFILE.initials}
              </div>
              <span className="ps-name">{GUEST_PROFILE.name}</span>
              {active.id === GUEST_PROFILE.id && <Check size={14} className="ps-check" />}
            </button>

            {/* Named profiles */}
            {profiles.map((p) => (
              <button
                key={p.id}
                className={`ps-item${active.id === p.id ? " active" : ""}`}
                onClick={() => { switchProfile(p.id); setOpen(false); }}
                type="button"
              >
                <div className="ps-avatar" style={{ background: p.color }}>{p.initials}</div>
                <span className="ps-name">{p.name}</span>
                {active.id === p.id && <Check size={14} className="ps-check" />}
                {canDelete(p.id) && (
                  <span
                    className="ps-delete"
                    role="button"
                    tabIndex={0}
                    title="Delete profile"
                    onClick={(e) => handleDelete(e, p.id)}
                    onKeyDown={(e) => e.key === "Enter" && handleDelete(e as unknown as React.MouseEvent, p.id)}
                  >
                    <Trash2 size={12} />
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Create new */}
          {!creating ? (
            <button className="ps-new-btn" onClick={() => setCreating(true)} type="button">
              <Plus size={14} /> New profile
            </button>
          ) : (
            <div className="ps-create-form">
              <input
                className="ps-create-input"
                placeholder="Your name"
                value={newName}
                autoFocus
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreating(false); }}
              />
              <div className="ps-color-row">
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`ps-color-dot${newColor === c ? " selected" : ""}`}
                    style={{ background: c }}
                    onClick={() => setNewColor(c)}
                  />
                ))}
              </div>
              <div className="ps-create-actions">
                <button className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 12 }}
                  onClick={() => setCreating(false)} type="button">Cancel</button>
                <button className="btn btn-primary" style={{ padding: "6px 12px", fontSize: 12 }}
                  onClick={handleCreate} type="button">Create</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
