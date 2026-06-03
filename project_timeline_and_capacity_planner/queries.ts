"use client";

import { createClient } from "@/lib/supabase/client";
import {
  Role, Project, Task, WeeklyEffort, ResourceCapacity, ChangeHistory,
  ChangeType, DEFAULT_ROLES, EffortMap, CapacityMap,
} from "./types";

const sb = () => createClient();

// ── Roles ─────────────────────────────────────────────────────────────────────

export async function fetchRoles(userId: string): Promise<Role[]> {
  const { data, error } = await sb()
    .from("planner_roles")
    .select("*")
    .eq("user_id", userId)
    .order("display_order");
  if (error) throw error;
  return data ?? [];
}

export async function seedDefaultRoles(userId: string): Promise<Role[]> {
  const rows = DEFAULT_ROLES.map((r) => ({ ...r, user_id: userId }));
  const { data, error } = await sb()
    .from("planner_roles")
    .insert(rows)
    .select();
  if (error) throw error;
  return data ?? [];
}

export async function upsertRole(role: Partial<Role> & { user_id: string }): Promise<Role> {
  const { data, error } = await sb()
    .from("planner_roles")
    .upsert(role, { onConflict: "id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteRole(id: string): Promise<void> {
  const { error } = await sb().from("planner_roles").delete().eq("id", id);
  if (error) throw error;
}

// ── Projects ──────────────────────────────────────────────────────────────────

export async function fetchProjects(userId: string): Promise<Project[]> {
  const { data, error } = await sb()
    .from("planner_projects")
    .select("*")
    .eq("user_id", userId)
    .order("priority_order");
  if (error) throw error;
  return data ?? [];
}

export async function createProject(
  userId: string,
  name: string,
  priorityOrder: number,
): Promise<Project> {
  const { data, error } = await sb()
    .from("planner_projects")
    .insert({ user_id: userId, name, priority_order: priorityOrder })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProject(
  id: string,
  patch: Partial<Pick<Project, "name" | "status" | "eta" | "notes" | "priority_order" | "priority_label" | "is_archived">>,
): Promise<void> {
  const { error } = await sb().from("planner_projects").update(patch).eq("id", id);
  if (error) throw error;
}

export async function archiveProject(id: string, archive: boolean): Promise<void> {
  const { error } = await sb()
    .from("planner_projects")
    .update({ is_archived: archive })
    .eq("id", id);
  if (error) throw error;
}

export async function archiveTask(id: string, archive: boolean): Promise<void> {
  const { error } = await sb()
    .from("planner_tasks")
    .update({ is_archived: archive })
    .eq("id", id);
  if (error) throw error;
}

export async function reorderProjects(
  ids: string[], // ordered list — index 0 = priority 0
): Promise<void> {
  const updates = ids.map((id, i) =>
    sb().from("planner_projects").update({ priority_order: i }).eq("id", id)
  );
  await Promise.all(updates);
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export async function fetchTasks(userId: string): Promise<Task[]> {
  const { data, error } = await sb()
    .from("planner_tasks")
    .select("*")
    .eq("user_id", userId)
    .order("priority_order");
  if (error) throw error;
  return data ?? [];
}

export async function createTask(
  userId: string,
  projectId: string,
  name: string,
  priorityOrder: number,
): Promise<Task> {
  const { data, error } = await sb()
    .from("planner_tasks")
    .insert({ user_id: userId, project_id: projectId, name, priority_order: priorityOrder })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTask(
  id: string,
  patch: Partial<Pick<Task, "name" | "status" | "eta" | "notes" | "links" | "priority_order" | "project_id">>,
): Promise<void> {
  const { error } = await sb().from("planner_tasks").update(patch).eq("id", id);
  if (error) throw error;
}

export async function reorderTasks(
  ids: string[], // full ordered list across all projects
): Promise<void> {
  const updates = ids.map((id, i) =>
    sb().from("planner_tasks").update({ priority_order: i }).eq("id", id)
  );
  await Promise.all(updates);
}

// ── Weekly efforts ────────────────────────────────────────────────────────────

export async function fetchWeeklyEfforts(userId: string): Promise<WeeklyEffort[]> {
  const { data, error } = await sb()
    .from("planner_weekly_efforts")
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;
  return data ?? [];
}

export async function upsertEffort(
  taskId: string,
  roleId: string,
  userId: string,
  weekStart: string,
  mandays: number,
): Promise<void> {
  if (mandays === 0) {
    // Delete instead of keeping a zero row
    await sb()
      .from("planner_weekly_efforts")
      .delete()
      .eq("task_id", taskId)
      .eq("role_id", roleId)
      .eq("week_start", weekStart);
    return;
  }
  const { error } = await sb()
    .from("planner_weekly_efforts")
    .upsert(
      { task_id: taskId, role_id: roleId, user_id: userId, week_start: weekStart, mandays },
      { onConflict: "task_id,role_id,week_start" },
    );
  if (error) throw error;
}

/** Batch upsert/delete many effort cells at once (used by cascade) */
export async function upsertManyEfforts(
  userId: string,
  entries: { task_id: string; role_id: string; week_start: string; mandays: number }[],
): Promise<void> {
  if (entries.length === 0) return;

  const toDelete = entries.filter(e => e.mandays === 0);
  const toUpsert = entries.filter(e => e.mandays > 0);

  // Delete zeros
  for (const e of toDelete) {
    await sb()
      .from("planner_weekly_efforts")
      .delete()
      .eq("task_id", e.task_id)
      .eq("role_id", e.role_id)
      .eq("week_start", e.week_start);
  }

  // Upsert non-zeros
  if (toUpsert.length > 0) {
    const { error } = await sb()
      .from("planner_weekly_efforts")
      .upsert(
        toUpsert.map(e => ({ ...e, user_id: userId })),
        { onConflict: "task_id,role_id,week_start" },
      );
    if (error) throw error;
  }
}

export function buildEffortMap(efforts: WeeklyEffort[]): EffortMap {
  const map: EffortMap = {};
  for (const e of efforts) {
    if (!map[e.task_id]) map[e.task_id] = {};
    if (!map[e.task_id][e.role_id]) map[e.task_id][e.role_id] = {};
    map[e.task_id][e.role_id][e.week_start] = e.mandays;
  }
  return map;
}

// ── Resource capacity ─────────────────────────────────────────────────────────

export async function fetchResourceCapacity(userId: string): Promise<ResourceCapacity[]> {
  const { data, error } = await sb()
    .from("planner_resource_capacity")
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;
  return data ?? [];
}

export async function upsertCapacity(
  userId: string,
  roleId: string,
  weekStart: string,
  patch: Partial<Pick<ResourceCapacity, "capacity" | "taken_other" | "holiday" | "buffer_threshold">>,
): Promise<void> {
  const { error } = await sb()
    .from("planner_resource_capacity")
    .upsert(
      { user_id: userId, role_id: roleId, week_start: weekStart, ...patch },
      { onConflict: "user_id,role_id,week_start" },
    );
  if (error) throw error;
}

export function buildCapacityMap(capacities: ResourceCapacity[]): CapacityMap {
  const map: CapacityMap = {};
  for (const c of capacities) {
    if (!map[c.role_id]) map[c.role_id] = {};
    map[c.role_id][c.week_start] = c;
  }
  return map;
}

// ── Change history ────────────────────────────────────────────────────────────

export async function fetchHistory(
  userId: string,
  projectId?: string,
): Promise<ChangeHistory[]> {
  let q = sb()
    .from("planner_change_history")
    .select("*, planner_projects(name), planner_tasks(name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (projectId) q = q.eq("project_id", projectId);

  const { data, error } = await q;
  if (error) throw error;

  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    project_name: (row.planner_projects as Record<string, unknown> | null)?.name as string | undefined,
    task_name:    (row.planner_tasks    as Record<string, unknown> | null)?.name as string | undefined,
  })) as ChangeHistory[];
}

export interface HistoryEntry {
  project_id?: string;
  task_id?: string;
  change_type: ChangeType;
  field_name?: string;
  old_value?: string;
  new_value?: string;
  notes?: string;
}

export async function addHistory(
  userId: string,
  entry: HistoryEntry,
): Promise<void> {
  const { error } = await sb()
    .from("planner_change_history")
    .insert({ user_id: userId, ...entry });
  if (error) console.error("history insert error", error);
}
