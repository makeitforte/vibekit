"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Trash2, ExternalLink, FileText, Link2 } from "lucide-react";
import { Task, Role, ChangeHistory } from "./types";
import { fetchTaskHistory, fetchProfilesByIds, MemberProfile } from "./queries";

type TabKey = "details" | "changes" | "mandays";

interface Props {
  task: Task;
  boardOwnerId: string;
  roles: Role[];
  /** Which tab to open on first render (right-click "Task details" → details, "View history" → changes). */
  initialTab?: TabKey;
  /** Persists notes/links edits. Wired to the shell's handleUpdateTask via the grid. */
  onUpdateTask: (id: string, patch: Partial<Pick<Task, "notes" | "links">>) => void;
  onClose: () => void;
}

const CHANGE_TYPE_LABEL: Record<string, string> = {
  mandays_change:  "Mandays changed",
  status_change:   "Status changed",
  eta_change:      "ETA changed",
  task_created:    "Task created",
  task_deleted:    "Task deleted",
  priority_change: "Priority changed",
  cascade_push:    "Cascade push",
};

// ── Link parsing ──────────────────────────────────────────────────────────────
// Raw URLs are stored as-is (no schema change); type + label are derived for display.

type LinkKind = "jira" | "prd" | "other";

interface LinkMeta { kind: LinkKind; label: string; color: string; }

const LINK_COLORS: Record<LinkKind, string> = {
  jira:  "#2684ff", // Atlassian blue
  prd:   "#8b5cf6", // purple
  other: "#64748b", // slate
};

function parseLink(url: string): LinkMeta {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    // JIRA — only extract an issue key when the host actually looks like JIRA,
    // so a generic "ABC-123" elsewhere in the URL doesn't get mislabelled.
    if (host.includes("atlassian.net") || host.includes("jira")) {
      const m = url.match(/\/browse\/([A-Z][A-Z0-9]+-\d+)/) || url.match(/([A-Z][A-Z0-9]+-\d+)/);
      return { kind: "jira", label: m ? m[1] : "JIRA", color: LINK_COLORS.jira };
    }
    if (host.includes("docs.google") || host.includes("confluence") || host.includes("notion")) {
      return { kind: "prd", label: "PRD", color: LINK_COLORS.prd };
    }
    return { kind: "other", label: host, color: LINK_COLORS.other };
  } catch {
    return { kind: "other", label: url, color: LINK_COLORS.other };
  }
}

/** Adds https:// when the user pastes a bare host; returns "" if clearly not a URL. */
function normalizeUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

