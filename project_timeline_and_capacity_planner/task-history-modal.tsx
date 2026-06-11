"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Task, Role, ChangeHistory } from "./types";
import { fetchTaskHistory, fetchProfilesByIds, MemberProfile } from "./queries";

interface Props {
  task: Task;
  boardOwnerId: string;
  roles: Role[];
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

export function TaskHistoryModal({ task, boardOwnerId, roles, onClose }: Props) {
  const [tab, setTab]       = useState<"changes" | "mandays">("changes");
  const [history, setHistory] = useState<ChangeHistory[]>([]);
  const [profiles, setProfiles] = useState<Record<string, MemberProfile>>({});
  const [loading, setLoading] = useState(true);

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
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--fg-4)", marginBottom: 3 }}>Task History</div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--fg-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.name}</div>
          </div>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--fg-4)", padding: 2, flexShrink: 0, marginTop: 2 }}>
            <X size={15} />
          </button>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border-subtle)", padding: "0 18px" }}>
          {(["changes", "mandays"] as const).map(t => (
            <button key={t} type="button" onClick={() => setTab(t)} style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "8px 14px",
              fontFamily: "var(--font-mono)", fontSize: 11,
              fontWeight: tab === t ? 600 : 400,
              color: tab === t ? "var(--fg-1)" : "var(--fg-4)",
              borderBottom: tab === t ? "2px solid var(--accent-text)" : "2px solid transparent",
              marginBottom: -1,
            }}>
              {t === "changes" ? "Changes" : "Mandays Summary"}
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px" }}>
          {loading ? (
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
