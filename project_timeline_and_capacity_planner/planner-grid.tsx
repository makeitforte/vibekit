"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Plus, GripVertical, FileText, Link2 } from "lucide-react";
import { createPortal } from "react-dom";

import {
  Role, Project, Task, EffortMap, CapacityMap,
  PlannerDateRange, TaskStatus, ProjectStatus,
} from "./types";
import { HistoryEntry } from "./queries";
import {
  formatWeekRange, computeWeekRoleSummary, getTaskTotalEffort, deriveTaskEta,
} from "./utils";
import { TaskDetailsModal } from "./task-details-modal";
import { cn } from "@/lib/cn";

// ── Prop types ────────────────────────────────────────────────────────────────

interface Props {
  boardOwnerId: string;
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
  onUpdateTask: (id: string, patch: Partial<Pick<Task, "name" | "status" | "eta" | "notes" | "links" | "priority_order" | "project_id" | "priority_label">>, historyEntry?: HistoryEntry) => void;
  onUpsertEffort: (taskId: string, roleId: string, weekStart: string, mandays: number, oldMandays: number) => void;
  onUpsertCapacity: (roleId: string, weekStart: string, field: "capacity" | "taken_other" | "holiday" | "buffer_threshold", value: number) => void;
  onArchiveProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onRunCascade: () => void;
  onRowHistoryClick: (projectId: string) => void;
  onChangeTaskProject: (taskId: string, newProjectId: string) => void;
}

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_CSS: Record<TaskStatus | ProjectStatus, string> = {
  todo: "st-td", prd_in_progress: "st-prd-ip", prd_ready: "st-prd-rdy",
  in_progress: "st-ip", done: "st-dn", released: "st-rl", cancelled: "st-cx",
};
const STATUS_LABEL: Record<TaskStatus | ProjectStatus, string> = {
  todo: "To Do", prd_in_progress: "PRD In Progress", prd_ready: "PRD Ready",
  in_progress: "In Progress", done: "Done", released: "Released", cancelled: "Cancelled",
};
const STATUS_DOT_COLOR: Record<TaskStatus | ProjectStatus, string> = {
  todo: "var(--fg-4)", prd_in_progress: "#f59e0b", prd_ready: "#10b981",
  in_progress: "#3b82f6", done: "var(--accent)", released: "#8b5cf6", cancelled: "var(--fg-4)",
};

// Project statuses (no PRD stages)
const PROJECT_STATUSES: { value: ProjectStatus; label: string; dot: string }[] = [
  { value: "todo",        label: "To Do",       dot: "var(--fg-4)" },
  { value: "in_progress", label: "In Progress", dot: "#3b82f6" },
  { value: "done",        label: "Done",        dot: "var(--accent)" },
  { value: "released",    label: "Released",    dot: "#8b5cf6" },
  { value: "cancelled",   label: "Cancelled",   dot: "var(--fg-4)" },
];

// Task statuses (includes PRD stages)
const TASK_STATUSES: { value: TaskStatus; label: string; dot: string }[] = [
  { value: "todo",            label: "To Do",            dot: "var(--fg-4)" },
  { value: "prd_in_progress", label: "PRD In Progress",  dot: "#f59e0b" },
  { value: "prd_ready",       label: "PRD Ready",        dot: "#10b981" },
  { value: "in_progress",     label: "In Progress",      dot: "#3b82f6" },
  { value: "done",            label: "Done",             dot: "var(--accent)" },
  { value: "released",        label: "Released",         dot: "#8b5cf6" },
  { value: "cancelled",       label: "Cancelled",        dot: "var(--fg-4)" },
];

// For backward compat — keep a combined list
const ALL_ITEM_STATUSES = TASK_STATUSES;

// ── Role colour class (index-based) ──────────────────────────────────────────
const ROLE_EC_CLASS = ["ec-be", "ec-fw", "ec-fa", "ec-fi", "ec-qa"];

/** Mix hex color with white to get a fully opaque solid tint (no transparency) */
function solidTint(hex: string, alpha = 0.18): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const R = Math.round(255 * (1 - alpha) + r * alpha);
  const G = Math.round(255 * (1 - alpha) + g * alpha);
  const B = Math.round(255 * (1 - alpha) + b * alpha);
  return `rgb(${R},${G},${B})`;
}

