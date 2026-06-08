"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Clock } from "lucide-react";
import { ChangeHistory, Project } from "./types";
import { fetchProfilesByIds, type MemberProfile } from "./queries";
import { useProfiles } from "@/lib/profiles-context";
import { cn } from "@/lib/cn";

interface Props {
  open: boolean;
  history: ChangeHistory[];
  projects: Project[];
  projectFilter: string | null;
  onClose: () => void;
  onFilterChange: (projectId: string | null) => void;
}

const CHANGE_LABEL: Record<string, string> = {
  priority_change:   "Priority changed",
  mandays_change:    "Mandays updated",
  status_change:     "Status changed",
  cascade_push:      "Timeline auto-shifted",
  capacity_change:   "Capacity updated",
  project_created:   "Project created",
  task_created:      "Task created",
  project_archived:  "Project archived",
  project_restored:  "Project restored",
  project_deleted:   "Project deleted",
  task_deleted:      "Task deleted",
  eta_change:        "ETA changed",
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  return `${date} · ${time}`;
}

export function HistoryPanel({ open, history, projects, projectFilter, onClose, onFilterChange }: Props) {
  const { user } = useProfiles();
  const myId = user?.id;

  // Resolve "who made this change" for entries authored by collaborators (not me).
  const [actors, setActors] = useState<Record<string, MemberProfile>>({});
  const otherActorIds = useMemo(
    () => Array.from(new Set(history.map(h => h.user_id).filter(id => id !== myId))).sort().join(","),
    [history, myId],
  );
  useEffect(() => {
    const ids = otherActorIds ? otherActorIds.split(",") : [];
    if (ids.length === 0) return;
    let cancelled = false;
    fetchProfilesByIds(ids)
      .then(profiles => {
        if (!cancelled) setActors(Object.fromEntries(profiles.map(p => [p.id, p])));
      })
      .catch(e => console.error("fetch actor profiles failed", e));
    return () => { cancelled = true; };
  }, [otherActorIds]);

  const filtered = projectFilter
    ? history.filter(h => h.project_id === projectFilter)
    : history;

  return (
    <div className={cn("history-panel", open && "open")}>
      <div className="history-panel-header">
        <Clock size={15} style={{ color: "var(--fg-3)" }} />
        <span className="history-panel-title">Change History</span>
        <button
          className="btn btn-ghost"
          style={{ marginLeft: "auto", padding: "4px 6px" }}
          onClick={onClose}
        >
          <X size={14} />
        </button>
      </div>

      {/* Project filter */}
      <div className="history-filter">
        <select
          value={projectFilter ?? ""}
          onChange={(e) => onFilterChange(e.target.value || null)}
        >
          <option value="">All projects</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="history-list">
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--fg-4)", fontFamily: "var(--font-mono)", fontSize: 12, padding: "24px 0" }}>
            No changes recorded yet
          </div>
        ) : (
          filtered.map((entry) => (
            <div key={entry.id} className="history-entry">
              <div className="history-time">
                {entry.change_type === "cascade_push" ? (
                  <span className="history-sys-chip">System</span>
                ) : entry.user_id !== myId ? (
                  <span className="history-actor-chip" title={`Made by ${actors[entry.user_id]?.name ?? "a collaborator"}`}>
                    <span className="history-actor-dot" style={{ background: actors[entry.user_id]?.color ?? "var(--surface-4)" }} />
                    {actors[entry.user_id]?.name ?? "Collaborator"}
                  </span>
                ) : null}
                {entry.project_name && (
                  <span className="history-proj-chip">{entry.project_name}</span>
                )}
                {formatDateTime(entry.created_at)}
              </div>
              <div className="history-desc">
                {CHANGE_LABEL[entry.change_type] ?? entry.change_type}
                {entry.field_name && <> · <strong>{entry.field_name}</strong></>}
                {entry.notes && !entry.project_name && <> · {entry.notes}</>}
              </div>
              {(entry.old_value || entry.new_value) && (
                <div className="history-diff">
                  {entry.old_value && <span className="diff-old">{entry.old_value}</span>}
                  {entry.old_value && entry.new_value && " → "}
                  {entry.new_value && <span className="diff-new">{entry.new_value}</span>}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
