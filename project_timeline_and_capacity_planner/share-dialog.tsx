"use client";

import { useEffect, useState, useCallback, type CSSProperties } from "react";
import { Link2, Copy, Check, Trash2, X, Users } from "lucide-react";
import { Button } from "./ui/button";
import { BoardShare, BoardMember, SharePermission } from "./types";
import {
  fetchBoardShares, createBoardShare, revokeBoardShare,
  fetchBoardMembers, removeBoardMember, fetchProfilesByIds, type MemberProfile,
} from "./queries";

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  ownerId: string;
}

const iconBtnStyle: CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  width: 24, height: 24, borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border-subtle)", background: "var(--surface-1)",
  cursor: "pointer", color: "inherit", flexShrink: 0,
};

const sectionLabelStyle: CSSProperties = {
  fontSize: 11, fontWeight: 600, marginBottom: 8, color: "var(--fg-1)",
  display: "flex", alignItems: "center", gap: 6,
};

const rowStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 8,
  padding: "8px 10px", border: "1px solid var(--border-subtle)",
  borderRadius: "var(--radius-sm)",
};

export function ShareDialog({ open, onClose, ownerId }: ShareDialogProps) {
  const [shares, setShares] = useState<BoardShare[]>([]);
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [profiles, setProfiles] = useState<Record<string, MemberProfile>>({});
  const [loading, setLoading] = useState(false);
  const [permission, setPermission] = useState<SharePermission>("view");
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [s, m] = await Promise.all([fetchBoardShares(ownerId), fetchBoardMembers(ownerId)]);
      setShares(s);
      setMembers(m);
      const ids = Array.from(new Set(m.map((x) => x.member_id)));
      if (ids.length > 0) {
        const p = await fetchProfilesByIds(ids);
        setProfiles(Object.fromEntries(p.map((pr) => [pr.id, pr])));
      } else {
        setProfiles({});
      }
    } catch (e) {
      console.error("share dialog load failed", e);
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    if (open) {
      setError(null);
      reload();
    }
  }, [open, reload]);

  if (!open) return null;

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const share = await createBoardShare(ownerId, permission);
      setShares((prev) => [share, ...prev]);
    } catch (e) {
      setError("Couldn't generate link — try again.");
      console.error("createBoardShare failed", e);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async (share: BoardShare) => {
    const url = `${window.location.origin}/shared/${share.token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(share.id);
      setTimeout(() => setCopiedId((id) => (id === share.id ? null : id)), 2000);
    } catch (e) {
      console.error("clipboard write failed", e);
    }
  };

  const handleRevoke = async (id: string) => {
    const prev = shares;
    setShares(shares.filter((s) => s.id !== id));
    try {
      await revokeBoardShare(id);
    } catch (e) {
      setShares(prev);
      console.error("revokeBoardShare failed", e);
    }
  };

  const handleRemoveMember = async (id: string) => {
    const prev = members;
    setMembers(members.filter((m) => m.id !== id));
    try {
      await removeBoardMember(id);
    } catch (e) {
      setMembers(prev);
      console.error("removeBoardMember failed", e);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(20,20,24,.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 460, maxWidth: "calc(100vw - 32px)", maxHeight: "calc(100vh - 64px)",
          overflowY: "auto",
          background: "var(--surface-1)", border: "1px solid var(--border-strong)",
          borderRadius: "var(--radius-md)", boxShadow: "0 12px 40px rgba(0,0,0,.25)",
          fontFamily: "var(--font-mono)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
          <Link2 size={15} />
          <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>Share this board</div>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--fg-1)", display: "flex" }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Generate link */}
          <div>
            <div style={sectionLabelStyle}>Generate a new link</div>
            <div style={{ display: "flex", gap: 8 }}>
              <select
                value={permission}
                onChange={(e) => setPermission(e.target.value as SharePermission)}
                style={{
                  flex: 1, fontFamily: "var(--font-mono)", fontSize: 11.5,
                  padding: "6px 8px", borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-subtle)", background: "var(--surface-3)", color: "inherit",
                }}
              >
                <option value="view">Can view</option>
                <option value="edit">Can edit</option>
              </select>
              <Button variant="primary" size="sm" onClick={handleGenerate} disabled={generating}>
                {generating ? "Generating…" : "Generate link"}
              </Button>
            </div>
            <div style={{ fontSize: 10.5, color: "var(--fg-2)", marginTop: 6 }}>
              Anyone with the link must sign in to access your board.
            </div>
            {error && <div style={{ fontSize: 10.5, color: "var(--danger-text)", marginTop: 6 }}>{error}</div>}
          </div>

          {/* Active links */}
          <div>
            <div style={sectionLabelStyle}>Active links</div>
            {loading ? (
              <div style={{ fontSize: 11, color: "var(--fg-2)" }}>Loading…</div>
            ) : shares.length === 0 ? (
              <div style={{ fontSize: 11, color: "var(--fg-2)" }}>No active links yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {shares.map((share) => (
                  <div key={share.id} style={{ ...rowStyle, background: "var(--surface-3)" }}>
                    <span style={{
                      fontSize: 10, padding: "2px 6px", borderRadius: "var(--radius-full)",
                      border: "1px solid var(--accent-border)", background: "var(--accent-muted)", color: "var(--accent-text)",
                      textTransform: "uppercase", letterSpacing: ".03em", flexShrink: 0,
                    }}>
                      {share.permission === "edit" ? "Can edit" : "Can view"}
                    </span>
                    <span style={{ flex: 1, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--fg-2)" }}>
                      …/shared/{share.token.slice(0, 10)}…
                    </span>
                    <button type="button" onClick={() => handleCopy(share)} title="Copy link" style={iconBtnStyle}>
                      {copiedId === share.id ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                    <button type="button" onClick={() => handleRevoke(share.id)} title="Revoke link" style={{ ...iconBtnStyle, color: "var(--danger-text)" }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Members */}
          <div>
            <div style={sectionLabelStyle}><Users size={12} /> People with access</div>
            {loading ? (
              <div style={{ fontSize: 11, color: "var(--fg-2)" }}>Loading…</div>
            ) : members.length === 0 ? (
              <div style={{ fontSize: 11, color: "var(--fg-2)" }}>Nobody has joined your board yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {members.map((member) => {
                  const profile = profiles[member.member_id];
                  return (
                    <div key={member.id} style={rowStyle}>
                      <div style={{
                        width: 22, height: 22, borderRadius: "var(--radius-full)",
                        background: profile?.color ?? "var(--surface-4)", color: "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 9.5, fontWeight: 700, flexShrink: 0,
                      }}>
                        {profile?.initials ?? "?"}
                      </div>
                      <span style={{ flex: 1, fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {profile?.name ?? "Unknown user"}
                      </span>
                      <span style={{ fontSize: 10, color: "var(--fg-2)" }}>
                        {member.permission === "edit" ? "Can edit" : "Can view"}
                      </span>
                      <button type="button" onClick={() => handleRemoveMember(member.id)} title="Remove access" style={{ ...iconBtnStyle, color: "var(--danger-text)" }}>
                        <X size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
