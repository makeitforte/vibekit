"use client";

import { useEffect, useReducer, useCallback, useRef } from "react";
import { LayoutGrid, GitBranch, Archive, History, Plus, Download, X } from "lucide-react";
import { useProfiles } from "@/lib/profiles-context";

import {
  Role, Project, Task, WeeklyEffort, ResourceCapacity, ChangeHistory,
  PlannerView, PlannerDateRange, EffortMap, CapacityMap,
} from "./types";
import {
  fetchRoles, seedDefaultRoles,
  fetchProjects, createProject, updateProject, reorderProjects,
  fetchTasks, createTask, updateTask, reorderTasks,
  fetchWeeklyEfforts, upsertEffort, buildEffortMap,
  fetchResourceCapacity, upsertCapacity, buildCapacityMap,
  fetchHistory, addHistory, type HistoryEntry,
} from "./queries";
import { getWeekStarts, toWeekStart, formatWeekRange, deriveTaskEta } from "./utils";
import { PlannerGrid } from "./planner-grid";
import { exportToXlsx } from "./export-xlsx";
import { PlannerTimeline } from "./planner-timeline";
import { PlannerArchive } from "./planner-archive";
import { HistoryPanel } from "./history-panel";
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
    case "TOGGLE_HISTORY":  return { ...state, isHistoryOpen: !state.isHistoryOpen };
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

