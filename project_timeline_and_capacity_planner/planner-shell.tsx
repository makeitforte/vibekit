"use client";

import { useEffect, useReducer, useCallback, useRef, useState } from "react";
import { LayoutGrid, GitBranch, Archive, History, Plus, Download, X, Share2 } from "lucide-react";
import { useProfiles } from "@/lib/profiles-context";

import {
  Role, Project, Task, WeeklyEffort, ResourceCapacity, ChangeHistory,
  PlannerView, PlannerDateRange, EffortMap, CapacityMap,
} from "./types";
import {
  fetchRoles, seedDefaultRoles, deleteRoleDuplicates,
  fetchProjects, createProject, updateProject, reorderProjects, archiveProject, deleteProject,
  fetchTasks, createTask, updateTask, reorderTasks, deleteTask,
  fetchWeeklyEfforts, upsertEffort, buildEffortMap,
  fetchResourceCapacity, upsertCapacity, buildCapacityMap,
  fetchHistory, addHistory, type HistoryEntry, ConflictError,
} from "./queries";
import { getWeekStarts, toWeekStart, formatWeekRange, runCascadeRecalculate } from "./utils";
import { PlannerGrid } from "./planner-grid";
import { AddDropdown } from "./add-dropdown";
import { exportToXlsx } from "./export-xlsx";
import { PlannerTimeline } from "./planner-timeline";
import { PlannerArchive } from "./planner-archive";
import { HistoryPanel } from "./history-panel";
import { ShareDialog } from "./share-dialog";
import { SegmentedControl } from "./ui/segmented-control";
import { Button } from "./ui/button";

// ── State ────────────────────────────────────────────────────────────────────

interface PlannerState {
  view: PlannerView;
  roles: Role[];
  projects: Project[];
  tasks: Task[];
  effortMap: EffortMap;
  capacityMap: CapacityMap;
  history: ChangeHistory[];
  dateRange: PlannerDateRange;
  historyProjectFilter: string | null; // null = all
  loading: boolean;
  error: string | null;
  selectedRowIds: Set<string>;
  isHistoryOpen: boolean;
}

type Action =
  | { type: "LOADED"; roles: Role[]; projects: Project[]; tasks: Task[]; efforts: WeeklyEffort[]; capacities: ResourceCapacity[]; history: ChangeHistory[] }
  | { type: "SET_VIEW"; view: PlannerView }
  | { type: "SET_DATE_RANGE"; range: PlannerDateRange }
  | { type: "SET_ROLES"; roles: Role[] }
  | { type: "SET_PROJECTS"; projects: Project[] }
  | { type: "SET_TASKS"; tasks: Task[] }
  | { type: "SET_EFFORTS"; efforts: WeeklyEffort[] }
  | { type: "SET_CAPACITIES"; capacities: ResourceCapacity[] }
  | { type: "SET_HISTORY"; history: ChangeHistory[] }
  | { type: "TOGGLE_HISTORY" }
  | { type: "SET_HISTORY_FILTER"; projectId: string | null }
  | { type: "TOGGLE_ROW_SELECT"; id: string }
  | { type: "CLEAR_SELECTION" }
  | { type: "SET_ERROR"; error: string }
  | { type: "SET_LOADING"; loading: boolean };

function getDefaultDateRange(): PlannerDateRange {
  const today = new Date();
  const startMonday = toWeekStart(today);
  const end = new Date(startMonday);
  end.setDate(end.getDate() + 6 * 7 - 3); // ~6 weeks
  return { start: startMonday, end: end.toISOString().slice(0, 10) };
}

