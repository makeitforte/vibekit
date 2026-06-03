"use client";

import { X, Clock } from "lucide-react";
import { ChangeHistory, Project } from "./types";
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
};

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)    return "Just now";
  if (mins < 60)   return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days < 7)    return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function HistoryPanel({ open, history, projects, projectFilter, onClose, onFilterChange }: Props) {
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
                ) : null}
                {entry.project_name && (
                  <span className="history-proj-chip">{entry.project_name}</span>
                )}
                {formatRelativeTime(entry.created_at)}
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
