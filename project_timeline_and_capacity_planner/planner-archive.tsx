"use client";

import { RotateCcw } from "lucide-react";
import { Project, Task, ProjectStatus } from "./types";

interface Props {
  projects: Project[];
  tasks: Task[];
  onRestore: (id: string) => void;
  onChangeStatus?: (id: string, patch: { status: ProjectStatus }) => void;
}

export function PlannerArchive({ projects, tasks, onRestore }: Props) {
  if (projects.length === 0) {
    return (
      <div className="archive-view" style={{ justifyContent: "center", alignItems: "center" }}>
        <div className="archive-empty">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polyline points="21 8 21 21 3 21 3 8"/>
            <rect x="1" y="3" width="22" height="5"/>
            <line x1="10" y1="12" x2="14" y2="12"/>
          </svg>
          <span>No archived projects</span>
        </div>
      </div>
    );
  }

  return (
    <div className="archive-view">
      <div className="archive-header">
        <span className="archive-meta-text">
          {projects.length} archived · Done or Cancelled
        </span>
        <span className="archive-meta-text" style={{ color: "var(--danger-text)" }}>
          Mandays excluded from capacity calculations
        </span>
      </div>

      {projects.map((proj) => {
        const projTasks = tasks.filter(t => t.project_id === proj.id);
        const totalEffort = 0; // Could sum from efforts if passed
        return (
          <div key={proj.id} className="archive-card">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
                <span className="archive-card-name">{proj.name}</span>
                <span className="inline-status st-td" style={{ cursor: "default" }}>
                  <span className="st-dot" />
                  {proj.status.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase())}
                </span>
              </div>
              <div className="archive-card-meta">
                <span>
                  {proj.status === "done" ? "Completed" : "Cancelled"}{" "}
                  {proj.updated_at ? new Date(proj.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                </span>
                <span className="sep">·</span>
                <span>{projTasks.length} task{projTasks.length !== 1 ? "s" : ""}</span>
                {proj.status === "cancelled" && (
                  <>
                    <span className="sep">·</span>
                    <span style={{ color: "var(--danger-text)" }}>Excluded from calculations</span>
                  </>
                )}
              </div>
            </div>
            <button className="restore-btn" onClick={() => onRestore(proj.id)}>
              <RotateCcw size={12} />
              Restore to active
            </button>
          </div>
        );
      })}
    </div>
  );
}