function reducer(state: PlannerState, action: Action): PlannerState {
  switch (action.type) {
    case "LOADED":
      return {
        ...state,
        roles: action.roles,
        projects: action.projects,
        tasks: action.tasks,
        effortMap: buildEffortMap(action.efforts),
        capacityMap: buildCapacityMap(action.capacities),
        history: action.history,
        loading: false,
      };
    case "SET_VIEW":        return { ...state, view: action.view };
    case "SET_DATE_RANGE":  return { ...state, dateRange: action.range };
    case "SET_ROLES":       return { ...state, roles: action.roles };
    case "SET_PROJECTS":    return { ...state, projects: action.projects };
    case "SET_TASKS":       return { ...state, tasks: action.tasks };
    case "SET_EFFORTS":     return { ...state, effortMap: buildEffortMap(action.efforts) };
    case "SET_CAPACITIES":  return { ...state, capacityMap: buildCapacityMap(action.capacities) };
    case "SET_HISTORY":     return { ...state, history: action.history };
    case "TOGGLE_HISTORY": return { ...state, isHistoryOpen: !state.isHistoryOpen };
    case "SET_HISTORY_FILTER": return { ...state, historyProjectFilter: action.projectId };
    case "TOGGLE_ROW_SELECT": {
      const next = new Set(state.selectedRowIds);
      if (next.has(action.id)) next.delete(action.id);
      else next.add(action.id);
      return { ...state, selectedRowIds: next };
    }
    case "CLEAR_SELECTION": return { ...state, selectedRowIds: new Set() };
    case "SET_ERROR":       return { ...state, error: action.error, loading: false };
    case "SET_LOADING":     return { ...state, loading: action.loading };
    default:                return state;
  }
}

const INITIAL: PlannerState = {
  view: "grid",
  roles: [],
  projects: [],
  tasks: [],
  effortMap: {},
  capacityMap: {},
  history: [],
  dateRange: getDefaultDateRange(),
  historyProjectFilter: null,
  loading: true,
  error: null,
  selectedRowIds: new Set(),
  isHistoryOpen: false,
};

// ── Component ────────────────────────────────────────────────────────────────

interface PlannerShellProps {
  /** When viewing someone else's shared board, their user id — all data is scoped to this id. Defaults to the signed-in user (their own board). */
  boardOwnerId?: string;
}

