"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Plus, GripVertical } from "lucide-react";
import { createPortal } from "react-dom";

import {
  Role, Project, Task, EffortMap, CapacityMap,
  PlannerDateRange, TaskStatus, ProjectStatus,
} from "./types";
import { HistoryEntry } from "./queries";
import {
  formatWeekRange, computeWeekRoleSummary, getTaskTotalEffort,
} from "./utils";
import { cn } from "@/lib/cn";

// ── Prop types ────────────────────────────────────────────────────────────────

interface Props {
  roles: Role[];
  projects: Project[];
  tasks: Task[];
  effortMap: EffortMap;
  capacityMap: CapacityMap;
  dateRange: PlannerDateRange;
  weeks: string[];
  selectedRowIds: Set<string>;
  onDateRangeChange: (range: PlannerDateRange) => void;
  onToggleSelect: (id: string) => void;
  onReorder: (projectIds: string[], taskIds: string[], historyEntries?: HistoryEntry[]) => void;
  onUpdateProject: (id: string, patch: Partial<Pick<Project, "name" | "status" | "eta" | "notes" | "priority_order" | "priority_label">>, historyEntry?: HistoryEntry) => void;
  onAddTask: (projectId: string) => void;
  onUpdateTask: (id: string, patch: Partial<Pick<Task, "name" | "status" | "eta" | "notes" | "priority_order" | "project_id">>, historyEntry?: HistoryEntry) => void;
  onUpsertEffort: (taskId: string, roleId: string, weekStart: string, mandays: number, oldMandays: number) => void;
  onUpsertCapacity: (roleId: string, weekStart: string, field: "capacity" | "taken_other" | "holiday" | "buffer_threshold", value: number) => void;
  onArchiveProject: (id: string) => void;
  onRunCascade: () => void;
}

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_CSS: Record<TaskStatus | ProjectStatus, string> = {
  in_progress: "st-ip", todo: "st-td", done: "st-dn",
  released: "st-rl", cancelled: "st-cx",
};
const STATUS_LABEL: Record<TaskStatus | ProjectStatus, string> = {
  in_progress: "In Progress", todo: "To Do", done: "Done",
  released: "Released", cancelled: "Cancelled",
};
const STATUS_DOT_COLOR: Record<TaskStatus | ProjectStatus, string> = {
  in_progress: "#3b82f6", todo: "var(--fg-4)", done: "var(--accent)",
  released: "#8b5cf6", cancelled: "var(--fg-4)",
};

// Unified statuses — same for both projects and tasks
const ALL_ITEM_STATUSES: { value: ProjectStatus | TaskStatus; label: string; dot: string }[] = [
  { value: "todo",        label: "To Do",       dot: "var(--fg-4)" },
  { value: "in_progress", label: "In Progress", dot: "#3b82f6" },
  { value: "done",        label: "Done",        dot: "var(--accent)" },
  { value: "released",    label: "Released",    dot: "#8b5cf6" },
  { value: "cancelled",   label: "Cancelled",   dot: "var(--fg-4)" },
];

// ── Role colour class (index-based) ──────────────────────────────────────────
const ROLE_EC_CLASS = ["ec-be", "ec-fw", "ec-fa", "ec-fi", "ec-qa"];

// ── StatusPortal ─────────────────────────────────────────────────────────────

interface StatusPortalProps {
  rect: DOMRect;
  onSelect: (status: TaskStatus | ProjectStatus) => void;
  onClose: () => void;
}

function StatusPortal({ rect, onSelect, onClose }: StatusPortalProps) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      // Only close if the click is outside the portal
      const el = document.getElementById("status-portal-inner");
      if (el && el.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const top = rect.bottom + 4 + window.scrollY;
  const left = rect.left + window.scrollX;

  return createPortal(
    <div
      id="status-portal-inner"
      className="status-portal"
      style={{ position: "absolute", top, left }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Portal title */}
      <div style={{
        padding: "6px 10px 4px",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: "var(--fg-4)",
        borderBottom: "1px solid var(--border-subtle)",
        marginBottom: 4,
      }}>
        Change Status
      </div>
      {ALL_ITEM_STATUSES.map(({ value, label, dot }) => (
        <div
          key={value}
          className="status-portal-item"
          onMouseDown={(e) => {
            e.stopPropagation();
            onSelect(value);
            onClose();
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot, flexShrink: 0, display: "inline-block" }} />
          {label}
        </div>
      ))}
    </div>,
    document.body,
  );
}

