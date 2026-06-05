// ── Domain types ──────────────────────────────────────────────────────────────

// Project statuses
export type ProjectStatus = "todo" | "in_progress" | "done" | "released" | "cancelled";

// Task statuses — includes PRD stages
export type TaskStatus =
  | "todo"
  | "prd_in_progress"  // PRD being written
  | "prd_ready"        // PRD done, ready for dev
  | "in_progress"
  | "done"
  | "released"
  | "cancelled";

export type ItemStatus = ProjectStatus | TaskStatus;
export type ChangeType =
  | "priority_change"
  | "mandays_change"
  | "status_change"
  | "cascade_push"
  | "capacity_change"
  | "project_created"
  | "task_created"
  | "project_archived"
  | "project_restored";

export interface Role {
  id: string;
  user_id: string;
  name: string;
  color: string;
  display_order: number;
  created_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  priority_order: number;
  priority_label: "P1" | "P2" | "P3" | null;
  status: ProjectStatus;
  is_archived: boolean;
  eta: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  priority_order: number;
  priority_label: "P1" | "P2" | "P3" | null; // user-set, independent of project priority
  status: TaskStatus;
  is_archived: boolean;
  eta: string | null;
  notes: string | null;
  links: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface WeeklyEffort {
  id: string;
  task_id: string;
  role_id: string;
  user_id: string;
  week_start: string; // ISO date string YYYY-MM-DD (Monday)
  mandays: number;
  created_at: string;
  updated_at: string;
}

export interface ResourceCapacity {
  id: string;
  user_id: string;
  role_id: string;
  week_start: string;
  capacity: number;
  taken_other: number;
  holiday: number;
  buffer_threshold: number;
  created_at: string;
  updated_at: string;
}

export interface ChangeHistory {
  id: string;
  user_id: string;
  project_id: string | null;
  task_id: string | null;
  change_type: ChangeType;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  notes: string | null;
  created_at: string;
  // joined
  project_name?: string;
  task_name?: string;
}

// ── View types ────────────────────────────────────────────────────────────────

export type PlannerView = "grid" | "timeline" | "archive";

export interface PlannerDateRange {
  start: string; // ISO YYYY-MM-DD
  end: string;
}

/** Effort lookup: effortMap[taskId][roleId][weekStart] = mandays */
export type EffortMap = Record<string, Record<string, Record<string, number>>>;

/** Capacity lookup: capacityMap[roleId][weekStart] = ResourceCapacity */
export type CapacityMap = Record<string, Record<string, ResourceCapacity>>;

// Default roles seeded for new users
export const DEFAULT_ROLES: Omit<Role, "id" | "user_id" | "created_at">[] = [
  { name: "BE",         color: "#16a268", display_order: 0 },
  { name: "FE Web",     color: "#b7860b", display_order: 1 },
  { name: "FE Android", color: "#3b82f6", display_order: 2 },
  { name: "FE iOS",     color: "#8b5cf6", display_order: 3 },
  { name: "QA",         color: "#06b6d4", display_order: 4 },
];

// Role colour palette (maps role color → CSS vars)
export const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "#16a268": { bg: "rgba(22,162,104,.10)",  text: "#0e7a4e", border: "rgba(22,162,104,.25)" },
  "#b7860b": { bg: "rgba(183,134,11,.10)",  text: "#876200", border: "rgba(183,134,11,.25)" },
  "#3b82f6": { bg: "rgba(59,130,246,.10)",  text: "#1d4ed8", border: "rgba(59,130,246,.25)" },
  "#8b5cf6": { bg: "rgba(139,92,246,.10)",  text: "#6d28d9", border: "rgba(139,92,246,.25)" },
  "#06b6d4": { bg: "rgba(6,182,212,.10)",   text: "#0e7490", border: "rgba(6,182,212,.25)" },
};
