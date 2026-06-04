"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Role, Project, Task, EffortMap, CapacityMap, PlannerDateRange } from "./types";
import { HistoryEntry } from "./queries";
import { formatWeekRange, computeWeekRoleSummary, getTaskTotalEffort } from "./utils";
import { cn } from "@/lib/cn";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  roles: Role[];
  projects: Project[];   // active projects
  tasks: Task[];         // all active tasks across projects
  effortMap: EffortMap;
  capacityMap: CapacityMap;
  weeks: string[];
  dateRange: PlannerDateRange;
  selectedRowIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onReorder: (projectIds: string[], taskIds: string[], history?: HistoryEntry[]) => void;
  onUpdateTask: (id: string, patch: Partial<Pick<Task, "name" | "status" | "priority_order" | "project_id">>, history?: HistoryEntry) => void;
  onUpsertEffort: (taskId: string, roleId: string, weekStart: string, mandays: number, oldMandays: number) => void;
  onUpsertCapacity: (roleId: string, weekStart: string, field: "capacity" | "taken_other" | "holiday" | "buffer_threshold", value: number) => void;
  onDateRangeChange: (range: PlannerDateRange) => void;
  onDeleteTask: (id: string) => void;
  onRowHistoryClick: (projectId: string) => void;
}

// ── Priority label per task ───────────────────────────────────────────────────
const PRI_LEVELS = ["P1", "P2", "P3"] as const;
type PriLabel = typeof PRI_LEVELS[number];

const PRI_CLASS: Record<PriLabel, string> = {
  P1: "pri-badge pri-1",
  P2: "pri-badge pri-2",
  P3: "pri-badge pri-3",
};

// Each task can have its own priority label stored in its name metadata for now.
// We'll derive a default from position and allow override via a small dropdown.
function defaultPriLabel(idx: number): PriLabel {
  if (idx === 0) return "P1";
  if (idx === 1) return "P2";
  return "P3";
}

// ── Project colour map (for badges) ──────────────────────────────────────────
const PROJECT_COLORS = [
  { bg: "rgba(22,162,104,.12)",  text: "#0e7a4e",  border: "rgba(22,162,104,.3)"  },
  { bg: "rgba(59,130,246,.12)",  text: "#1d4ed8",  border: "rgba(59,130,246,.3)"  },
  { bg: "rgba(139,92,246,.12)",  text: "#6d28d9",  border: "rgba(139,92,246,.3)"  },
  { bg: "rgba(183,134,11,.12)",  text: "#876200",  border: "rgba(183,134,11,.3)"  },
  { bg: "rgba(6,182,212,.12)",   text: "#0e7490",  border: "rgba(6,182,212,.3)"   },
  { bg: "rgba(236,72,153,.12)",  text: "#be185d",  border: "rgba(236,72,153,.3)"  },
];

const ROLE_EC_CLASS = ["ec-be", "ec-fw", "ec-fa", "ec-fi", "ec-qa"];

// ── CapInput (same as in planner-grid) ────────────────────────────────────────
function CapInput({ value, isWeekStart, onChange, className }: { value: number; isWeekStart?: boolean; onChange: (v: number) => void; className?: string }) {
  const [local, setLocal] = useState(value > 0 ? String(value) : "");
  return (
    <td className={cn("sum-val", isWeekStart && "wk-start")}>
      <input
        className={cn("cap-input", className)}
        type="text" inputMode="decimal" value={local} placeholder="–"
        onChange={e => setLocal(e.target.value)}
        onBlur={() => onChange(parseFloat(local) || 0)}
        onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      />
    </td>
  );
}