// ── Priority badge ────────────────────────────────────────────────────────────
const PRI_LEVELS: ("P1" | "P2" | "P3")[] = ["P1", "P2", "P3"];
const PRI_CLASS: Record<string, string> = { P1: "pri-badge pri-1", P2: "pri-badge pri-2", P3: "pri-badge pri-3" };

function resolveLabel(proj: Project, order: number): "P1" | "P2" | "P3" {
  if (proj.priority_label) return proj.priority_label;
  if (order === 0) return "P1";
  if (order === 1) return "P2";
  return "P3";
}

interface PriorityPortalProps {
  rect: DOMRect;
  current: "P1" | "P2" | "P3";
  onSelect: (label: "P1" | "P2" | "P3") => void;
  onClose: () => void;
}

function PriorityPortal({ rect, current, onSelect, onClose }: PriorityPortalProps) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const el = document.getElementById("pri-portal-inner");
      if (el && el.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return createPortal(
    <div
      id="pri-portal-inner"
      className="status-portal"
      style={{ position: "absolute", top: rect.bottom + 4 + window.scrollY, left: rect.left + window.scrollX, minWidth: 100 }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div style={{ padding: "6px 10px 4px", fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--fg-4)", borderBottom: "1px solid var(--border-subtle)", marginBottom: 4 }}>
        Set Priority
      </div>
      {PRI_LEVELS.map((p) => (
        <div
          key={p}
          className="status-portal-item"
          style={{ fontWeight: p === current ? 700 : undefined }}
          onMouseDown={(e) => { e.stopPropagation(); onSelect(p); onClose(); }}
        >
          <span className={PRI_CLASS[p]} style={{ padding: "1px 6px", fontSize: 10 }}>{p}</span>
          {p === current && <span style={{ marginLeft: "auto", color: "var(--accent-text)", fontSize: 10 }}>✓</span>}
        </div>
      ))}
    </div>,
    document.body,
  );
}

// ── EffortInput ───────────────────────────────────────────────────────────────

interface EffortInputProps {
  taskId: string;
  roleId: string;
  roleIdx: number;
  weekStart: string;
  isWeekStart: boolean;
  effortMap: EffortMap;
  onBlur: (taskId: string, roleId: string, weekStart: string, val: number, oldVal: number) => void;
}

function EffortInput({ taskId, roleId, roleIdx, weekStart, isWeekStart, effortMap, onBlur }: EffortInputProps) {
  const current = effortMap[taskId]?.[roleId]?.[weekStart] ?? 0;
  const [val, setVal] = useState(current > 0 ? String(current) : "");

  useEffect(() => {
    setVal(current > 0 ? String(current) : "");
  }, [current]);

  const ecClass = ROLE_EC_CLASS[roleIdx % ROLE_EC_CLASS.length];

  return (
    <td className={cn("effort-cell", ecClass, isWeekStart && "wk-start")}>
      <input
        type="text"
        inputMode="decimal"
        value={val}
        placeholder="–"
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => {
          const num = parseFloat(val) || 0;
          onBlur(taskId, roleId, weekStart, num, current);
        }}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      />
    </td>
  );
}

// ── CapInput ──────────────────────────────────────────────────────────────────

interface CapInputProps {
  value: number;
  className?: string;
  isWeekStart?: boolean;
  onChange: (val: number) => void;
}

function CapInput({ value, className, isWeekStart, onChange }: CapInputProps) {
  const [local, setLocal] = useState(value > 0 ? String(value) : "");
  useEffect(() => setLocal(value > 0 ? String(value) : ""), [value]);

  return (
    <td className={cn("sum-val", isWeekStart && "wk-start")}>
      <input
        className={cn("cap-input", className)}
        type="text"
        inputMode="decimal"
        value={local}
        placeholder="–"
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          const n = parseFloat(local) || 0;
          onChange(n);
        }}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      />
    </td>
  );
}