export function TaskDetailsModal({ task, boardOwnerId, roles, initialTab = "details", onUpdateTask, onClose }: Props) {
  const [tab, setTab]       = useState<TabKey>(initialTab);
  const [history, setHistory] = useState<ChangeHistory[]>([]);
  const [profiles, setProfiles] = useState<Record<string, MemberProfile>>({});
  const [loading, setLoading] = useState(true);

  // ── Editable details (auto-saved) ──
  const [notes, setNotes] = useState(task.notes ?? "");
  const [links, setLinks] = useState<string[]>(task.links ?? []);
  const [linkInput, setLinkInput] = useState("");

  useEffect(() => {
    setLoading(true);
    fetchTaskHistory(boardOwnerId, task.id).then(async (hist) => {
      setHistory(hist);
      const userIds = [...new Set(hist.map(h => h.user_id))];
      const profs = await fetchProfilesByIds(userIds);
      const map: Record<string, MemberProfile> = {};
      for (const p of profs) map[p.id] = p;
      setProfiles(map);
      setLoading(false);
    });
  }, [task.id, boardOwnerId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const saveNotes = () => {
    const v = notes.trim();
    if (v === (task.notes ?? "").trim()) return;
    onUpdateTask(task.id, { notes: v || null });
  };

  const addLink = () => {
    const url = normalizeUrl(linkInput);
    if (!url) return;
    if (links.includes(url)) { setLinkInput(""); return; }
    const next = [...links, url];
    setLinks(next);
    setLinkInput("");
    onUpdateTask(task.id, { links: next });
  };

  const removeLink = (url: string) => {
    const next = links.filter(l => l !== url);
    setLinks(next);
    onUpdateTask(task.id, { links: next });
  };

  const actorName = (userId: string) => profiles[userId]?.name ?? "Unknown";

  // Mandays-only events
  const mandayEvents = history.filter(h => h.change_type === "mandays_change");

  // Group by role name for the summary tab
  // field_name format: "BE · Jun 9–13, 2026"
  type MdEvent = { week: string; oldVal: number; newVal: number; delta: number; when: string; who: string };
  const roleGroups: Record<string, MdEvent[]> = {};
  for (const ev of mandayEvents) {
    const parts    = (ev.field_name ?? "").split(" · ");
    const roleName = parts[0] ?? "Unknown role";
    const week     = parts[1] ?? "";
    const oldVal   = parseFloat(ev.old_value ?? "0") || 0;
    const newVal   = parseFloat(ev.new_value ?? "0") || 0;
    if (!roleGroups[roleName]) roleGroups[roleName] = [];
    roleGroups[roleName].push({ week, oldVal, newVal, delta: newVal - oldVal, when: ev.created_at, who: actorName(ev.user_id) });
  }

  const grandTotal = Object.values(roleGroups).reduce(
    (sum, evs) => sum + evs.reduce((s, e) => s + e.delta, 0), 0,
  );

  const deltaColor = (n: number) =>
    n > 0 ? "#16a268" : n < 0 ? "var(--danger-text)" : "var(--fg-4)";

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--surface-1)", border: "1px solid var(--border-strong)",
        borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-xl)",
        width: 700, maxWidth: "calc(100vw - 32px)", maxHeight: "80vh",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>

        {/* ── Header ── */}
        <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--fg-4)", marginBottom: 3 }}>Task Details</div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--fg-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.name}</div>
          </div>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--fg-4)", padding: 2, flexShrink: 0, marginTop: 2 }}>
            <X size={15} />
          </button>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border-subtle)", padding: "0 18px" }}>
          {(["details", "changes", "mandays"] as const).map(t => (
            <button key={t} type="button" onClick={() => setTab(t)} style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "8px 14px",
              fontFamily: "var(--font-mono)", fontSize: 11,
              fontWeight: tab === t ? 600 : 400,
              color: tab === t ? "var(--fg-1)" : "var(--fg-4)",
              borderBottom: tab === t ? "2px solid var(--accent-text)" : "2px solid transparent",
              marginBottom: -1,
            }}>
              {t === "details" ? "Details" : t === "changes" ? "Changes" : "Mandays Summary"}
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
          {tab === "details" ? (

            /* ── Details tab — notes + attached links ── */
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              {/* Notes */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                  <FileText size={13} color="var(--fg-4)" />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--fg-4)" }}>Notes</span>
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={saveNotes}
                  placeholder="Add context, decisions, or anything worth remembering about this task…"
                  rows={5}
                  style={{
                    width: "100%", resize: "vertical", minHeight: 90,
                    background: "var(--surface-2)", border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-md)", padding: "10px 12px",
                    fontSize: 12.5, lineHeight: 1.55, color: "var(--fg-1)",
                    fontFamily: "inherit", outline: "none",
                  }}
                />
              </div>

              {/* Links */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                  <Link2 size={13} color="var(--fg-4)" />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--fg-4)" }}>
                    Links{links.length > 0 ? ` (${links.length})` : ""}
                  </span>
                </div>

                {/* Add-link input */}
                <div style={{ display: "flex", gap: 8, marginBottom: links.length > 0 ? 12 : 0 }}>
                  <input
                    type="text"
                    value={linkInput}
                    onChange={(e) => setLinkInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }}
                    placeholder="Paste a JIRA card or PRD link, press Enter"
                    style={{
                      flex: 1, minWidth: 0,
                      background: "var(--surface-2)", border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-md)", padding: "7px 11px",
                      fontSize: 12, color: "var(--fg-1)", outline: "none",
                      fontFamily: "var(--font-mono)",
                    }}
                  />
                  <button
                    type="button"
                    onClick={addLink}
                    disabled={!linkInput.trim()}
                    style={{
                      padding: "0 14px", borderRadius: "var(--radius-md)",
                      background: linkInput.trim() ? "var(--accent-text)" : "var(--surface-3)",
                      color: linkInput.trim() ? "#fff" : "var(--fg-4)",
                      border: "none", cursor: linkInput.trim() ? "pointer" : "default",
                      fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600,
                    }}
                  >
                    Add
                  </button>
                </div>

                {/* Link list */}
                {links.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {links.map((url) => {
                      const meta = parseLink(url);
                      return (
                        <div key={url} style={{
                          display: "flex", alignItems: "center", gap: 10,
                          background: "var(--surface-2)", border: "1px solid var(--border-subtle)",
                          borderRadius: "var(--radius-md)", padding: "7px 10px",
                        }}>
                          <span style={{
                            flexShrink: 0,
                            fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 700,
                            textTransform: "uppercase", letterSpacing: ".04em",
                            color: meta.color,
                            background: `${meta.color}1a`,
                            border: `1px solid ${meta.color}40`,
                            borderRadius: "var(--radius-full)", padding: "2px 8px",
                          }}>
                            {meta.kind === "jira" ? "JIRA" : meta.kind === "prd" ? "PRD" : "LINK"}
                          </span>
                          <a
                            href={url} target="_blank" rel="noopener noreferrer"
                            title={url}
                            style={{
                              flex: 1, minWidth: 0,
                              fontFamily: "var(--font-mono)", fontSize: 11.5, fontWeight: 600,
                              color: "var(--fg-1)", textDecoration: "none",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              display: "flex", alignItems: "center", gap: 6,
                            }}
                          >
                            {meta.label}
                            <ExternalLink size={11} style={{ flexShrink: 0, color: "var(--fg-4)" }} />
                          </a>
                          <button
                            type="button"
                            onClick={() => removeLink(url)}
                            title="Remove link"
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--fg-4)", padding: 2, flexShrink: 0, display: "inline-flex" }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

          ) : loading ? (
            <div style={{ textAlign: "center", padding: "36px 0", color: "var(--fg-4)", fontFamily: "var(--font-mono)", fontSize: 11 }}>Loading…</div>
          ) : tab === "changes" ? (

            /* ── Changes tab ── */
            history.length === 0 ? (
              <div style={{ textAlign: "center", padding: "36px 0", color: "var(--fg-4)", fontFamily: "var(--font-mono)", fontSize: 11 }}>No history recorded for this task.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    {["When", "Who", "Event", "Detail"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "4px 10px 8px", fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--fg-4)", borderBottom: "1px solid var(--border-subtle)", fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map(ev => (
                    <tr key={ev.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <td style={{ padding: "7px 10px", whiteSpace: "nowrap", color: "var(--fg-4)", fontFamily: "var(--font-mono)", fontSize: 11, verticalAlign: "top" }}>
                        {new Date(ev.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        <div style={{ fontSize: 10, marginTop: 1 }}>
                          {new Date(ev.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </td>
                      <td style={{ padding: "7px 10px", fontWeight: 500, color: "var(--fg-2)", verticalAlign: "top" }}>{actorName(ev.user_id)}</td>
                      <td style={{ padding: "7px 10px", color: "var(--fg-3)", fontFamily: "var(--font-mono)", fontSize: 11, verticalAlign: "top", whiteSpace: "nowrap" }}>
                        {CHANGE_TYPE_LABEL[ev.change_type] ?? ev.change_type}
                      </td>
                      <td style={{ padding: "7px 10px", color: "var(--fg-3)", fontSize: 11.5, verticalAlign: "top" }}>
                        <ChangeDetail ev={ev} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )

          ) : (

            /* ── Mandays Summary tab ── */
            mandayEvents.length === 0 ? (
              <div style={{ textAlign: "center", padding: "36px 0", color: "var(--fg-4)", fontFamily: "var(--font-mono)", fontSize: 11 }}>No mandays changes recorded for this task.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
                {Object.entries(roleGroups).map(([roleName, evs]) => {
                  const roleTotal = evs.reduce((s, e) => s + e.delta, 0);
                  const roleColor = roles.find(r => r.name === roleName)?.color ?? "#a6a6ae";
                  return (
                    <div key={roleName}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: roleColor, flexShrink: 0, display: "inline-block" }} />
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, color: "var(--fg-2)" }}>{roleName}</span>
                        <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: deltaColor(roleTotal) }}>
                          Role total: {roleTotal > 0 ? "+" : ""}{roleTotal} md
                        </span>
                      </div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
                        <thead>
                          <tr>
                            {["Week", "Change", "Delta", "By", "When"].map(h => (
                              <th key={h} style={{ textAlign: "left", padding: "3px 8px 6px", fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--fg-4)", borderBottom: "1px solid var(--border-subtle)", fontWeight: 500 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {evs.map((ev, i) => (
                            <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                              <td style={{ padding: "5px 8px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)" }}>{ev.week}</td>
                              <td style={{ padding: "5px 8px", color: "var(--fg-2)" }}>{ev.oldVal} → <strong>{ev.newVal}</strong></td>
                              <td style={{ padding: "5px 8px", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: deltaColor(ev.delta) }}>
                                {ev.delta > 0 ? "+" : ""}{ev.delta}
                              </td>
                              <td style={{ padding: "5px 8px", color: "var(--fg-3)" }}>{ev.who}</td>
                              <td style={{ padding: "5px 8px", color: "var(--fg-4)", fontFamily: "var(--font-mono)", fontSize: 10.5, whiteSpace: "nowrap" }}>
                                {new Date(ev.when).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}

                {/* Grand total */}
                <div style={{
                  padding: "10px 14px",
                  background: "var(--surface-2)", borderRadius: "var(--radius-md)",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  fontFamily: "var(--font-mono)", fontSize: 12,
                }}>
                  <span style={{ color: "var(--fg-3)", fontWeight: 600 }}>Grand Total</span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: deltaColor(grandTotal) }}>
                    {grandTotal > 0 ? "+" : ""}{grandTotal} mandays
                  </span>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Inline detail renderer ────────────────────────────────────────────────────

function ChangeDetail({ ev }: { ev: ChangeHistory }) {
  switch (ev.change_type) {
    case "mandays_change": {
      const delta = (parseFloat(ev.new_value ?? "0") || 0) - (parseFloat(ev.old_value ?? "0") || 0);
      return (
        <span>
          <span style={{ color: "var(--fg-4)" }}>{ev.field_name}</span>
          {" · "}
          <span style={{ color: "var(--fg-4)" }}>{ev.old_value ?? "0"}</span>
          {" → "}
          <strong style={{ color: "var(--fg-1)" }}>{ev.new_value ?? "0"}</strong>
          {delta !== 0 && (
            <span style={{ marginLeft: 6, fontFamily: "var(--font-mono)", fontSize: 10.5, color: delta > 0 ? "#16a268" : "var(--danger-text)" }}>
              ({delta > 0 ? "+" : ""}{delta})
            </span>
          )}
        </span>
      );
    }
    case "status_change":
      return <span>{ev.old_value} → <strong>{ev.new_value}</strong></span>;
    case "eta_change":
      return <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{ev.old_value} → <strong>{ev.new_value}</strong></span>;
    case "cascade_push":
      return <span style={{ color: "var(--fg-4)", fontFamily: "var(--font-mono)", fontSize: 10.5 }}>{ev.field_name} · {ev.old_value} → {ev.new_value}</span>;
    case "priority_change":
      return <span>{ev.old_value} → <strong>{ev.new_value}</strong></span>;
    default:
      return <span>{ev.notes ?? ev.field_name ?? ev.new_value ?? "—"}</span>;
  }
}