// ── EffortInput ───────────────────────────────────────────────────────────────
function EffortInput({ taskId, roleId, roleIdx, weekStart, isWeekStart, effortMap, onBlur }: {
  taskId: string; roleId: string; roleIdx: number; weekStart: string;
  isWeekStart: boolean; effortMap: EffortMap;
  onBlur: (t: string, r: string, w: string, v: number, old: number) => void;
}) {
  const current = effortMap[taskId]?.[roleId]?.[weekStart] ?? 0;
  const [val, setVal] = useState(current > 0 ? String(current) : "");
  const ecClass = ROLE_EC_CLASS[roleIdx % ROLE_EC_CLASS.length];
  return (
    <td className={cn("effort-cell", ecClass, isWeekStart && "wk-start")}>
      <input type="text" inputMode="decimal" value={val} placeholder="–"
        onChange={e => setVal(e.target.value)}
        onBlur={() => onBlur(taskId, roleId, weekStart, parseFloat(val) || 0, current)}
        onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      />
    </td>
  );
}

// ── Priority Dropdown ─────────────────────────────────────────────────────────
function PriDropdown({ rect, current, onSelect, onClose }: {
  rect: DOMRect; current: PriLabel;
  onSelect: (p: PriLabel) => void; onClose: () => void;
}) {
  return createPortal(
    <div className="status-portal" style={{ position: "fixed", top: rect.bottom + 4, left: rect.left, minWidth: 90 }}
      onMouseDown={e => e.stopPropagation()}>
      <div style={{ padding: "5px 10px 3px", fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--fg-4)", borderBottom: "1px solid var(--border-subtle)", marginBottom: 4 }}>
        Set Priority
      </div>
      {PRI_LEVELS.map(p => (
        <div key={p} className="status-portal-item"
          style={{ fontWeight: p === current ? 700 : undefined }}
          onMouseDown={e => { e.stopPropagation(); onSelect(p); onClose(); }}>
          <span className={PRI_CLASS[p]} style={{ padding: "1px 7px", fontSize: 10 }}>{p}</span>
          {p === current && <span style={{ marginLeft: "auto", color: "var(--accent-text)", fontSize: 10 }}>✓</span>}
        </div>
      ))}
    </div>,
    document.body,
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function PlannerPriorityView({
  roles, projects, tasks, effortMap, capacityMap, weeks, dateRange,
  selectedRowIds, onToggleSelect, onReorder, onUpdateTask,
  onUpsertEffort, onUpsertCapacity, onDateRangeChange,
  onDeleteTask, onRowHistoryClick,
}: Props) {
  // Task priority labels stored locally (could be persisted later)
  const [taskPriLabels, setTaskPriLabels] = useState<Record<string, PriLabel>>({});
  const [priDropTarget, setPriDropTarget] = useState<{ rect: DOMRect; taskId: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [featColWidth, setFeatColWidth] = useState(220);
  const resizeDrag = useRef<{ startX: number; startW: number } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const dragSrc = useRef<string | null>(null);

  const sortedTasks = [...tasks].sort((a, b) => a.priority_order - b.priority_order);
  const allTaskIds  = sortedTasks.map(t => t.id);

  // Project colour lookup
  const projColorMap = Object.fromEntries(
    [...projects].sort((a, b) => a.priority_order - b.priority_order)
      .map((p, i) => [p.id, PROJECT_COLORS[i % PROJECT_COLORS.length]])
  );

  // Project total mandays summary
  const projTotals = Object.fromEntries(
    projects.map(p => [p.id, tasks.filter(t => t.project_id === p.id)
      .reduce((s, t) => s + getTaskTotalEffort(t.id, effortMap), 0)])
  );

  // ── Drag handlers ────────────────────────────────────────────────────────
  const handleDragStart = (taskId: string) => { dragSrc.current = taskId; setDraggingId(taskId); };
  const handleDragOver  = (e: React.DragEvent, targetId: string) => { e.preventDefault(); setDropTargetId(targetId); };
  const handleDrop      = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDropTargetId(null);
    const src = dragSrc.current;
    if (!src || src === targetId) return;
    const reordered = [...sortedTasks];
    const srcIdx = reordered.findIndex(t => t.id === src);
    const tgtIdx = reordered.findIndex(t => t.id === targetId);
    const [moved] = reordered.splice(srcIdx, 1);
    reordered.splice(tgtIdx > srcIdx ? tgtIdx - 1 : tgtIdx, 0, moved);
    const sortedProjects = [...projects].sort((a, b) => a.priority_order - b.priority_order);
    onReorder(sortedProjects.map(p => p.id), reordered.map(t => t.id));
  };
  const handleDragEnd = () => { setDraggingId(null); setDropTargetId(null); dragSrc.current = null; };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
      {/* Toolbar */}
      <div className="planner-toolbar">
        <span className="toolbar-label">Filter</span>
        <button className="filter-chip active">All</button>
        <button className="filter-chip">P1</button>
        <button className="filter-chip">P2</button>
        <div className="toolbar-sep" />
        {roles.map(role => (
          <button key={role.id} className="filter-chip active"
            style={{ background: `${role.color}18`, borderColor: `${role.color}40`, color: role.color }}>
            {role.name}
          </button>
        ))}
        <div className="toolbar-right">
          <span className="toolbar-label">Start</span>
          <input type="date" className="date-pill" value={dateRange.start}
            onChange={e => onDateRangeChange({ ...dateRange, start: e.target.value })} />
          <span style={{ color: "var(--fg-4)", fontSize: 12 }}>→</span>
          <span className="toolbar-label">End</span>
          <input type="date" className="date-pill" value={dateRange.end}
            onChange={e => onDateRangeChange({ ...dateRange, end: e.target.value })} />
        </div>
      </div>

      {/* Project totals summary bar */}
      <div style={{
        padding: "6px 28px", background: "var(--surface-1)", borderBottom: "1px solid var(--border-subtle)",
        display: "flex", alignItems: "center", gap: 10, flexShrink: 0, flexWrap: "wrap",
      }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--fg-4)" }}>
          Project totals
        </span>
        {[...projects].sort((a, b) => a.priority_order - b.priority_order).map(p => {
          const col = projColorMap[p.id];
          return (
            <span key={p.id} style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "3px 10px", borderRadius: "var(--radius-full)",
              background: col.bg, border: `1px solid ${col.border}`, color: col.text,
              fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
            }}>
              {p.name}
              <span style={{ fontWeight: 400, opacity: 0.7 }}>{projTotals[p.id] || 0} md</span>
            </span>
          );
        })}
      </div>

      {/* Grid */}
      <div className="grid-view">
        <table className="planner-table" style={{ "--feat-w": `${featColWidth}px` } as React.CSSProperties}>
          <thead>
            <tr className="thead-week">
              <th className="col-cb th-sticky" />
              <th className="col-drag th-sticky" />
              <th className="col-feat th-sticky th-col-header" style={{ position: "relative" }}>
                Task
                {/* Resize handle */}
                <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 6, cursor: "col-resize", display: "flex", alignItems: "center", justifyContent: "center" }}
                  onMouseDown={e => {
                    e.preventDefault();
                    resizeDrag.current = { startX: e.clientX, startW: featColWidth };
                    const onMove = (me: MouseEvent) => { if (!resizeDrag.current) return; setFeatColWidth(Math.max(120, resizeDrag.current.startW + me.clientX - resizeDrag.current.startX)); };
                    const onUp   = () => { resizeDrag.current = null; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
                    window.addEventListener("mousemove", onMove);
                    window.addEventListener("mouseup", onUp);
                  }}>
                  <div style={{ width: 2, height: 16, background: "var(--border-strong)", borderRadius: 1, opacity: .6 }} />
                </div>
              </th>
              <th className="col-pri th-sticky th-col-header center">Pri</th>
              <th className="col-eta th-sticky th-col-header">ETA</th>
              <th className="col-tot th-sticky th-col-header center">Total<br /><span style={{ fontSize: 9 }}>effort</span></th>
              {weeks.map((w, i) => (
                <th key={w} colSpan={roles.length} className={cn("th-week-group", i === 0 && "first")}>
                  <span className="th-week-date">{formatWeekRange(w)}</span>
                </th>
              ))}
            </tr>
            <tr className="thead-role">
              <th className="col-cb th-sticky" /><th className="col-drag th-sticky" />
              <th className="col-feat th-sticky" /><th className="col-pri th-sticky" />
              <th className="col-eta th-sticky" /><th className="col-tot th-sticky" />
              {weeks.map(w => roles.map((role, ri) => (
                <th key={`${w}-${role.id}`} className={cn("th-role", ri === 0 && "first")}
                  style={{ color: role.color, background: `${role.color}18` }}>
                  {role.name}
                </th>
              )))}
            </tr>
          </thead>

          <tbody>
            {/* Summary rows — capacity/buffer */}
            <SummarySection
              roles={roles} weeks={weeks} allTaskIds={allTaskIds}
              capacityMap={capacityMap} effortMap={effortMap}
              onUpsertCapacity={onUpsertCapacity}
            />

            {/* Flat task list */}
            {sortedTasks.map((task, idx) => {
              const proj     = projects.find(p => p.id === task.project_id);
              const projCol  = proj ? projColorMap[proj.id] : PROJECT_COLORS[0];
              const priLabel = taskPriLabels[task.id] ?? defaultPriLabel(idx);
              const total    = getTaskTotalEffort(task.id, effortMap);
              const isDragging   = draggingId === task.id;
              const isDropTarget = dropTargetId === task.id;
              const isSelected   = selectedRowIds.has(task.id);

              return (
                <tr
                  key={task.id}
                  className={cn("row-task", isSelected && "row-selected", isDragging && "row-dragging", isDropTarget && "row-drop-target")}
                  draggable
                  onDragStart={() => handleDragStart(task.id)}
                  onDragOver={e => handleDragOver(e, task.id)}
                  onDrop={e => handleDrop(e, task.id)}
                  onDragEnd={handleDragEnd}
                  onContextMenu={e => {
                    e.preventDefault();
                    // Simple context menu: just open history for now
                    if (proj) onRowHistoryClick(proj.id);
                  }}
                >
                  <td className="col-cb cb-cell">
                    <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(task.id)} />
                  </td>
                  <td className="col-drag drag-handle">⠿</td>
                  <td className="col-feat">
                    <div className="feat-cell" style={{ gap: 6 }}>
                      {/* Project badge */}
                      {proj && (
                        <span style={{
                          fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600,
                          padding: "1px 6px", borderRadius: "var(--radius-full)",
                          background: projCol.bg, border: `1px solid ${projCol.border}`,
                          color: projCol.text, whiteSpace: "nowrap", flexShrink: 0,
                          maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis",
                        }} title={proj.name}>
                          {proj.name}
                        </span>
                      )}
                      {/* Task name (inline edit) */}
                      {editingId === task.id ? (
                        <input autoFocus className="feat-name"
                          style={{ background: "transparent", border: "none", outline: "1px solid var(--accent-border)", borderRadius: 3, padding: "0 2px", fontSize: 12.5, flex: 1, minWidth: 0, color: "var(--fg-2)" }}
                          value={editingName}
                          onChange={e => setEditingName(e.target.value)}
                          onBlur={() => { if (editingName.trim()) onUpdateTask(task.id, { name: editingName.trim() }); setEditingId(null); }}
                          onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditingId(null); }}
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <span className="feat-name"
                          onDoubleClick={e => { e.stopPropagation(); setEditingId(task.id); setEditingName(task.name); }}
                          title={task.name}>
                          {task.name}
                        </span>
                      )}
                    </div>
                  </td>
                  {/* Per-task priority (user-set, not derived from position) */}
                  <td className="col-pri" style={{ padding: "0 6px" }}>
                    <button
                      type="button"
                      className={PRI_CLASS[priLabel]}
                      style={{ border: "none", cursor: "pointer", background: "none", padding: "2px 7px" }}
                      onClick={e => { e.stopPropagation(); setPriDropTarget({ rect: e.currentTarget.getBoundingClientRect(), taskId: task.id }); }}
                      title="Click to change priority">
                      {priLabel}
                    </button>
                  </td>
                  <td className="col-eta eta-cell">
                    {task.eta ? new Date(task.eta + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                  </td>
                  <td className="col-tot total-cell">{total > 0 ? total : "—"}</td>
                  {weeks.map(w => roles.map((role, ri) => (
                    <EffortInput key={`${w}-${role.id}`}
                      taskId={task.id} roleId={role.id} roleIdx={ri}
                      weekStart={w} isWeekStart={ri === 0}
                      effortMap={effortMap} onBlur={onUpsertEffort}
                    />
                  )))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Priority dropdown */}
      {priDropTarget && (
        <PriDropdown
          rect={priDropTarget.rect}
          current={taskPriLabels[priDropTarget.taskId] ?? defaultPriLabel(sortedTasks.findIndex(t => t.id === priDropTarget.taskId))}
          onClose={() => setPriDropTarget(null)}
          onSelect={p => setTaskPriLabels(prev => ({ ...prev, [priDropTarget.taskId]: p }))}
        />
      )}
    </div>
  );
}

// ── Summary section (capacity/buffer rows) ────────────────────────────────────

function SummarySection({ roles, weeks, allTaskIds, capacityMap, effortMap, onUpsertCapacity }: {
  roles: Role[]; weeks: string[]; allTaskIds: string[];
  capacityMap: CapacityMap; effortMap: EffortMap;
  onUpsertCapacity: Props["onUpsertCapacity"];
}) {
  const empty = <><td className="col-cb" /><td className="col-drag" /></>;
  return (
    <>
      <tr className="row-sum">
        {empty}
        <td className="col-feat" style={{ padding: "0 10px" }}><span className="sum-label">Capacity (mandays)</span></td>
        <td className="col-pri" /><td className="col-eta" /><td className="col-tot" />
        {weeks.map(w => roles.map((role, ri) => (
          <CapInput key={`${w}-${role.id}`} value={capacityMap[role.id]?.[w]?.capacity ?? 0} isWeekStart={ri === 0}
            onChange={v => onUpsertCapacity(role.id, w, "capacity", v)} />
        )))}
      </tr>
      <tr className="row-sum row-sum-req">
        {empty}
        <td className="col-feat" style={{ padding: "0 10px" }}><span className="sum-label sum-label-req">Total Required</span></td>
        <td className="col-pri" /><td className="col-eta" /><td className="col-tot" />
        {weeks.map(w => roles.map((role, ri) => {
          const req = allTaskIds.reduce((s, tid) => s + (effortMap[tid]?.[role.id]?.[w] ?? 0), 0);
          return <td key={`${w}-${role.id}`} className={cn("sum-val sum-val-req", ri === 0 && "wk-start")}>{req > 0 ? req : "—"}</td>;
        }))}
      </tr>
      <tr className="row-sum row-sum-last">
        {empty}
        <td className="col-feat" style={{ padding: "0 10px" }}><span className="sum-label sum-label-thr">Buffer / Shortage</span></td>
        <td className="col-pri" /><td className="col-eta" /><td className="col-tot" />
        {weeks.map(w => roles.map((role, ri) => {
          const cap = capacityMap[role.id]?.[w];
          const cap_v = cap?.capacity ?? 0;
          const req   = allTaskIds.reduce((s, tid) => s + (effortMap[tid]?.[role.id]?.[w] ?? 0), 0);
          const buf   = cap_v - req - (cap?.taken_other ?? 0) - (cap?.holiday ?? 0);
          const neg   = cap_v > 0 && buf < 0;
          return (
            <td key={`${w}-${role.id}`} className={cn("sum-val", neg ? "buf-neg buf-neg-bg" : "buf-pos", ri === 0 && "wk-start")}>
              {buf > 0 ? `+${buf}` : buf < 0 ? buf : "—"}
            </td>
          );
        }))}
      </tr>
    </>
  );
}