// ── ContextMenu ───────────────────────────────────────────────────────────────

interface CtxState {
  x: number; y: number;
  id: string; type: "project" | "task";
  projectId: string;
  isArchived: boolean;
}

interface ContextMenuProps extends CtxState {
  projects: Project[];
  onClose: () => void;
  onEditName: () => void;
  onViewHistory: (projectId: string) => void;
  onViewTaskHistory: (taskId: string) => void;
  onViewTaskDetails: (taskId: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string, type: "project" | "task") => void;
  onChangeProject: (taskId: string, newProjectId: string) => void;
}

function ContextMenu({ x, y, id, type, projectId, projects, onClose, onEditName, onViewHistory, onViewTaskHistory, onViewTaskDetails, onArchive, onDelete, onChangeProject }: ContextMenuProps) {
  const [showProjPicker, setShowProjPicker] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [submenuFlipLeft, setSubmenuFlipLeft]   = useState(false);
  const [submenuFlipUp,   setSubmenuFlipUp]     = useState(false);

  useEffect(() => {
    if (showProjPicker && menuRef.current) {
      const r = menuRef.current.getBoundingClientRect();
      setSubmenuFlipLeft(r.right + 200 > window.innerWidth);
      setSubmenuFlipUp(r.bottom + projects.length * 36 > window.innerHeight);
    }
  }, [showProjPicker, projects.length]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      const el = document.getElementById("ctx-menu-inner");
      if (el && el.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  const top  = y + 220 > window.innerHeight ? y - 220 : y;
  const left = x + 180 > window.innerWidth  ? x - 180 : x;

  return createPortal(
    <div ref={menuRef} id="ctx-menu-inner" className="ctx-menu" style={{ position: "fixed", top, left }} onMouseDown={e => e.stopPropagation()}>
      <button className="ctx-item" onClick={() => { onEditName(); onClose(); }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        Edit name
      </button>

      {/* Change project — tasks only */}
      {type === "task" && (
        <div style={{ position: "relative" }}>
          <button className="ctx-item" onMouseEnter={() => setShowProjPicker(true)} onMouseLeave={() => setShowProjPicker(false)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
            Change project
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: "auto" }}><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          {showProjPicker && (
            <div
              style={{
                position: "absolute",
                ...(submenuFlipLeft ? { right: "100%", left: "auto" } : { left: "100%" }),
                ...(submenuFlipUp   ? { bottom: 0,    top:  "auto" } : { top: 0 }),
                zIndex: 1,
                background: "var(--surface-1)", border: "1px solid var(--border-strong)",
                borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-lg)",
                padding: 4, minWidth: 180,
              }}
              onMouseEnter={() => setShowProjPicker(true)}
              onMouseLeave={() => setShowProjPicker(false)}
            >
              <div style={{ padding: "5px 10px 3px", fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--fg-4)", borderBottom: "1px solid var(--border-subtle)", marginBottom: 4 }}>
                Move to project
              </div>
              {projects.map(p => (
                <div key={p.id} className="ctx-item"
                  style={{ fontWeight: p.id === projectId ? 700 : undefined }}
                  onMouseDown={e => { e.stopPropagation(); onChangeProject(id, p.id); onClose(); }}
                >
                  {p.id === projectId && <span style={{ color: "var(--accent-text)", marginRight: 6, fontSize: 11 }}>✓</span>}
                  {p.name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Task details — notes + attached links (tasks only) */}
      {type === "task" && (
        <button className="ctx-item" onClick={() => { onViewTaskDetails(id); onClose(); }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
          Task details
        </button>
      )}

      <button className="ctx-item" onClick={() => {
        if (type === "task") { onViewTaskHistory(id); } else { onViewHistory(projectId); }
        onClose();
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        View history
      </button>
      {type === "project" && (
        <button className="ctx-item" onClick={() => { onArchive(id); onClose(); }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/></svg>
          Archive
        </button>
      )}
      <div className="ctx-sep" />
      <button className="ctx-item danger" onClick={() => { onDelete(id, type); onClose(); }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
        Delete
      </button>
    </div>,
    document.body,
  );
}

// ── StatusPortal ─────────────────────────────────────────────────────────────

interface StatusPortalProps {
  rect: DOMRect;
  kind: "project" | "task";
  onSelect: (status: TaskStatus | ProjectStatus) => void;
  onClose: () => void;
}

function StatusPortal({ rect, kind, onSelect, onClose }: StatusPortalProps) {
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
      {(kind === "project" ? PROJECT_STATUSES : TASK_STATUSES).map(({ value, label, dot }) => (
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
  boardOwnerId, roles, projects, tasks, effortMap, capacityMap, dateRange, weeks, onRunCascade,
  onDeleteProject, onDeleteTask, onRowHistoryClick, onChangeTaskProject,
  selectedRowIds, onDateRangeChange, onToggleSelect, onReorder,
  onUpdateProject, onAddTask, onUpdateTask, onUpsertEffort, onUpsertCapacity,
  onArchiveProject,
}: Props) {
  const [statusTarget,   setStatusTarget]   = useState<{ rect: DOMRect; id: string; type: "project" | "task" } | null>(null);
  const [detailsTask, setDetailsTask] = useState<{ task: Task; tab: "details" | "changes" | "mandays" } | null>(null);
  const [editingId,         setEditingId]         = useState<string | null>(null);
  const [editingName,       setEditingName]       = useState("");
  const [ctxMenu,           setCtxMenu]           = useState<CtxState | null>(null);
  const [taskPriTarget,     setTaskPriTarget]     = useState<{ rect: DOMRect; task: Task } | null>(null);
  const [editingEtaId,      setEditingEtaId]      = useState<string | null>(null);
  const [editingEtaValue,   setEditingEtaValue]   = useState("");
  const [featColWidth,   setFeatColWidth]   = useState(260);
  const resizeDrag = useRef<{ startX: number; startW: number } | null>(null);
  // Computed offsets for dependent sticky cols
  const priLeft = 64 + featColWidth;
  const etaLeft = priLeft + 52;
  const totLeft = etaLeft + 76;

  // Sticky summary rows must stack directly below the sticky header with no
  // gap — measure actual rendered heights instead of guessing pixel values,
  // since fonts/zoom can shift them and leave a visible seam.
  const theadRef     = useRef<HTMLTableSectionElement>(null);
  const theadWeekRef = useRef<HTMLTableRowElement>(null);
  const sumRowRef    = useRef<HTMLTableRowElement>(null);
  const [sumRowMetrics, setSumRowMetrics] = useState({ topBase: 61, rowHeight: 33 });
  const [weekRowHeight, setWeekRowHeight] = useState(33);

  useEffect(() => {
    const measure = () => {
      const topBase   = theadRef.current?.getBoundingClientRect().height;
      const rowHeight = sumRowRef.current?.getBoundingClientRect().height;
      const weekH     = theadWeekRef.current?.getBoundingClientRect().height;
      if (!topBase || !rowHeight) return;
      setSumRowMetrics(prev =>
        (prev.topBase === topBase && prev.rowHeight === rowHeight) ? prev : { topBase, rowHeight }
      );
      if (weekH) setWeekRowHeight(prev => prev === weekH ? prev : weekH);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (theadRef.current)     ro.observe(theadRef.current);
    if (theadWeekRef.current) ro.observe(theadWeekRef.current);
    if (sumRowRef.current)    ro.observe(sumRowRef.current);
    return () => ro.disconnect();
  }, [roles, weeks, featColWidth]);

  const openCtx = (e: React.MouseEvent, id: string, type: "project" | "task", projectId: string, isArchived: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, id, type, projectId, isArchived });
  };

  // ── Drag & Drop ────────────────────────────────────────────────────────────
  const dragSrc       = useRef<{ id: string; type: "project" | "task" } | null>(null);
  const scrollTimer   = useRef<ReturnType<typeof setInterval> | null>(null);
  const gridViewRef   = useRef<HTMLDivElement>(null);
  const [draggingId,   setDraggingId]   = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const stopAutoScroll = () => {
    if (scrollTimer.current) { clearInterval(scrollTimer.current); scrollTimer.current = null; }
  };

  const startAutoScroll = (direction: "up" | "down", speed: number) => {
    stopAutoScroll();
    scrollTimer.current = setInterval(() => {
      gridViewRef.current?.scrollBy(0, direction === "down" ? speed : -speed);
    }, 16);
  };

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
    // Auto-scroll near grid edges
    const el = gridViewRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const zone = 64;
    const y = e.clientY;
    if (y < rect.top + zone) {
      startAutoScroll("up",   Math.max(4, Math.round((zone - (y - rect.top))    / 6)));
    } else if (y > rect.bottom - zone) {
      startAutoScroll("down", Math.max(4, Math.round((zone - (rect.bottom - y)) / 6)));
    } else {
      stopAutoScroll();
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDropTargetId(null);
    const src = dragSrc.current;
    if (!src || src.id === targetId) return;

    // Flat task reorder — freely cross project boundaries
    const _sortedProjects = [...projects].sort((a, b) => a.priority_order - b.priority_order);
    const _sortedTasks    = [...tasks].sort((a, b) => a.priority_order - b.priority_order);
    const srcIdx = _sortedTasks.findIndex(t => t.id === src.id);
    const tgtIdx = _sortedTasks.findIndex(t => t.id === targetId);
    if (srcIdx >= 0 && tgtIdx >= 0) {
      const reordered = [..._sortedTasks];
      const [moved] = reordered.splice(srcIdx, 1);
      reordered.splice(tgtIdx > srcIdx ? tgtIdx - 1 : tgtIdx, 0, moved);
      onReorder(_sortedProjects.map(p => p.id), reordered.map(t => t.id));
    }
  };

  // ── Flat task list (Option A — no project headers) ──────────────────────
  const sortedProjects = [...projects].sort((a, b) => a.priority_order - b.priority_order);
  const sortedTasks    = [...tasks].sort((a, b) => a.priority_order - b.priority_order);

  // Project colour map for badges (consistent across renders)
  const PROJECT_BADGE_COLORS = [
    { bg: "rgba(22,162,104,.12)",  text: "#0e7a4e",  border: "rgba(22,162,104,.3)"  },
    { bg: "rgba(59,130,246,.12)",  text: "#1d4ed8",  border: "rgba(59,130,246,.3)"  },
    { bg: "rgba(139,92,246,.12)",  text: "#6d28d9",  border: "rgba(139,92,246,.3)"  },
    { bg: "rgba(183,134,11,.12)",  text: "#876200",  border: "rgba(183,134,11,.3)"  },
    { bg: "rgba(6,182,212,.12)",   text: "#0e7490",  border: "rgba(6,182,212,.3)"   },
    { bg: "rgba(236,72,153,.12)",  text: "#be185d",  border: "rgba(236,72,153,.3)"  },
  ];
  const projColorMap = Object.fromEntries(
    sortedProjects.map((p, i) => [p.id, PROJECT_BADGE_COLORS[i % PROJECT_BADGE_COLORS.length]])
  );

  const allTaskIds = sortedTasks.map(t => t.id);

  // ── Detect threshold breaches (cascade needed) ────────────────────────────
  // Show cascade banner when buffer drops below the configured min threshold.
  // Weeks without explicitly set capacity are ignored.
  const thresholdBreachCount = weeks.reduce((count, w) =>
    count + roles.filter(role => {
      const s = computeWeekRoleSummary(role.id, w, capacityMap, effortMap, allTaskIds);
      return s.capacity > 0 && s.buffer < s.bufferThreshold;
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

      {/* Cascade banner — shows when any role/week is below its min buffer threshold */}
      {thresholdBreachCount > 0 && (
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
            {thresholdBreachCount} role{thresholdBreachCount > 1 ? "s" : ""} below min buffer threshold
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
      <div className="grid-view" ref={gridViewRef}>
        <table className="planner-table">
          <thead ref={theadRef}>
            {/* Week headers */}
            <tr ref={theadWeekRef} className="thead-week">
              <th className="col-cb th-sticky" style={{ left: 0 }} />
              <th className="col-drag th-sticky" style={{ left: 36 }} />
              {/* Resizable Feature/Task column — inline style overrides CSS default width */}
              <th className="col-feat th-sticky th-col-header"
                style={{ width: featColWidth, minWidth: featColWidth, position: "sticky", left: 64 }}>
                Feature / Task
              </th>
              <th className="col-pri th-sticky th-col-header center" style={{ left: priLeft }}>Pri</th>
              <th className="col-eta th-sticky th-col-header" style={{ left: etaLeft }}>ETA</th>
              {/* Resize handle lives on col-tot — the freeze panel boundary — so the drag target
                  and visual separator are at the same position (right edge of the frozen area). */}
              <th className="col-tot th-sticky th-col-header center" style={{ left: totLeft }}>
                Total<br /><span style={{ fontSize: 9 }}>effort</span>
                <div
                  style={{
                    position: "absolute", top: 0, right: 0, bottom: 0, width: 8,
                    cursor: "col-resize", zIndex: 13,
                    background: "transparent",
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    resizeDrag.current = { startX: e.clientX, startW: featColWidth };
                    const onMove = (me: MouseEvent) => {
                      if (!resizeDrag.current) return;
                      const delta = me.clientX - resizeDrag.current.startX;
                      setFeatColWidth(Math.max(120, resizeDrag.current.startW + delta));
                    };
                    const onUp = () => {
                      resizeDrag.current = null;
                      window.removeEventListener("mousemove", onMove);
                      window.removeEventListener("mouseup", onUp);
                    };
                    window.addEventListener("mousemove", onMove);
                    window.addEventListener("mouseup", onUp);
                  }}
                />
              </th>
              {weeks.map((w, i) => (
                <th key={w} colSpan={roles.length} className={cn("th-week-group", i === 0 && "first")}>
                  {/* Plain centered label — stays still in its own column and scrolls with the
                      grid like the rest of the timeline (no sticky-follow toward the freeze line). */}
                  <span className="th-week-date">{formatWeekRange(w)}</span>
                </th>
              ))}
            </tr>
            {/* Role sub-headers */}
            <tr className="thead-role" style={{ top: weekRowHeight }}>
              <th className="col-cb th-sticky" style={{ left: 0 }} />
              <th className="col-drag th-sticky" style={{ left: 36 }} />
              <th className="col-feat th-sticky" style={{ width: featColWidth, minWidth: featColWidth, left: 64 }} />
              <th className="col-pri th-sticky" style={{ left: priLeft }} />
              <th className="col-eta th-sticky" style={{ left: etaLeft }} />
              <th className="col-tot th-sticky" style={{ left: totLeft }} />
              {weeks.map((w, wi) =>
                roles.map((role, ri) => (
                  <th
                    key={`${w}-${role.id}`}
                    className={cn("th-role", ri === 0 && "first")}
                    style={{ color: role.color, background: solidTint(role.color, 0.32) }}
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
              featColWidth={featColWidth}
              priLeft={priLeft}
              etaLeft={etaLeft}
              totLeft={totLeft}
              topBase={sumRowMetrics.topBase}
              rowHeight={sumRowMetrics.rowHeight}
              firstRowRef={sumRowRef}
            />

            {/* ── Flat task list (Option A) ── */}
            {sortedTasks.map((task) => {
              const id           = task.id;
              const proj         = sortedProjects.find(p => p.id === task.project_id);
              const projColor    = proj ? projColorMap[proj.id] : { bg: "var(--surface-3)", text: "var(--fg-4)", border: "var(--border-subtle)" };
              const isSelected   = selectedRowIds.has(id);
              const isDragging   = draggingId === id;
              const isDropTarget = dropTargetId === id;
              const totalEffort  = getTaskTotalEffort(task.id, effortMap);

              return (
                <tr
                  key={id}
                  className={cn("row-task", isSelected && "row-selected", isDragging && "row-dragging", isDropTarget && "row-drop-target")}
                  draggable
                  onContextMenu={(e) => openCtx(e, id, "task", task.project_id, task.is_archived)}
                  onDragStart={() => handleDragStart(id, "task")}
                  onDragOver={(e) => handleDragOver(e, id)}
                  onDrop={(e) => handleDrop(e, id)}
                  onDragEnd={() => { setDropTargetId(null); setDraggingId(null); dragSrc.current = null; stopAutoScroll(); }}
                >
                  <td className="col-cb cb-cell" style={{ left: 0 }}>
                    <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(id)} />
                  </td>
                  <td className="col-drag drag-handle" style={{ left: 36 }}>⠿</td>
                  <td className="col-feat" style={{ width: featColWidth, minWidth: featColWidth, left: 64 }}>
                    <div className="feat-cell feat-cell-stacked">
                      {/* Line 1 — task name gets the full row width to itself */}
                      <div className="feat-line-name">
                        {editingId === task.id ? (
                          <input
                            autoFocus
                            className="feat-name"
                            style={{ background: "transparent", border: "none", outline: "1px solid var(--accent-border)", borderRadius: 3, padding: "0 2px", fontSize: 12.5, flex: 1, minWidth: 0, maxWidth: "none", color: "var(--fg-2)" }}
                            value={editingName}
                            onChange={e => setEditingName(e.target.value)}
                            onBlur={() => { if (editingName.trim()) onUpdateTask(task.id, { name: editingName.trim() }); setEditingId(null); }}
                            onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditingId(null); }}
                            onClick={e => e.stopPropagation()}
                          />
                        ) : (
                          <span className="feat-name feat-name-full"
                            onDoubleClick={e => { e.stopPropagation(); setEditingId(task.id); setEditingName(task.name); }}
                            title={task.name}>
                            {task.name}
                          </span>
                        )}
                      </div>
                      {/* Line 2 — project badge + status, each with their own room to breathe */}
                      <div className="feat-line-meta">
                        {proj && (
                          <span
                            title={proj.name}
                            className="proj-badge"
                            style={{
                              background: projColor.bg, border: `1px solid ${projColor.border}`,
                              color: projColor.text,
                            }}
                            onClick={() => onRowHistoryClick(proj.id)}
                          >
                            {proj.name}
                          </span>
                        )}
                        <button
                          className={cn("inline-status", STATUS_CSS[task.status])}
                          onClick={e => { e.stopPropagation(); setStatusTarget({ rect: e.currentTarget.getBoundingClientRect(), id, type: "task" }); }}
                        >
                          <span className="st-dot" style={{ background: STATUS_DOT_COLOR[task.status] }} />
                          {STATUS_LABEL[task.status]}
                        </button>
                        {/* Details indicator — shows when the task has notes and/or links; opens the details modal */}
                        {(task.notes?.trim() || (task.links?.length ?? 0) > 0) && (
                          <button
                            className="task-detail-chip"
                            title="View task details"
                            onClick={e => { e.stopPropagation(); setDetailsTask({ task, tab: "details" }); }}
                          >
                            {task.notes?.trim() && <FileText size={11} />}
                            {(task.links?.length ?? 0) > 0 && (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                                <Link2 size={11} />{task.links!.length}
                              </span>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                  {/* Priority — per-task label, clickable */}
                  <td className="col-pri" style={{ padding: "0 6px", left: priLeft }}>
                    {(() => {
                      // Resolve: task's own label takes precedence, fallback to project's
                      const label: "P1"|"P2"|"P3" = task.priority_label
                        ?? (proj ? resolveLabel(proj, sortedProjects.indexOf(proj)) : "P3");
                      return (
                        <button
                          type="button"
                          className={PRI_CLASS[label]}
                          style={{ border: "none", cursor: "pointer", background: "none", padding: "2px 7px" }}
                          title="Click to change priority label"
                          onClick={e => { e.stopPropagation(); setTaskPriTarget({ rect: e.currentTarget.getBoundingClientRect(), task }); }}
                        >
                          {label}
                        </button>
                      );
                    })()}
                  </td>
                  <td className="col-eta eta-cell" style={{ left: etaLeft }}>{(() => {
                    // Show derived ETA (last effort week Friday) unless a manual ETA overrides it
                    const derived = deriveTaskEta(task.id, effortMap);
                    const eta = task.eta ?? derived;
                    const isManual = !!task.eta;

                    if (editingEtaId === task.id) {
                      return (
                        <input
                          type="date"
                          autoFocus
                          className="eta-edit-input"
                          value={editingEtaValue}
                          onChange={e => setEditingEtaValue(e.target.value)}
                          onClick={e => e.stopPropagation()}
                          onBlur={() => {
                            const before = task.eta ?? "";
                            const next = editingEtaValue;
                            setEditingEtaId(null);
                            if (next === before) return;
                            onUpdateTask(task.id, { eta: next || null }, {
                              project_id: task.project_id,
                              task_id: task.id,
                              change_type: "eta_change",
                              field_name: "eta",
                              old_value: before || "auto",
                              new_value: next || "auto",
                              notes: task.name,
                            });
                          }}
                          onKeyDown={e => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                            if (e.key === "Escape") setEditingEtaId(null);
                          }}
                        />
                      );
                    }

                    return (
                      <span
                        className="eta-display"
                        title={
                          eta
                            ? isManual
                              ? "Manually set — double-click to change, clear to go back to auto"
                              : "Auto-derived from the last week with effort allocated — double-click to override"
                            : "Double-click to set an ETA"
                        }
                        onDoubleClick={e => {
                          e.stopPropagation();
                          setEditingEtaValue(task.eta ?? derived ?? "");
                          setEditingEtaId(task.id);
                        }}
                      >
                        {eta ? new Date(eta + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                        {isManual && <span className="eta-manual-dot" />}
                      </span>
                    );
                  })()}</td>
                  <td className="col-tot total-cell" style={{ left: totLeft }}>{totalEffort > 0 ? totalEffort : "—"}</td>
                  {weeks.map((w) =>
                    roles.map((role, ri) => (
                      <EffortInput key={`${w}-${role.id}`}
                        taskId={task.id} roleId={role.id} roleIdx={ri}
                        weekStart={w} isWeekStart={ri === 0}
                        effortMap={effortMap} onBlur={onUpsertEffort}
                      />
                    ))
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Task priority label dropdown */}
      {taskPriTarget && (
        <PriorityPortal
          rect={taskPriTarget.rect}
          current={taskPriTarget.task.priority_label
            ?? ((() => {
              const p = sortedProjects.find(pr => pr.id === taskPriTarget.task.project_id);
              return p ? resolveLabel(p, sortedProjects.indexOf(p)) : "P3";
            })())}
          onClose={() => setTaskPriTarget(null)}
          onSelect={(label) =>
            onUpdateTask(taskPriTarget.task.id, { priority_label: label as "P1"|"P2"|"P3" }, {
              task_id: taskPriTarget.task.id,
              project_id: taskPriTarget.task.project_id,
              change_type: "priority_change",
              field_name: "priority_label",
              old_value: taskPriTarget.task.priority_label ?? undefined,
              new_value: label,
              notes: taskPriTarget.task.name,
            })
          }
        />
      )}

      {/* Context menu */}
      {ctxMenu && (
        <ContextMenu
          {...ctxMenu}
          projects={sortedProjects}
          onClose={() => setCtxMenu(null)}
          onEditName={() => {
            const item = projects.find(p => p.id === ctxMenu.id) ?? tasks.find(t => t.id === ctxMenu.id);
            setEditingId(ctxMenu.id);
            setEditingName(item?.name ?? "");
          }}
          onViewHistory={onRowHistoryClick}
          onViewTaskHistory={(taskId) => {
            const t = tasks.find(t => t.id === taskId);
            if (t) setDetailsTask({ task: t, tab: "changes" });
          }}
          onViewTaskDetails={(taskId) => {
            const t = tasks.find(t => t.id === taskId);
            if (t) setDetailsTask({ task: t, tab: "details" });
          }}
          onArchive={onArchiveProject}
          onDelete={(id, type) => {
            if (!window.confirm("Delete this item? This cannot be undone.")) return;
            if (type === "project") onDeleteProject(id);
            else onDeleteTask(id);
          }}
          onChangeProject={(taskId, newProjectId) =>
            onChangeTaskProject(taskId, newProjectId)
          }
        />
      )}


      {/* Task details modal (Details / Changes / Mandays tabs) */}
      {detailsTask && (
        <TaskDetailsModal
          task={detailsTask.task}
          initialTab={detailsTask.tab}
          boardOwnerId={boardOwnerId}
          roles={roles}
          onUpdateTask={onUpdateTask}
          onClose={() => setDetailsTask(null)}
        />
      )}

      {/* Status portal */}
      {statusTarget && (
        <StatusPortal
          rect={statusTarget.rect}
          kind={statusTarget.type}
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
  /** Live sticky-column geometry — must match the header/body cells exactly or the columns drift apart on horizontal scroll. */
  featColWidth: number;
  priLeft: number;
  etaLeft: number;
  totLeft: number;
  /** Measured height of the sticky thead — first summary row sticks right below it. */
  topBase: number;
  /** Measured height of a summary row — each subsequent row stacks by this amount. */
  rowHeight: number;
  /** Attached to the first row so its rendered height can be measured. */
  firstRowRef: React.RefObject<HTMLTableRowElement | null>;
}

function SummaryRows({ roles, weeks, allTaskIds, capacityMap, effortMap, onUpsertCapacity, featColWidth, priLeft, etaLeft, totLeft, topBase, rowHeight, firstRowRef }: SummaryRowsProps) {
  const topFor = (i: number) => topBase + i * rowHeight;

  const featStyle: React.CSSProperties = { width: featColWidth, minWidth: featColWidth, left: 64 };
  const priStyle:  React.CSSProperties = { left: priLeft };
  const etaStyle:  React.CSSProperties = { left: etaLeft };
  const totStyle:  React.CSSProperties = { left: totLeft };

  const emptySticky = (
    <>
      <td className="col-cb" style={{ left: 0 }} />
      <td className="col-drag" style={{ left: 36 }} />
    </>
  );

  return (
    <>
      {/* Capacity — sticks directly below the header; top measured at runtime */}
      <tr ref={firstRowRef} className="row-sum" style={{ top: topFor(0) }}>
        {emptySticky}
        <td className="col-feat" style={{ ...featStyle, padding: "0 10px" }}><span className="sum-label">Capacity (mandays)</span></td>
        <td className="col-pri" style={priStyle} /><td className="col-eta" style={etaStyle} /><td className="col-tot" style={totStyle} />
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
      <tr className="row-sum row-sum-req" style={{ top: topFor(1) }}>
        {emptySticky}
        <td className="col-feat" style={{ ...featStyle, padding: "0 10px" }}>
          <span className="sum-label sum-label-req">Total Required</span>
        </td>
        <td className="col-pri" style={priStyle} /><td className="col-eta" style={etaStyle} /><td className="col-tot" style={totStyle} />
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
      <tr className="row-sum" style={{ top: topFor(2) }}>
        {emptySticky}
        <td className="col-feat" style={{ ...featStyle, padding: "0 10px" }}><span className="sum-label">Taken (other squad)</span></td>
        <td className="col-pri" style={priStyle} /><td className="col-eta" style={etaStyle} /><td className="col-tot" style={totStyle} />
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
      <tr className="row-sum" style={{ top: topFor(3) }}>
        {emptySticky}
        <td className="col-feat" style={{ ...featStyle, padding: "0 10px" }}><span className="sum-label">Holiday / Day-off</span></td>
        <td className="col-pri" style={priStyle} /><td className="col-eta" style={etaStyle} /><td className="col-tot" style={totStyle} />
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
      <tr className="row-sum" style={{ top: topFor(4) }}>
        {emptySticky}
        <td className="col-feat" style={{ ...featStyle, padding: "0 10px" }}><span className="sum-label">Buffer / Shortage</span></td>
        <td className="col-pri" style={priStyle} /><td className="col-eta" style={etaStyle} /><td className="col-tot" style={totStyle} />
        {weeks.map((w, wi) =>
          roles.map((role, ri) => {
            const s = computeWeekRoleSummary(role.id, w, capacityMap, effortMap, allTaskIds);
            const isBelowThreshold = s.capacity > 0 && s.buffer < s.bufferThreshold;
            const isNegative       = s.capacity > 0 && s.buffer < 0;
            const cls = isNegative ? "buf-neg buf-neg-bg" : isBelowThreshold ? "buf-warn" : "buf-pos";
            return (
              <td key={`${w}-${role.id}`} className={cn("sum-val", cls, ri === 0 && "wk-start")}>
                {s.buffer > 0 ? `+${s.buffer}` : s.buffer < 0 ? s.buffer : "—"}
              </td>
            );
          })
        )}
      </tr>

      {/* Min Buffer Threshold */}
      <tr className="row-sum row-sum-thr row-sum-last" style={{ top: topFor(5) }}>
        {emptySticky}
        <td className="col-feat" style={{ ...featStyle, padding: "0 10px" }}>
          <span className="sum-label sum-label-thr">Min Buffer Threshold</span>
          <span className="sum-note">cascade trigger ↓</span>
        </td>
        <td className="col-pri" style={priStyle} /><td className="col-eta" style={etaStyle} /><td className="col-tot" style={totStyle} />
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
      {roles.map((role) => (
        <button
          key={role.id}
          className="filter-chip active"
          style={{ background: solidTint(role.color), borderColor: `${role.color}60`, color: role.color }}
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