export function PlannerShell({ boardOwnerId }: PlannerShellProps = {}) {
  const { user } = useProfiles();
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const userId = user?.id ?? null;
  // The board being displayed — your own board, or someone else's if you've joined via a share link.
  // `userId` always identifies the ACTOR (who performed an action, for history attribution);
  // `boardId` identifies whose data is being read/written.
  const boardId = boardOwnerId ?? userId;
  const isOwnBoard = boardId === userId;

  const [shareOpen, setShareOpen] = useState(false);

  // Surfaces "someone else changed this row" conflicts from optimistic-locked updates.
  const [conflictMsg, setConflictMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!conflictMsg) return;
    const t = setTimeout(() => setConflictMsg(null), 6000);
    return () => clearTimeout(t);
  }, [conflictMsg]);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId || !boardId) return;
    (async () => {
      try {
        let roles: Role[];
        if (isOwnBoard) {
          // Clean up any duplicate roles before fetching — only meaningful for your own board
          await deleteRoleDuplicates(boardId);
          roles = await fetchRoles(boardId);
          if (roles.length === 0) roles = await seedDefaultRoles(boardId);
        } else {
          roles = await fetchRoles(boardId);
        }

        const [projects, tasks, efforts, capacities, history] = await Promise.all([
          fetchProjects(boardId),
          fetchTasks(boardId),
          fetchWeeklyEfforts(boardId),
          fetchResourceCapacity(boardId),
          fetchHistory(boardId),
        ]);

        dispatch({ type: "LOADED", roles, projects, tasks, efforts, capacities, history });
      } catch (e) {
        dispatch({ type: "SET_ERROR", error: (e as Error).message });
      }
    })();
  }, [userId, boardId, isOwnBoard]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const weeks = getWeekStarts(state.dateRange);
  const activeProjects   = state.projects.filter(p => !p.is_archived);
  const archivedProjects = state.projects.filter(p => p.is_archived);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleAddProject = useCallback(async (name: string) => {
    if (!userId || !boardId || !name.trim()) return;
    const order = activeProjects.length;
    const proj = await createProject(boardId, name.trim(), order);
    dispatch({ type: "SET_PROJECTS", projects: [...state.projects, proj] });
    await addHistory(userId, boardId, { project_id: proj.id, change_type: "project_created", new_value: name.trim() });
  }, [userId, boardId, activeProjects.length, state.projects]);

  const handleUpdateProject = useCallback(async (
    id: string,
    patch: Partial<Pick<Project, "name" | "status" | "eta" | "notes" | "priority_order" | "priority_label">>,
    historyEntry?: HistoryEntry,
  ) => {
    if (!userId || !boardId) return;
    const before = state.projects.find(p => p.id === id);
    // Optimistic update first so UI responds immediately
    const updated = state.projects.map(p => p.id === id ? { ...p, ...patch } : p);
    dispatch({ type: "SET_PROJECTS", projects: updated });
    try {
      await updateProject(id, patch, before?.updated_at);
    } catch (e) {
      if (e instanceof ConflictError) {
        // Someone else changed this row first — discard our edit and reload the real data.
        dispatch({ type: "SET_PROJECTS", projects: await fetchProjects(boardId) });
        setConflictMsg(`"${before?.name ?? "Project"}" was just updated by someone else — your change was discarded and the latest data was reloaded.`);
      } else {
        dispatch({ type: "SET_PROJECTS", projects: state.projects });
        console.error("updateProject failed", e);
      }
      return;
    }
    if (historyEntry) {
      await addHistory(userId, boardId, historyEntry);
      const history = await fetchHistory(boardId);
      dispatch({ type: "SET_HISTORY", history });
    }
  }, [userId, boardId, state.projects]);

  const handleAddTask = useCallback(async (projectId: string, taskName?: string) => {
    if (!userId || !boardId) return;
    const name = taskName ?? window.prompt("Task name:");
    if (!name?.trim()) return;
    const maxOrder = state.tasks.length;
    const task = await createTask(boardId, projectId, name.trim(), maxOrder + 1);
    dispatch({ type: "SET_TASKS", tasks: [...state.tasks, task] });
    await addHistory(userId, boardId, { project_id: projectId, task_id: task.id, change_type: "task_created", new_value: name.trim() });
  }, [userId, boardId, state.tasks]);

  const handleUpdateTask = useCallback(async (
    id: string,
    patch: Partial<Pick<Task, "name" | "status" | "eta" | "notes" | "links" | "priority_order" | "project_id" | "priority_label">>,
    historyEntry?: HistoryEntry,
  ) => {
    if (!userId || !boardId) return;
    const before = state.tasks.find(t => t.id === id);
    // Optimistic update
    const updated = state.tasks.map(t => t.id === id ? { ...t, ...patch } : t);
    dispatch({ type: "SET_TASKS", tasks: updated });
    try {
      await updateTask(id, patch, before?.updated_at);
    } catch (e) {
      if (e instanceof ConflictError) {
        // Someone else changed this row first — discard our edit and reload the real data.
        dispatch({ type: "SET_TASKS", tasks: await fetchTasks(boardId) });
        setConflictMsg(`"${before?.name ?? "Task"}" was just updated by someone else — your change was discarded and the latest data was reloaded.`);
      } else {
        dispatch({ type: "SET_TASKS", tasks: state.tasks });
        console.error("updateTask failed", e);
      }
      return;
    }
    if (historyEntry) {
      await addHistory(userId, boardId, historyEntry);
      const history = await fetchHistory(boardId);
      dispatch({ type: "SET_HISTORY", history });
    }
  }, [userId, boardId, state.tasks]);

  const handleReorder = useCallback(async (
    orderedProjectIds: string[],
    orderedTaskIds: string[],
    historyEntries?: HistoryEntry[],
  ) => {
    if (!userId || !boardId) return;
    await Promise.all([
      reorderProjects(orderedProjectIds),
      reorderTasks(orderedTaskIds),
    ]);
    const projMap = Object.fromEntries(orderedProjectIds.map((id, i) => [id, i]));
    const taskMap = Object.fromEntries(orderedTaskIds.map((id, i) => [id, i]));
    dispatch({
      type: "SET_PROJECTS",
      projects: state.projects.map(p => ({ ...p, priority_order: projMap[p.id] ?? p.priority_order })),
    });
    dispatch({
      type: "SET_TASKS",
      tasks: state.tasks.map(t => ({ ...t, priority_order: taskMap[t.id] ?? t.priority_order })),
    });
    if (historyEntries) {
      for (const e of historyEntries) await addHistory(userId, boardId, e);
      const history = await fetchHistory(boardId);
      dispatch({ type: "SET_HISTORY", history });
    }
  }, [userId, boardId, state.projects, state.tasks]);

  const handleUpsertEffort = useCallback(async (
    taskId: string,
    roleId: string,
    weekStart: string,
    mandays: number,
    oldMandays: number,
  ) => {
    if (!userId || !boardId) return;
    await upsertEffort(taskId, roleId, boardId, weekStart, mandays);
    const efforts = await fetchWeeklyEfforts(boardId);
    dispatch({ type: "SET_EFFORTS", efforts });
    if (mandays !== oldMandays) {
      const task = state.tasks.find(t => t.id === taskId);
      const role = state.roles.find(r => r.id === roleId);
      await addHistory(userId, boardId, {
        project_id: task?.project_id,
        task_id: taskId,
        change_type: "mandays_change",
        field_name: `${role?.name ?? roleId} · ${formatWeekRange(weekStart)}`,
        old_value: String(oldMandays),
        new_value: String(mandays),
      });
      const history = await fetchHistory(boardId);
      dispatch({ type: "SET_HISTORY", history });
    }
  }, [userId, boardId, state.tasks, state.roles]);

  const handleUpsertCapacity = useCallback(async (
    roleId: string,
    weekStart: string,
    field: "capacity" | "taken_other" | "holiday" | "buffer_threshold",
    value: number,
  ) => {
    if (!userId || !boardId) return;
    const old = state.capacityMap[roleId]?.[weekStart]?.[field] ?? 0;

    // Optimistic update — build updated capacities array immediately
    const existingEntry: ResourceCapacity = state.capacityMap[roleId]?.[weekStart] ?? {
      id: `tmp-${roleId}-${weekStart}`, user_id: boardId,
      role_id: roleId, week_start: weekStart,
      capacity: 0, taken_other: 0, holiday: 0, buffer_threshold: 0,
      created_at: "", updated_at: "",
    };
    const updatedEntry = { ...existingEntry, [field]: value };
    const allCaps: ResourceCapacity[] = Object.values(state.capacityMap)
      .flatMap(wm => Object.values(wm))
      .filter(c => !(c.role_id === roleId && c.week_start === weekStart));
    dispatch({ type: "SET_CAPACITIES", capacities: [...allCaps, updatedEntry] });

    // Persist to DB
    await upsertCapacity(boardId, roleId, weekStart, { [field]: value });
    const capacities = await fetchResourceCapacity(boardId);
    dispatch({ type: "SET_CAPACITIES", capacities });
    if (value !== old) {
      const role = state.roles.find(r => r.id === roleId);
      await addHistory(userId, boardId, {
        change_type: "capacity_change",
        field_name: `${field} · ${role?.name ?? roleId} · ${formatWeekRange(weekStart)}`,
        old_value: String(old),
        new_value: String(value),
      });
      const history = await fetchHistory(boardId);
      dispatch({ type: "SET_HISTORY", history });
    }
  }, [userId, boardId, state.capacityMap, state.roles]);

  const handleDeleteProject = useCallback(async (id: string) => {
    if (!userId || !boardId) return;
    const proj = state.projects.find(p => p.id === id);
    dispatch({ type: "SET_PROJECTS", projects: state.projects.filter(p => p.id !== id) });
    dispatch({ type: "SET_TASKS",    tasks:    state.tasks.filter(t => t.project_id !== id) });
    await deleteProject(id);
    await addHistory(userId, boardId, { change_type: "project_deleted", notes: proj?.name });
  }, [userId, boardId, state.projects, state.tasks]);

  const handleDeleteTask = useCallback(async (id: string) => {
    if (!userId || !boardId) return;
    const task = state.tasks.find(t => t.id === id);
    dispatch({ type: "SET_TASKS", tasks: state.tasks.filter(t => t.id !== id) });
    await deleteTask(id);
    await addHistory(userId, boardId, { project_id: task?.project_id, change_type: "task_deleted", notes: task?.name });
  }, [userId, boardId, state.tasks]);

  const handleBulkDelete = useCallback(async () => {
    if (!userId || !boardId) return;
    const ids = Array.from(state.selectedRowIds);
    if (!ids.length) return;
    if (!window.confirm(`Delete ${ids.length} item(s)? This cannot be undone.`)) return;

    // Snapshot current rows before any state mutation
    const projsToDelete = state.projects.filter(p => ids.includes(p.id));
    const tasksToDelete = state.tasks.filter(t => ids.includes(t.id));
    const projIds = projsToDelete.map(p => p.id);
    const taskIds = tasksToDelete.map(t => t.id);

    // Single optimistic update — remove all at once to avoid stale closure issues
    dispatch({
      type: "SET_PROJECTS",
      projects: state.projects.filter(p => !projIds.includes(p.id)),
    });
    dispatch({
      type: "SET_TASKS",
      tasks: state.tasks.filter(
        t => !taskIds.includes(t.id) && !projIds.includes(t.project_id)
      ),
    });
    dispatch({ type: "CLEAR_SELECTION" });

    // Persist to DB in parallel
    await Promise.all([
      ...projIds.map(id => deleteProject(id)),
      ...taskIds.map(id => deleteTask(id)),
    ]);
    for (const p of projsToDelete) {
      await addHistory(userId, boardId, { change_type: "project_deleted", notes: p.name });
    }
    for (const t of tasksToDelete) {
      await addHistory(userId, boardId, { project_id: t.project_id, change_type: "task_deleted", notes: t.name });
    }
  }, [userId, boardId, state.selectedRowIds, state.projects, state.tasks]);

  const handleArchiveProject = useCallback(async (id: string) => {
    if (!userId || !boardId) return;
    const proj = state.projects.find(p => p.id === id);
    // Optimistic update
    const updated = state.projects.map(p => p.id === id ? { ...p, is_archived: true } : p);
    dispatch({ type: "SET_PROJECTS", projects: updated });
    try {
      await archiveProject(id, true);
      await addHistory(userId, boardId, { project_id: id, change_type: "project_archived", notes: proj?.name });
      const history = await fetchHistory(boardId);
      dispatch({ type: "SET_HISTORY", history });
    } catch (e) {
      dispatch({ type: "SET_PROJECTS", projects: state.projects });
    }
  }, [userId, boardId, state.projects]);

  const handleRestoreProject = useCallback(async (id: string) => {
    if (!userId || !boardId) return;
    const proj = state.projects.find(p => p.id === id);
    const updated = state.projects.map(p => p.id === id ? { ...p, is_archived: false } : p);
    dispatch({ type: "SET_PROJECTS", projects: updated });
    try {
      await archiveProject(id, false);
      await addHistory(userId, boardId, { project_id: id, change_type: "project_restored", notes: proj?.name });
      const history = await fetchHistory(boardId);
      dispatch({ type: "SET_HISTORY", history });
    } catch (e) {
      dispatch({ type: "SET_PROJECTS", projects: state.projects });
    }
  }, [userId, boardId, state.projects]);

  const handleRowHistoryClick = useCallback((projectId: string) => {
    dispatch({ type: "SET_HISTORY_FILTER", projectId });
    if (!state.isHistoryOpen) dispatch({ type: "TOGGLE_HISTORY" });
  }, [state.isHistoryOpen]);

  const handleRunCascade = useCallback(async () => {
    if (!userId || !boardId) return;

    const activeTasks = state.tasks.filter(t =>
      activeProjects.some(p => p.id === t.project_id) && !t.is_archived
    );
    const orderedTaskIds = [...activeTasks]
      .sort((a, b) => a.priority_order - b.priority_order)
      .map(t => t.id);

    const { newEffortMap, changes } = runCascadeRecalculate(
      orderedTaskIds,
      weeks,
      state.roles.map(r => r.id),
      state.effortMap,
      state.capacityMap,
    );

    if (changes.length === 0) return;

    // Build deduplicated cell list — Map ensures last value wins (correct for accumulated toWeek)
    const cellMap = new Map<string, { taskId: string; roleId: string; weekStart: string; mandays: number }>();
    for (const c of changes) {
      const fromKey = `${c.taskId}|${c.roleId}|${c.fromWeek}`;
      const toKey   = `${c.taskId}|${c.roleId}|${c.toWeek}`;
      cellMap.set(fromKey, {
        taskId: c.taskId, roleId: c.roleId, weekStart: c.fromWeek,
        mandays: newEffortMap[c.taskId]?.[c.roleId]?.[c.fromWeek] ?? 0,
      });
      cellMap.set(toKey, {
        taskId: c.taskId, roleId: c.roleId, weekStart: c.toWeek,
        mandays: newEffortMap[c.taskId]?.[c.roleId]?.[c.toWeek] ?? 0,
      });
    }

    // Persist each cell using the proven individual upsertEffort (handles zero→delete)
    for (const cell of cellMap.values()) {
      await upsertEffort(cell.taskId, cell.roleId, boardId, cell.weekStart, cell.mandays);
    }

    // Single reload — no intermediate clear to avoid flicker
    const efforts = await fetchWeeklyEfforts(boardId);
    dispatch({ type: "SET_EFFORTS", efforts });

    // History logging
    const roleMap = Object.fromEntries(state.roles.map(r => [r.id, r.name]));
    const taskMap = Object.fromEntries(state.tasks.map(t => [t.id, t.name]));
    for (const c of changes) {
      await addHistory(userId, boardId, {
        task_id: c.taskId,
        change_type: "cascade_push",
        field_name: roleMap[c.roleId] ?? c.roleId,
        old_value: `${c.fromWeek} · ${c.amount} md`,
        new_value: c.toWeek,
        notes: taskMap[c.taskId],
      });
    }
    const history = await fetchHistory(boardId);
    dispatch({ type: "SET_HISTORY", history });
  }, [userId, boardId, state.tasks, state.roles, state.effortMap, state.capacityMap, activeProjects, weeks]);

  const handleBulkArchive = useCallback(async () => {
    if (!userId) return;
    for (const id of state.selectedRowIds) {
      if (state.projects.some(p => p.id === id)) await handleArchiveProject(id);
    }
    dispatch({ type: "CLEAR_SELECTION" });
  }, [userId, state.selectedRowIds, state.projects, handleArchiveProject]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (!userId) {
    return (
      <div className="planner-shell">
        <div className="planner-loading">Sign in to use the Project Planner.</div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="planner-shell">
        <div className="planner-loading" style={{ color: "var(--danger-text)" }}>
          Error: {state.error}
        </div>
      </div>
    );
  }

  const totalMandays = Object.values(state.effortMap).reduce((sum, roleMap) =>
    sum + Object.values(roleMap).reduce((s2, wkMap) =>
      s2 + Object.values(wkMap).reduce((s3, v) => s3 + (v ?? 0), 0), 0), 0);

  return (
    <div className="planner-shell">
      {/* Conflict toast — surfaces concurrent-edit collisions caught by optimistic locking */}
      {conflictMsg && (
        <div
          role="alert"
          style={{
            position: "fixed", top: 16, right: 16, zIndex: 200,
            maxWidth: 360, padding: "10px 14px",
            background: "#fff6f6", border: "1px solid rgba(226,67,75,.3)",
            borderRadius: "var(--radius-md)", boxShadow: "0 4px 16px rgba(0,0,0,.12)",
            fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--danger-text)",
            display: "flex", alignItems: "flex-start", gap: 8,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--danger-text)" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span style={{ flex: 1 }}>{conflictMsg}</span>
          <button type="button" onClick={() => setConflictMsg(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger-text)", padding: 0, flexShrink: 0 }}>
            <X size={13} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="planner-header">
        <div className="planner-icon">
          <LayoutGrid size={18} />
        </div>
        <div>
          <div className="planner-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            Project Timeline & Capacity Planner
            {!isOwnBoard && (
              <span style={{
                fontSize: 10, padding: "2px 7px", borderRadius: "var(--radius-full)",
                border: "1px solid var(--accent-border)", background: "var(--accent-muted)", color: "var(--accent-text)",
                fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: ".03em",
              }}>
                Shared board
              </span>
            )}
          </div>
          <div className="planner-subtitle">
            {activeProjects.length} active project{activeProjects.length !== 1 ? "s" : ""} ·{" "}
            {state.tasks.filter(t => activeProjects.some(p => p.id === t.project_id)).length} tasks
          </div>
        </div>
        <div className="planner-header-actions">
          <SegmentedControl
            options={[
              { id: "grid",     label: "Grid",     icon: <LayoutGrid size={11} /> },
              { id: "timeline", label: "Timeline", icon: <GitBranch  size={11} />, disabled: true, disabledReason: "Timeline view is being reworked — coming back soon" },
              { id: "archive",  label: "Archive",  icon: <Archive    size={11} />, badge: archivedProjects.length || undefined },
            ]}
            value={state.view}
            onChange={(v) => dispatch({ type: "SET_VIEW", view: v as PlannerView })}
          />
          <div style={{ width: 1, height: 20, background: "var(--border-strong)", flexShrink: 0 }} />
          {isOwnBoard && (
            <Button variant="ghost" size="sm" onClick={() => setShareOpen(true)}>
              <Share2 size={13} /> Share
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => dispatch({ type: "TOGGLE_HISTORY" })}>
            <History size={13} /> History
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => exportToXlsx({
              roles: state.roles,
              projects: activeProjects,
              tasks: state.tasks.filter(t => activeProjects.some(p => p.id === t.project_id)),
              effortMap: state.effortMap,
              capacityMap: state.capacityMap,
              weeks,
            })}
          >
            <Download size={13} /> Export .xlsx
          </Button>
          <AddDropdown
            projects={activeProjects}
            onAddProject={handleAddProject}
            onAddTask={(name, projId) => handleAddTask(projId, name)}
          />
        </div>
      </div>

      {/* Body */}
      <div className="planner-body">
        {state.loading ? (
          <div className="planner-loading">Loading…</div>
        ) : state.view === "grid" ? (
          <PlannerGrid
            boardOwnerId={boardId ?? ""}
            roles={state.roles}
            projects={activeProjects}
            tasks={state.tasks.filter(t => activeProjects.some(p => p.id === t.project_id))}
            effortMap={state.effortMap}
            capacityMap={state.capacityMap}
            dateRange={state.dateRange}
            weeks={weeks}
            selectedRowIds={state.selectedRowIds}
            onDateRangeChange={(range) => dispatch({ type: "SET_DATE_RANGE", range })}
            onToggleSelect={(id) => dispatch({ type: "TOGGLE_ROW_SELECT", id })}
            onReorder={handleReorder}
            onUpdateProject={handleUpdateProject}
            onAddTask={handleAddTask}
            onUpdateTask={handleUpdateTask}
            onUpsertEffort={handleUpsertEffort}
            onUpsertCapacity={handleUpsertCapacity}
            onArchiveProject={handleArchiveProject}
            onDeleteProject={handleDeleteProject}
            onDeleteTask={handleDeleteTask}
            onRunCascade={handleRunCascade}
            onRowHistoryClick={handleRowHistoryClick}
            onChangeTaskProject={(taskId, newProjectId) =>
              handleUpdateTask(taskId, { project_id: newProjectId }, {
                task_id: taskId, change_type: "status_change",
                field_name: "project", new_value: newProjectId,
              })
            }
          />
        ) : state.view === "timeline" ? (
          <PlannerTimeline
            roles={state.roles}
            projects={activeProjects}
            tasks={state.tasks.filter(t => activeProjects.some(p => p.id === t.project_id))}
            effortMap={state.effortMap}
            dateRange={state.dateRange}
            weeks={weeks}
            onDeleteProject={handleDeleteProject}
            onArchiveProject={handleArchiveProject}
          />
        ) : (
          <PlannerArchive
            projects={archivedProjects}
            tasks={state.tasks.filter(t => archivedProjects.some(p => p.id === t.project_id))}
            onRestore={handleRestoreProject}
            onChangeStatus={handleUpdateProject}
          />
        )}
      </div>

      {/* Share dialog */}
      {userId && <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} ownerId={userId} />}

      {/* History panel */}
      <HistoryPanel
        open={state.isHistoryOpen}
        history={state.history}
        projects={state.projects}
        projectFilter={state.historyProjectFilter}
        onClose={() => dispatch({ type: "TOGGLE_HISTORY" })}
        onFilterChange={(id) => dispatch({ type: "SET_HISTORY_FILTER", projectId: id })}
      />

      {/* Bulk action bar */}
      <div className={`bulk-bar ${state.selectedRowIds.size > 0 ? "show" : ""}`}>
        <span className="bulk-count">{state.selectedRowIds.size} selected</span>
        <span className="bulk-sep" />
        <button className="bulk-action-btn" onClick={handleBulkArchive}>Archive</button>
        <button className="bulk-action-btn">Mark done</button>
        <span className="bulk-sep" />
        <button className="bulk-action-btn danger" onClick={handleBulkDelete}>Delete</button>

        <span className="bulk-sep" />
        <button className="bulk-action-btn cancel" onClick={() => dispatch({ type: "CLEAR_SELECTION" })}>
          <X size={12} /> Cancel
        </button>
      </div>
    </div>
  );
}