export function PlannerShell() {
  const { user } = useProfiles();
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const userId = user?.id ?? null;

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        let roles = await fetchRoles(userId);
        if (roles.length === 0) roles = await seedDefaultRoles(userId);

        const [projects, tasks, efforts, capacities, history] = await Promise.all([
          fetchProjects(userId),
          fetchTasks(userId),
          fetchWeeklyEfforts(userId),
          fetchResourceCapacity(userId),
          fetchHistory(userId),
        ]);

        dispatch({ type: "LOADED", roles, projects, tasks, efforts, capacities, history });
      } catch (e) {
        dispatch({ type: "SET_ERROR", error: (e as Error).message });
      }
    })();
  }, [userId]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const weeks = getWeekStarts(state.dateRange);
  const activeProjects  = state.projects.filter(p => p.status === "active");
  const archivedProjects = state.projects.filter(p => p.status !== "active");

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleAddProject = useCallback(async () => {
    if (!userId) return;
    const name = window.prompt("Project name:");
    if (!name?.trim()) return;
    const order = activeProjects.length;
    const proj = await createProject(userId, name.trim(), order);
    dispatch({ type: "SET_PROJECTS", projects: [...state.projects, proj] });
    await addHistory(userId, { project_id: proj.id, change_type: "project_created", new_value: name.trim() });
  }, [userId, activeProjects.length, state.projects]);

  const handleUpdateProject = useCallback(async (
    id: string,
    patch: Partial<Pick<Project, "name" | "status" | "eta" | "notes" | "priority_order" | "priority_label">>,
    historyEntry?: HistoryEntry,
  ) => {
    if (!userId) return;
    // Optimistic update first so UI responds immediately
    const updated = state.projects.map(p => p.id === id ? { ...p, ...patch } : p);
    dispatch({ type: "SET_PROJECTS", projects: updated });
    // Persist to DB (errors are silent for now — could add toast)
    try {
      await updateProject(id, patch);
    } catch (e) {
      // Revert on failure
      dispatch({ type: "SET_PROJECTS", projects: state.projects });
      console.error("updateProject failed", e);
      return;
    }
    if (historyEntry) {
      await addHistory(userId, historyEntry);
      const history = await fetchHistory(userId);
      dispatch({ type: "SET_HISTORY", history });
    }
  }, [userId, state.projects]);

  const handleAddTask = useCallback(async (projectId: string) => {
    if (!userId) return;
    const name = window.prompt("Task name:");
    if (!name?.trim()) return;
    const siblingCount = state.tasks.filter(t => t.project_id === projectId).length;
    const maxOrder = state.tasks.length;
    const task = await createTask(userId, projectId, name.trim(), maxOrder + siblingCount);
    dispatch({ type: "SET_TASKS", tasks: [...state.tasks, task] });
    await addHistory(userId, { project_id: projectId, task_id: task.id, change_type: "task_created", new_value: name.trim() });
  }, [userId, state.tasks]);

  const handleUpdateTask = useCallback(async (
    id: string,
    patch: Partial<Pick<Task, "name" | "status" | "eta" | "notes" | "links" | "priority_order" | "project_id">>,
    historyEntry?: HistoryEntry,
  ) => {
    if (!userId) return;
    // Optimistic update
    const updated = state.tasks.map(t => t.id === id ? { ...t, ...patch } : t);
    dispatch({ type: "SET_TASKS", tasks: updated });
    try {
      await updateTask(id, patch);
    } catch (e) {
      dispatch({ type: "SET_TASKS", tasks: state.tasks });
      console.error("updateTask failed", e);
      return;
    }
    if (historyEntry) {
      await addHistory(userId, historyEntry);
      const history = await fetchHistory(userId);
      dispatch({ type: "SET_HISTORY", history });
    }
  }, [userId, state.tasks]);

  const handleReorder = useCallback(async (
    orderedProjectIds: string[],
    orderedTaskIds: string[],
    historyEntries?: HistoryEntry[],
  ) => {
    if (!userId) return;
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
      for (const e of historyEntries) await addHistory(userId, e);
      const history = await fetchHistory(userId);
      dispatch({ type: "SET_HISTORY", history });
    }
  }, [userId, state.projects, state.tasks]);

  const handleUpsertEffort = useCallback(async (
    taskId: string,
    roleId: string,
    weekStart: string,
    mandays: number,
    oldMandays: number,
  ) => {
    if (!userId) return;
    await upsertEffort(taskId, roleId, userId, weekStart, mandays);
    const efforts = await fetchWeeklyEfforts(userId);
    dispatch({ type: "SET_EFFORTS", efforts });
    if (mandays !== oldMandays) {
      const task = state.tasks.find(t => t.id === taskId);
      const role = state.roles.find(r => r.id === roleId);
      await addHistory(userId, {
        project_id: task?.project_id,
        task_id: taskId,
        change_type: "mandays_change",
        field_name: `${role?.name ?? roleId} · ${formatWeekRange(weekStart)}`,
        old_value: String(oldMandays),
        new_value: String(mandays),
      });
      const history = await fetchHistory(userId);
      dispatch({ type: "SET_HISTORY", history });
    }
  }, [userId, state.tasks, state.roles]);

  const handleUpsertCapacity = useCallback(async (
    roleId: string,
    weekStart: string,
    field: "capacity" | "taken_other" | "holiday" | "buffer_threshold",
    value: number,
  ) => {
    if (!userId) return;
    const old = state.capacityMap[roleId]?.[weekStart]?.[field] ?? 0;
    await upsertCapacity(userId, roleId, weekStart, { [field]: value });
    const capacities = await fetchResourceCapacity(userId);
    dispatch({ type: "SET_CAPACITIES", capacities });
    if (value !== old) {
      const role = state.roles.find(r => r.id === roleId);
      await addHistory(userId, {
        change_type: "capacity_change",
        field_name: `${field} · ${role?.name ?? roleId} · ${formatWeekRange(weekStart)}`,
        old_value: String(old),
        new_value: String(value),
      });
      const history = await fetchHistory(userId);
      dispatch({ type: "SET_HISTORY", history });
    }
  }, [userId, state.capacityMap, state.roles]);

  const handleArchiveProject = useCallback(async (id: string) => {
    if (!userId) return;
    const proj = state.projects.find(p => p.id === id);
    await handleUpdateProject(id, { status: "done" }, {
      project_id: id,
      change_type: "project_archived",
      old_value: "active",
      new_value: "done",
      notes: proj?.name,
    });
  }, [handleUpdateProject, state.projects, userId]);

  const handleRestoreProject = useCallback(async (id: string) => {
    if (!userId) return;
    const proj = state.projects.find(p => p.id === id);
    await handleUpdateProject(id, { status: "active" }, {
      project_id: id,
      change_type: "project_restored",
      old_value: "done",
      new_value: "active",
      notes: proj?.name,
    });
  }, [handleUpdateProject, state.projects, userId]);

  const handleBulkArchive = useCallback(async () => {
    if (!userId) return;
    for (const id of state.selectedRowIds) {
      const proj = state.projects.find(p => p.id === id);
      if (proj) await handleArchiveProject(id);
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
      {/* Header */}
      <div className="planner-header">
        <div className="planner-icon">
          <LayoutGrid size={18} />
        </div>
        <div>
          <div className="planner-title">Project Timeline & Capacity Planner</div>
          <div className="planner-subtitle">
            {activeProjects.length} active project{activeProjects.length !== 1 ? "s" : ""} ·{" "}
            {state.tasks.filter(t => activeProjects.some(p => p.id === t.project_id)).length} tasks
          </div>
        </div>
        <div className="planner-header-actions">
          <SegmentedControl
            options={[
              { id: "grid",     label: "Grid",     icon: <LayoutGrid size={11} /> },
              { id: "timeline", label: "Timeline",  icon: <GitBranch  size={11} /> },
              { id: "archive",  label: "Archive",   icon: <Archive    size={11} />, badge: archivedProjects.length || undefined },
            ]}
            value={state.view}
            onChange={(v) => dispatch({ type: "SET_VIEW", view: v as PlannerView })}
          />
          <div style={{ width: 1, height: 20, background: "var(--border-strong)", flexShrink: 0 }} />
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
          <Button variant="primary" size="sm" onClick={handleAddProject}>
            <Plus size={13} /> Add Project
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="planner-body">
        {state.loading ? (
          <div className="planner-loading">Loading…</div>
        ) : state.view === "grid" ? (
          <PlannerGrid
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
          />
        ) : state.view === "timeline" ? (
          <PlannerTimeline
            roles={state.roles}
            projects={activeProjects}
            tasks={state.tasks.filter(t => activeProjects.some(p => p.id === t.project_id))}
            effortMap={state.effortMap}
            dateRange={state.dateRange}
            weeks={weeks}
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
        <button className="bulk-action-btn danger">Delete</button>
        <span className="bulk-sep" />
        <button className="bulk-action-btn cancel" onClick={() => dispatch({ type: "CLEAR_SELECTION" })}>
          <X size={12} /> Cancel
        </button>
      </div>
    </div>
  );
}
