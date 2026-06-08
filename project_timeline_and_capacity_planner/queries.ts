"use client";

import { createClient } from "@/lib/supabase/client";
import {
  Role, Project, Task, WeeklyEffort, ResourceCapacity, ChangeHistory,
  ChangeType, DEFAULT_ROLES, EffortMap, CapacityMap,
  BoardShare, BoardMember, SharePermission,
} from "./types";

const sb = () => createClient();

/** Thrown by optimistic-locked updates when the row changed since it was loaded (concurrent edit). */
export class ConflictError extends Error {
  constructor(entity: string) {
    super(`${entity} was changed by someone else`);
    this.name = "ConflictError";
  }
}

// ── Roles ─────────────────────────────────────────────────────────────────────

export async function fetchRoles(userId: string): Promise<Role[]> {
  const { data, error } = await sb()
    .from("planner_roles")
    .select("*")
    .eq("user_id", userId)
    .order("display_order");
  if (error) throw error;
  const all = data ?? [];
  // Deduplicate by name — keep first occurrence (lowest display_order)
  const seen = new Set<string>();
  return all.filter(r => {
    if (seen.has(r.name)) return false;
    seen.add(r.name);
    return true;
  });
}

export async function deleteRoleDuplicates(userId: string): Promise<void> {
  const { data } = await sb()
    .from("planner_roles")
    .select("id, name")
    .eq("user_id", userId)
    .order("display_order");
  if (!data) return;
  const seen = new Set<string>();
  const idsToDelete: string[] = [];
  for (const r of data) {
    if (seen.has(r.name)) idsToDelete.push(r.id);
    else seen.add(r.name);
  }
  if (idsToDelete.length > 0) {
    await sb().from("planner_roles").delete().in("id", idsToDelete);
  }
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
  /** Pass the row's currently-loaded `updated_at` to guard against overwriting a concurrent edit. */
  expectedUpdatedAt?: string,
): Promise<void> {
  const base = sb().from("planner_projects").update(patch).eq("id", id);
  const query = expectedUpdatedAt ? base.eq("updated_at", expectedUpdatedAt) : base;
  const { data, error } = await query.select("id");
  if (error) throw error;
  if (expectedUpdatedAt && (data?.length ?? 0) === 0) throw new ConflictError("Project");
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await sb().from("planner_projects").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await sb().from("planner_tasks").delete().eq("id", id);
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
  patch: Partial<Pick<Task, "name" | "status" | "eta" | "notes" | "links" | "priority_order" | "project_id" | "priority_label">>,
  /** Pass the row's currently-loaded `updated_at` to guard against overwriting a concurrent edit. */
  expectedUpdatedAt?: string,
): Promise<void> {
  const base = sb().from("planner_tasks").update(patch).eq("id", id);
  const query = expectedUpdatedAt ? base.eq("updated_at", expectedUpdatedAt) : base;
  const { data, error } = await query.select("id");
  if (error) throw error;
  if (expectedUpdatedAt && (data?.length ?? 0) === 0) throw new ConflictError("Task");
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
  // delete-then-insert: avoids Supabase upsert onConflict silent-failure for new rows
  await sb()
    .from("planner_weekly_efforts")
    .delete()
    .eq("task_id", taskId)
    .eq("role_id", roleId)
    .eq("week_start", weekStart);

  if (mandays > 0) {
    const { error } = await sb()
      .from("planner_weekly_efforts")
      .insert({ task_id: taskId, role_id: roleId, user_id: userId, week_start: weekStart, mandays });
    if (error) throw error;
  }
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

/** `ownerId` is the board being viewed — history is scoped to the board, not the actor, so collaborators' entries are included too. */
export async function fetchHistory(
  ownerId: string,
  projectId?: string,
): Promise<ChangeHistory[]> {
  let q = sb()
    .from("planner_change_history")
    .select("*, planner_projects(name), planner_tasks(name)")
    .eq("owner_id", ownerId)
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

/** `actorId` = who performed the action; `ownerId` = whose board it happened on (may differ for collaborators). */
export async function addHistory(
  actorId: string,
  ownerId: string,
  entry: HistoryEntry,
): Promise<void> {
  const { error } = await sb()
    .from("planner_change_history")
    .insert({ user_id: actorId, owner_id: ownerId, ...entry });
  if (error) console.error("history insert error", error);
}

// ── Board sharing ─────────────────────────────────────────────────────────────

/** Active (non-revoked) share links the current user has generated for their board. */
export async function fetchBoardShares(ownerId: string): Promise<BoardShare[]> {
  const { data, error } = await sb()
    .from("board_shares")
    .select("*")
    .eq("owner_id", ownerId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Generates a new shareable link for the caller's board with the given permission. */
export async function createBoardShare(ownerId: string, permission: SharePermission): Promise<BoardShare> {
  const token = crypto.randomUUID().replace(/-/g, "");
  const { data, error } = await sb()
    .from("board_shares")
    .insert({ owner_id: ownerId, token, permission })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Revokes a share link — anyone holding the link loses access from this point on. */
export async function revokeBoardShare(id: string): Promise<void> {
  const { error } = await sb()
    .from("board_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** People who currently have access to the caller's board via a redeemed share link. */
export async function fetchBoardMembers(ownerId: string): Promise<BoardMember[]> {
  const { data, error } = await sb()
    .from("board_members")
    .select("*")
    .eq("owner_id", ownerId)
    .order("joined_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Owner removes a collaborator's access to their board. */
export async function removeBoardMember(id: string): Promise<void> {
  const { error } = await sb().from("board_members").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Redeems a share token: validates it, joins the caller to that board as a member,
 * and returns the board owner's id + the permission granted. Throws if the token
 * is invalid/revoked, or if the caller is trying to join their own board.
 */
export async function redeemBoardShare(token: string): Promise<{ ownerId: string; permission: SharePermission }> {
  const { data, error } = await sb().rpc("redeem_board_share", { p_token: token });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Share link could not be redeemed");
  return { ownerId: row.owner_id, permission: row.permission };
}

/** Boards the current user has joined as a collaborator (not their own). */
export async function fetchMyBoardMemberships(memberId: string): Promise<BoardMember[]> {
  const { data, error } = await sb()
    .from("board_members")
    .select("*")
    .eq("member_id", memberId)
    .order("joined_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export interface MemberProfile {
  id: string;
  name: string;
  initials: string;
  color: string;
}

/** Resolves raw member-id UUIDs to display profiles (name/initials/color) for the share dialog. */
export async function fetchProfilesByIds(ids: string[]): Promise<MemberProfile[]> {
  if (ids.length === 0) return [];
  const { data, error } = await sb()
    .from("profiles")
    .select("id, name, initials, color")
    .in("id", ids);
  if (error) throw error;
  return data ?? [];
}