// ── Main Grid ────────────────────────────────────────────────────────────────

export function PlannerGrid({
  roles, projects, tasks, effortMap, capacityMap, dateRange, weeks, onRunCascade,
  selectedRowIds, onDateRangeChange, onToggleSelect, onReorder,
  onUpdateProject, onAddTask, onUpdateTask, onUpsertEffort, onUpsertCapacity,
  onArchiveProject,
}: Props) {
  const [statusTarget,   setStatusTarget]   = useState<{ rect: DOMRect; id: string; type: "project" | "task" } | null>(null);
  const [priorityTarget, setPriorityTarget] = useState<{ rect: DOMRect; proj: Project } | null>(null);

  // ── Drag & Drop ────────────────────────────────────────────────────────────
  const dragSrc = useRef<{ id: string; type: "project" | "task" } | null>(null);
  const [draggingId, setDraggingId]     = useState<string | null>(null); // triggers re-render on drag end
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const getProjectIndex = (id: string) =>
    [...projects].sort((a, b) => a.priority_order - b.priority_order).findIndex(p => p.id === id);

  const getTaskIndex = (id: string) =>
    [...tasks].sort((a, b) => a.priority_order - b.priority_order).findIndex(t => t.id === id);

  const handleDragStart = (id: string, type: "project" | "task") => {
    dragSrc.current = { id, type };
    setDraggingId(id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDropTargetId(id);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDropTargetId(null);
    const src = dragSrc.current;
    if (!src || src.id === targetId) return;

    const sortedProjects = [...projects].sort((a, b) => a.priority_order - b.priority_order);
    const sortedTasks    = [...tasks].sort((a, b) => a.priority_order - b.priority_order);

    if (src.type === "project") {
      // Move project block before target project
      const srcIdx = sortedProjects.findIndex(p => p.id === src.id);
      const tgtProj = sortedProjects.find(p => p.id === targetId) || sortedTasks.find(t => t.id === targetId) && sortedProjects.find(p => p.id === sortedTasks.find(t => t.id === targetId)?.project_id);
      if (!tgtProj) return;
      const tgtIdx = sortedProjects.findIndex(p => p.id === tgtProj.id);
      const reordered = [...sortedProjects];
      const [moved] = reordered.splice(srcIdx, 1);
      reordered.splice(tgtIdx, 0, moved);
      onReorder(
        reordered.map(p => p.id),
        sortedTasks.map(t => t.id),
        reordered.map((p, i) => ({
          project_id: p.id,
          change_type: "priority_change" as const,
          old_value: `P${sortedProjects.findIndex(sp => sp.id === p.id) + 1}`,
          new_value: `P${i + 1}`,
          notes: p.name,
        })).filter((e, i) => e.old_value !== e.new_value),
      );
    } else {
      // Move task before target row
      const srcTask = sortedTasks.find(t => t.id === src.id);
      if (!srcTask) return;
      const srcIdx = sortedTasks.findIndex(t => t.id === src.id);
      let tgtIdx = sortedTasks.findIndex(t => t.id === targetId);
      if (tgtIdx < 0) {
        // Target is a project row — place task at start of that project
        const tgtProj = sortedProjects.find(p => p.id === targetId);
        if (!tgtProj) return;
        tgtIdx = sortedTasks.findIndex(t => t.project_id === tgtProj.id);
        if (tgtIdx < 0) tgtIdx = sortedTasks.length;
      }
      const reordered = [...sortedTasks];
      const [moved] = reordered.splice(srcIdx, 1);
      reordered.splice(tgtIdx > srcIdx ? tgtIdx - 1 : tgtIdx, 0, moved);

      // Re-assign project_id based on which project is above each task
      let lastProjId = sortedProjects[0]?.id ?? "";
      const patchedTasks = reordered.map(t => {
        if (sortedProjects.some(p => p.id === t.id)) lastProjId = t.id;
        return { ...t, project_id: lastProjId };
      });

      onReorder(
        sortedProjects.map(p => p.id),
        patchedTasks.map(t => t.id),
      );
    }
  };

  // ── Flat ordered rows (project header + task rows interleaved) ────────────
  const sortedProjects = [...projects].sort((a, b) => a.priority_order - b.priority_order);
  const sortedTasks    = [...tasks].sort((a, b) => a.priority_order - b.priority_order);

  // Build flat rows: [project, ...tasks, add_task, project, ...]
  type Row =
    | { kind: "project";  data: Project }
    | { kind: "task";     data: Task }
    | { kind: "add_task"; projectId: string };
  const rows: Row[] = [];
  for (const proj of sortedProjects) {
    rows.push({ kind: "project", data: proj });
    for (const task of sortedTasks.filter(t => t.project_id === proj.id)) {
      rows.push({ kind: "task", data: task });
    }
    rows.push({ kind: "add_task", projectId: proj.id });
  }

  const allTaskIds = sortedTasks.map(t => t.id);

  // ── Detect negative buffers (cascade needed) ──────────────────────────────
  // Only flag weeks where capacity is explicitly set — weeks with capacity = 0
  // (not yet configured) are ignored to avoid false positives.
  const negativeBufferCount = weeks.reduce((count, w) =>
    count + roles.filter(role => {
      const s = computeWeekRoleSummary(role.id, w, capacityMap, effortMap, allTaskIds);
      return s.capacity > 0 && s.buffer < 0;
    }).length, 0);

  // ── Empty state ────────────────────────────────────────────────────────────
  if (projects.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
        <GridToolbar dateRange={dateRange} onDateRangeChange={onDateRangeChange} roles={roles} />
        <div className="planner-empty" style={{ flex: 1 }}>
          <div className="planner-empty-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
          </div>
          <h3>No projects yet</h3>
          <p>Click "Add Project" to start planning your team capacity.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
      {/* Toolbar */}
      <GridToolbar dateRange={dateRange} onDateRangeChange={onDateRangeChange} roles={roles} />

      {/* Cascade banner */}
      {negativeBufferCount > 0 && (
        <div style={{
          padding: "7px 28px",
          background: "rgba(226,67,75,.06)",
          borderBottom: "1px solid rgba(226,67,75,.2)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--danger-text)" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--danger-text)", fontWeight: 500 }}>
            {negativeBufferCount} role{negativeBufferCount > 1 ? "s" : ""} over capacity
          </span>
          <button
            type="button"
            onClick={onRunCascade}
            style={{
              padding: "4px 12px",
              borderRadius: "var(--radius-md)",
              background: "var(--danger-text)",
              color: "#fff",
              border: "none",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>
            Run Cascade
          </button>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-4)" }}>
            Pushes overflow effort from lower-priority tasks to next week
          </span>
        </div>
      )}

      {/* Scrollable grid */}
      <div className="grid-view">
        <table className="planner-table">
          <thead>
            {/* Week headers */}
            <tr className="thead-week">
              <th className="col-cb th-sticky" />
              <th className="col-drag th-sticky" />
              <th className="col-feat th-sticky th-col-header">Feature / Task</th>
              <th className="col-pri th-sticky th-col-header center">Pri</th>
              <th className="col-eta th-sticky th-col-header">ETA</th>
              <th className="col-tot th-sticky th-col-header center">Total<br /><span style={{ fontSize: 9 }}>effort</span></th>
              {weeks.map((w, i) => (
                <th key={w} colSpan={roles.length} className={cn("th-week-group", i === 0 && "first")}>
                  <span className="th-week-date">{formatWeekRange(w)}</span>
                </th>
              ))}
            </tr>
            {/* Role sub-headers */}
            <tr className="thead-role">
              <th className="col-cb th-sticky" />
              <th className="col-drag th-sticky" />
              <th className="col-feat th-sticky" />
              <th className="col-pri th-sticky" />
              <th className="col-eta th-sticky" />
              <th className="col-tot th-sticky" />
              {weeks.map((w, wi) =>
                roles.map((role, ri) => (
                  <th
                    key={`${w}-${role.id}`}
                    className={cn("th-role", ri === 0 && "first")}
                    style={{ color: role.color, background: `${role.color}18` }}
                  >
                    {role.name}
                  </th>
                ))
              )}
            </tr>
          </thead>

          <tbody>
            {/* ── Summary rows ── */}
            <SummaryRows
              roles={roles}
              weeks={weeks}
              allTaskIds={allTaskIds}
              capacityMap={capacityMap}
              effortMap={effortMap}
              onUpsertCapacity={onUpsertCapacity}
            />

            {/* ── Data rows ── */}
            {rows.map((row, rowIdx) => {
              // ── Add task row ──
              if (row.kind === "add_task") {
                const colSpan = 6 + weeks.length * roles.length;
                return (
                  <tr key={`add-${row.projectId}`}>
                    <td className="col-cb" />
                    <td className="col-drag" />
                    <td
                      className="col-feat"
                      colSpan={colSpan - 2}
                      style={{ padding: "4px 20px" }}
                    >
                      <button
                        type="button"
                        onClick={() => onAddTask(row.projectId)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                          color: "var(--fg-4)",
                          padding: "2px 0",
                          transition: "color 120ms",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = "var(--accent-text)")}
                        onMouseLeave={e => (e.currentTarget.style.color = "var(--fg-4)")}
                      >
                        <Plus size={12} /> Add task
                      </button>
                    </td>
                  </tr>
                );
              }

              const isProject = row.kind === "project";
              const id = row.data.id;
              const isSelected   = selectedRowIds.has(id);
              const isDragging   = draggingId === id;
              const isDropTarget = dropTargetId === id;

              if (isProject) {
                const proj = row.data as Project;
                const projIdx = sortedProjects.indexOf(proj);
                const totalEffort = sortedTasks
                  .filter(t => t.project_id === proj.id)
                  .reduce((s, t) => s + getTaskTotalEffort(t.id, effortMap), 0);

                return (
                  <tr
                    key={id}
                    className={cn("row-project", isSelected && "row-selected", isDragging && "row-dragging", isDropTarget && "row-drop-target")}
                    draggable
                    onDragStart={() => handleDragStart(id, "project")}
                    onDragOver={(e) => handleDragOver(e, id)}
                    onDrop={(e) => handleDrop(e, id)}
                    onDragEnd={() => { setDropTargetId(null); setDraggingId(null); dragSrc.current = null; }}
                  >
                    {/* Checkbox */}
                    <td className="col-cb cb-cell">
                      <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(id)} />
                    </td>
                    {/* Drag */}
                    <td className="col-drag drag-handle">⠿</td>
                    {/* Name + inline status */}
                    <td className="col-feat">
                      <div className="feat-cell">
                        <span className="proj-icon">
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--accent-text)" strokeWidth="2.5">
                            <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
                          </svg>
                        </span>
                        <span className="feat-name">{proj.name}</span>
                        <button
                          className={cn("inline-status", STATUS_CSS[proj.status])}
                          onClick={(e) => {
                            e.stopPropagation();
                            setStatusTarget({ rect: e.currentTarget.getBoundingClientRect(), id, type: "project" });
                          }}
                        >
                          <span className="st-dot" style={{ background: STATUS_DOT_COLOR[proj.status] }} />
                          {STATUS_LABEL[proj.status]}
                        </button>
                      </div>
                    </td>
                    {/* Priority — clickable dropdown */}
                    <td className="col-pri" style={{ padding: "0 6px" }}>
                      <button
                        type="button"
                        className={PRI_CLASS[resolveLabel(proj, projIdx)]}
                        style={{ border: "none", cursor: "pointer", background: "none", padding: "2px 7px" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPriorityTarget({ rect: e.currentTarget.getBoundingClientRect(), proj });
                        }}
                        title="Click to change priority label"
                      >
                        {resolveLabel(proj, projIdx)}
                      </button>
                    </td>
                    {/* ETA */}
                    <td className="col-eta eta-cell">{proj.eta ? new Date(proj.eta + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}</td>
                    {/* Total */}
                    <td className="col-tot total-cell">{totalEffort > 0 ? totalEffort : "—"}</td>
                    {/* Effort cells (aggregated) */}
                    {weeks.map((w, wi) =>
                      roles.map((role, ri) => {
                        const ecClass = ROLE_EC_CLASS[ri % ROLE_EC_CLASS.length];
                        const agg = sortedTasks
                          .filter(t => t.project_id === proj.id)
                          .reduce((s, t) => s + (effortMap[t.id]?.[role.id]?.[w] ?? 0), 0);
                        return (
                          <td key={`${w}-${role.id}`} className={cn("effort-cell", agg > 0 ? ecClass : "", ri === 0 && "wk-start")}
                            style={{ color: agg > 0 ? undefined : "transparent" }}>
                            {agg > 0 ? agg : ""}
                          </td>
                        );
                      })
                    )}
                  </tr>
                );
              }

              // Task row
              const task = row.data as Task;
              const taskTotalEffort = getTaskTotalEffort(task.id, effortMap);

              return (
                <tr
                  key={id}
                  className={cn("row-task", isSelected && "row-selected", isDragging && "row-dragging", isDropTarget && "row-drop-target")}
                  draggable
                  onDragStart={() => handleDragStart(id, "task")}
                  onDragOver={(e) => handleDragOver(e, id)}
                  onDrop={(e) => handleDrop(e, id)}
                  onDragEnd={() => { setDropTargetId(null); setDraggingId(null); dragSrc.current = null; }}
                >
                  <td className="col-cb cb-cell">
                    <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(id)} />
                  </td>
                  <td className="col-drag drag-handle">⠿</td>
                  <td className="col-feat">
                    <div className="feat-cell">
                      <span className="feat-name">{task.name}</span>
                      <button
                        className={cn("inline-status", STATUS_CSS[task.status])}
                        onClick={(e) => {
                          e.stopPropagation();
                          setStatusTarget({ rect: e.currentTarget.getBoundingClientRect(), id, type: "task" });
                        }}
                      >
                        <span className="st-dot" style={{ background: STATUS_DOT_COLOR[task.status] }} />
                        {STATUS_LABEL[task.status]}
                      </button>
                    </div>
                  </td>
                  <td className="col-pri" style={{ padding: "0 6px" }}>
                    {(() => {
                      const parentProj = sortedProjects.find(p => p.id === task.project_id);
                      const parentIdx  = parentProj ? sortedProjects.indexOf(parentProj) : 0;
                      const label      = parentProj ? resolveLabel(parentProj, parentIdx) : "P3";
                      return <span className={PRI_CLASS[label]} style={{ opacity: 0.55 }}>{label}</span>;
                    })()}
                  </td>
                  <td className="col-eta eta-cell">{task.eta ? new Date(task.eta + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}</td>
                  <td className="col-tot total-cell">{taskTotalEffort > 0 ? taskTotalEffort : "—"}</td>
                  {weeks.map((w, wi) =>
                    roles.map((role, ri) => (
                      <EffortInput
                        key={`${w}-${role.id}`}
                        taskId={task.id}
                        roleId={role.id}
                        roleIdx={ri}
                        weekStart={w}
                        isWeekStart={ri === 0}
                        effortMap={effortMap}
                        onBlur={onUpsertEffort}
                      />
                    ))
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Priority portal */}
      {priorityTarget && (
        <PriorityPortal
          rect={priorityTarget.rect}
          current={resolveLabel(priorityTarget.proj, sortedProjects.indexOf(priorityTarget.proj))}
          onClose={() => setPriorityTarget(null)}
          onSelect={(label) => {
            onUpdateProject(priorityTarget.proj.id, { priority_label: label }, {
              project_id: priorityTarget.proj.id,
              change_type: "priority_change",
              field_name: "priority_label",
              old_value: resolveLabel(priorityTarget.proj, sortedProjects.indexOf(priorityTarget.proj)),
              new_value: label,
              notes: priorityTarget.proj.name,
            });
          }}
        />
      )}

      {/* Status portal */}
      {statusTarget && (
        <StatusPortal
          rect={statusTarget.rect}
          onClose={() => setStatusTarget(null)}
          onSelect={(status) => {
            if (statusTarget.type === "project") {
              const proj = projects.find(p => p.id === statusTarget.id);
              onUpdateProject(statusTarget.id, { status: status as ProjectStatus }, {
                project_id: statusTarget.id,
                change_type: "status_change",
                field_name: "status",
                old_value: proj?.status,
                new_value: status,
                notes: proj?.name,
              });
              // Status change alone does NOT archive — user must click Archive explicitly
            } else {
              const task = tasks.find(t => t.id === statusTarget.id);
              onUpdateTask(statusTarget.id, { status: status as TaskStatus }, {
                project_id: task?.project_id,
                task_id: statusTarget.id,
                change_type: "status_change",
                field_name: "status",
                old_value: task?.status,
                new_value: status,
                notes: task?.name,
              });
            }
          }}
        />
      )}
    </div>
  );
}

// ── Summary Rows ──────────────────────────────────────────────────────────────

interface SummaryRowsProps {
  roles: Role[];
  weeks: string[];
  allTaskIds: string[];
  capacityMap: CapacityMap;
  effortMap: EffortMap;
  onUpsertCapacity: Props["onUpsertCapacity"];
}

function SummaryRows({ roles, weeks, allTaskIds, capacityMap, effortMap, onUpsertCapacity }: SummaryRowsProps) {
  const emptySticky = (
    <>
      <td className="col-cb" />
      <td className="col-drag" />
    </>
  );

  return (
    <>
      {/* Capacity */}
      <tr className="row-sum">
        {emptySticky}
        <td className="col-feat" style={{ padding: "0 10px" }}><span className="sum-label">Capacity (mandays)</span></td>
        <td className="col-pri" /><td className="col-eta" /><td className="col-tot" />
        {weeks.map((w, wi) =>
          roles.map((role, ri) => {
            const cap = capacityMap[role.id]?.[w];
            return (
              <CapInput
                key={`${w}-${role.id}`}
                value={cap?.capacity ?? 0}
                isWeekStart={ri === 0}
                onChange={(v) => onUpsertCapacity(role.id, w, "capacity", v)}
              />
            );
          })
        )}
      </tr>

      {/* Total Required */}
      <tr className="row-sum row-sum-req">
        {emptySticky}
        <td className="col-feat" style={{ padding: "0 10px" }}>
          <span className="sum-label sum-label-req">Total Required</span>
        </td>
        <td className="col-pri" /><td className="col-eta" /><td className="col-tot" />
        {weeks.map((w, wi) =>
          roles.map((role, ri) => {
            const req = allTaskIds.reduce((s, tid) => s + (effortMap[tid]?.[role.id]?.[w] ?? 0), 0);
            return (
              <td key={`${w}-${role.id}`} className={cn("sum-val sum-val-req", ri === 0 && "wk-start")}>
                {req > 0 ? req : "—"}
              </td>
            );
          })
        )}
      </tr>

      {/* Taken */}
      <tr className="row-sum">
        {emptySticky}
        <td className="col-feat" style={{ padding: "0 10px" }}><span className="sum-label">Taken (other squad)</span></td>
        <td className="col-pri" /><td className="col-eta" /><td className="col-tot" />
        {weeks.map((w, wi) =>
          roles.map((role, ri) => {
            const cap = capacityMap[role.id]?.[w];
            return (
              <CapInput
                key={`${w}-${role.id}`}
                value={cap?.taken_other ?? 0}
                isWeekStart={ri === 0}
                onChange={(v) => onUpsertCapacity(role.id, w, "taken_other", v)}
              />
            );
          })
        )}
      </tr>

      {/* Holiday */}
      <tr className="row-sum">
        {emptySticky}
        <td className="col-feat" style={{ padding: "0 10px" }}><span className="sum-label">Holiday / Day-off</span></td>
        <td className="col-pri" /><td className="col-eta" /><td className="col-tot" />
        {weeks.map((w, wi) =>
          roles.map((role, ri) => {
            const cap = capacityMap[role.id]?.[w];
            return (
              <CapInput
                key={`${w}-${role.id}`}
                value={cap?.holiday ?? 0}
                isWeekStart={ri === 0}
                className={cap?.holiday ? "cap-input-warn" : undefined}
                onChange={(v) => onUpsertCapacity(role.id, w, "holiday", v)}
              />
            );
          })
        )}
      </tr>

      {/* Buffer / Shortage */}
      <tr className="row-sum">
        {emptySticky}
        <td className="col-feat" style={{ padding: "0 10px" }}><span className="sum-label">Buffer / Shortage</span></td>
        <td className="col-pri" /><td className="col-eta" /><td className="col-tot" />
        {weeks.map((w, wi) =>
          roles.map((role, ri) => {
            const s = computeWeekRoleSummary(role.id, w, capacityMap, effortMap, allTaskIds);
            const isOverCapacity = s.capacity > 0 && s.buffer < 0;
            const cls = isOverCapacity ? "buf-neg buf-neg-bg" : "buf-pos";
            return (
              <td key={`${w}-${role.id}`} className={cn("sum-val", cls, ri === 0 && "wk-start")}>
                {s.buffer > 0 ? `+${s.buffer}` : s.buffer < 0 ? s.buffer : "—"}
              </td>
            );
          })
        )}
      </tr>

      {/* Min Buffer Threshold */}
      <tr className="row-sum row-sum-thr row-sum-last">
        {emptySticky}
        <td className="col-feat" style={{ padding: "0 10px" }}>
          <span className="sum-label sum-label-thr">Min Buffer Threshold</span>
          <span className="sum-note">cascade trigger ↓</span>
        </td>
        <td className="col-pri" /><td className="col-eta" /><td className="col-tot" />
        {weeks.map((w, wi) =>
          roles.map((role, ri) => {
            const cap = capacityMap[role.id]?.[w];
            return (
              <CapInput
                key={`${w}-${role.id}`}
                value={cap?.buffer_threshold ?? 0}
                isWeekStart={ri === 0}
                className="cap-input-thr"
                onChange={(v) => onUpsertCapacity(role.id, w, "buffer_threshold", v)}
              />
            );
          })
        )}
      </tr>
    </>
  );
}

// ── Grid Toolbar ──────────────────────────────────────────────────────────────

function GridToolbar({ dateRange, onDateRangeChange, roles }: {
  dateRange: PlannerDateRange;
  onDateRangeChange: (r: PlannerDateRange) => void;
  roles: Role[];
}) {
  return (
    <div className="planner-toolbar">
      <span className="toolbar-label">Filter</span>
      {/* Status chips would go here */}
      <button className="filter-chip active">All</button>
      <button className="filter-chip">P1</button>
      <button className="filter-chip">P2</button>
      <button className="filter-chip">In Progress</button>
      <div className="toolbar-sep" />
      {roles.map((role) => (
        <button
          key={role.id}
          className="filter-chip active"
          style={{ background: `${role.color}18`, borderColor: `${role.color}40`, color: role.color }}
        >
          {role.name}
        </button>
      ))}
      <button className="filter-chip" style={{ borderStyle: "dashed" }}>
        <Plus size={10} /> Add role
      </button>

      <div className="toolbar-right">
        <span className="toolbar-label">Start</span>
        <input
          type="date"
          className="date-pill"
          value={dateRange.start}
          onChange={(e) => onDateRangeChange({ ...dateRange, start: e.target.value })}
        />
        <span style={{ color: "var(--fg-4)", fontSize: 12 }}>→</span>
        <span className="toolbar-label">End</span>
        <input
          type="date"
          className="date-pill"
          value={dateRange.end}
          onChange={(e) => onDateRangeChange({ ...dateRange, end: e.target.value })}
        />
      </div>
    </div>
  );
}
