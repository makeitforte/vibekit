"use client";

import { useState } from "react";
import { X, Plus, Archive, Trash2, Edit2, Check, FolderOpen } from "lucide-react";
import { Project, Task, EffortMap, ProjectStatus } from "./types";
import { getTaskTotalEffort } from "./utils";
import { cn } from "@/lib/cn";

interface Props {
  open: boolean;
  projects: Project[];          // active projects
  archivedProjects: Project[];  // archived
  tasks: Task[];
  effortMap: EffortMap;
  onClose: () => void;
  onCreateProject: (name: string) => void;
  onRenameProject: (id: string, name: string) => void;
  onArchiveProject: (id: string) => void;
  onRestoreProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onUpdateProjectStatus: (id: string, status: ProjectStatus) => void;
}

const STATUS_OPTIONS: { value: ProjectStatus; label: string; dot: string }[] = [
  { value: "todo",        label: "To Do",       dot: "var(--fg-4)" },
  { value: "in_progress", label: "In Progress", dot: "#3b82f6" },
  { value: "done",        label: "Done",        dot: "var(--accent)" },
  { value: "released",    label: "Released",    dot: "#8b5cf6" },
  { value: "cancelled",   label: "Cancelled",   dot: "var(--fg-4)" },
];

const STATUS_LABEL: Record<string, string> = {
  todo: "To Do", in_progress: "In Progress", done: "Done",
  released: "Released", cancelled: "Cancelled",
};

export function ProjectsPanel({
  open, projects, archivedProjects, tasks, effortMap, onClose,
  onCreateProject, onRenameProject, onArchiveProject, onRestoreProject,
  onDeleteProject, onUpdateProjectStatus,
}: Props) {
  const [newName, setNewName]         = useState("");
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [tab, setTab]                 = useState<"active" | "archived">("active");

  const list = tab === "active" ? projects : archivedProjects;

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    onCreateProject(name);
    setNewName("");
  };

  const projectStats = (proj: Project) => {
    const projTasks = tasks.filter(t => t.project_id === proj.id);
    const totalMd   = projTasks.reduce((s, t) => s + getTaskTotalEffort(t.id, effortMap), 0);
    return { taskCount: projTasks.length, totalMd };
  };

  return (
    <div className={cn("hist-panel", open && "open")} style={{ width: 320 }}>
      {/* Header */}
      <div className="history-panel-header">
        <FolderOpen size={15} style={{ color: "var(--fg-3)" }} />
        <span className="history-panel-title">Projects</span>
        <button className="ib" style={{ marginLeft: "auto" }} onClick={onClose}>
          <X size={14} />
        </button>
      </div>

      {/* New project form */}
      <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border-subtle)" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            placeholder="New project name…"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleCreate(); }}
            style={{
              flex: 1, padding: "7px 10px", borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-strong)", background: "var(--surface-3)",
              fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--fg-1)",
              outline: "none",
            }}
          />
          <button
            onClick={handleCreate}
            disabled={!newName.trim()}
            style={{
              padding: "7px 12px", borderRadius: "var(--radius-md)",
              background: "var(--accent)", color: "#fff", border: "none",
              fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600,
              cursor: newName.trim() ? "pointer" : "default",
              opacity: newName.trim() ? 1 : 0.4,
              display: "flex", alignItems: "center", gap: 4,
            }}
          >
            <Plus size={12} /> Add
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
        {(["active", "archived"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              flex: 1, padding: "8px", border: "none", background: "none",
              fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500,
              cursor: "pointer", color: tab === t ? "var(--fg-1)" : "var(--fg-4)",
              borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
              transition: "color 120ms",
            }}>
            {t === "active" ? `Active (${projects.length})` : `Archived (${archivedProjects.length})`}
          </button>
        ))}
      </div>

      {/* Project list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
        {list.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--fg-4)", fontFamily: "var(--font-mono)", fontSize: 12, padding: "24px 0" }}>
            {tab === "active" ? "No active projects yet" : "No archived projects"}
          </div>
        )}

        {list.map(proj => {
          const { taskCount, totalMd } = projectStats(proj);
          const isEditing = editingId === proj.id;
          return (
            <div key={proj.id} style={{
              padding: "10px 12px", borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-subtle)", background: "var(--bg-base)",
            }}>
              {/* Name row */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                {isEditing ? (
                  <input
                    autoFocus
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onBlur={() => {
                      if (editingName.trim()) onRenameProject(proj.id, editingName.trim());
                      setEditingId(null);
                    }}
                    onKeyDown={e => {
                      if (e.key === "Enter") { if (editingName.trim()) onRenameProject(proj.id, editingName.trim()); setEditingId(null); }
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    style={{
                      flex: 1, padding: "3px 6px", borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--accent-border)", background: "var(--surface-1)",
                      fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600,
                      outline: "none",
                    }}
                  />
                ) : (
                  <span style={{ flex: 1, fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600, color: "var(--fg-1)" }}>
                    {proj.name}
                  </span>
                )}
                <button className="ib" title="Rename" onClick={() => { setEditingId(proj.id); setEditingName(proj.name); }}>
                  <Edit2 size={12} />
                </button>
              </div>

              {/* Status + stats */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {/* Status selector */}
                <select
                  value={proj.status}
                  onChange={e => onUpdateProjectStatus(proj.id, e.target.value as ProjectStatus)}
                  style={{
                    padding: "2px 6px", borderRadius: "var(--radius-full)",
                    border: "1px solid var(--border-subtle)", background: "var(--surface-3)",
                    fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-2)",
                    cursor: "pointer", outline: "none",
                  }}
                >
                  {STATUS_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>

                {/* Stats */}
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-4)" }}>
                  {taskCount} task{taskCount !== 1 ? "s" : ""} · {totalMd > 0 ? `${totalMd} md` : "0 md"}
                </span>

                {/* Actions */}
                <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                  {tab === "active" ? (
                    <>
                      <button className="ib" title="Archive project"
                        onClick={() => { if (window.confirm(`Archive "${proj.name}"?`)) onArchiveProject(proj.id); }}>
                        <Archive size={12} />
                      </button>
                      <button className="ib" title="Delete project"
                        style={{ color: "var(--danger-text)" }}
                        onClick={() => { if (window.confirm(`Delete "${proj.name}" and all its tasks? This cannot be undone.`)) onDeleteProject(proj.id); }}>
                        <Trash2 size={12} />
                      </button>
                    </>
                  ) : (
                    <button className="ib" title="Restore to active"
                      style={{ color: "var(--accent-text)" }}
                      onClick={() => onRestoreProject(proj.id)}>
                      <Check size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
