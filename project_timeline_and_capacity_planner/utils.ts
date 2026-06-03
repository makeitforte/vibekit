import { PlannerDateRange, ResourceCapacity, CapacityMap, EffortMap } from "./types";

// ── Date helpers ──────────────────────────────────────────────────────────────

/** Return the Monday of the week containing `date` as YYYY-MM-DD */
export function toWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Return an array of week-start strings (Mondays) covering the date range */
export function getWeekStarts(range: PlannerDateRange): string[] {
  const weeks: string[] = [];
  const start = new Date(range.start);
  const end = new Date(range.end);
  let cur = new Date(toWeekStart(start));
  while (cur <= end) {
    weeks.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 7);
  }
  return weeks;
}

/** Format a week-start date as "Jun 2–6, 2025" */
export function formatWeekRange(weekStart: string): string {
  const start = new Date(weekStart + "T00:00:00");
  const end = new Date(weekStart + "T00:00:00");
  end.setDate(end.getDate() + 4);

  const startMonth = start.toLocaleString("en-US", { month: "short" });
  const endMonth   = end.toLocaleString("en-US", { month: "short" });
  const year       = end.getFullYear();

  if (startMonth === endMonth) {
    return `${startMonth} ${start.getDate()}–${end.getDate()}, ${year}`;
  }
  return `${startMonth} ${start.getDate()}–${endMonth} ${end.getDate()}, ${year}`;
}

/** Parse "YYYY-MM-DD" safely without timezone shifts */
export function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// ── Capacity / buffer ─────────────────────────────────────────────────────────

export interface WeekRoleSummary {
  capacity: number;
  totalRequired: number;
  takenOther: number;
  holiday: number;
  bufferThreshold: number;
  buffer: number;         // = capacity - totalRequired - takenOther - holiday
  overThreshold: boolean; // buffer < bufferThreshold
}

export function computeWeekRoleSummary(
  roleId: string,
  weekStart: string,
  capacityMap: CapacityMap,
  effortMap: EffortMap,
  taskIds: string[],
): WeekRoleSummary {
  const cap: ResourceCapacity | undefined = capacityMap[roleId]?.[weekStart];
  const capacity        = cap?.capacity         ?? 0;
  const takenOther      = cap?.taken_other       ?? 0;
  const holiday         = cap?.holiday           ?? 0;
  const bufferThreshold = cap?.buffer_threshold  ?? 0;

  let totalRequired = 0;
  for (const tid of taskIds) {
    totalRequired += effortMap[tid]?.[roleId]?.[weekStart] ?? 0;
  }

  const buffer = capacity - totalRequired - takenOther - holiday;
  return {
    capacity,
    totalRequired,
    takenOther,
    holiday,
    bufferThreshold,
    buffer,
    overThreshold: buffer < bufferThreshold,
  };
}

// ── Priority / cascade ────────────────────────────────────────────────────────

/**
 * Given the ordered list of task IDs (flat priority list), determine which
 * weeks are "at capacity" for each role, then push lower-priority tasks to
 * the next available week. Returns updated effort map (immutable-style).
 *
 * Algorithm:
 * 1. Iterate weeks in order.
 * 2. For each week, for each role, sum required effort from tasks in priority order.
 * 3. If cumulative + next task's effort would exceed (capacity - takenOther - holiday - bufferThreshold),
 *    that task and all subsequent tasks for that role are shifted to the next week.
 */
export function runCascadeRecalculate(
  orderedTaskIds: string[],
  weeks: string[],
  roles: string[], // role IDs
  effortMap: EffortMap,
  capacityMap: CapacityMap,
): EffortMap {
  // Deep clone
  const result: EffortMap = JSON.parse(JSON.stringify(effortMap));

  for (const roleId of roles) {
    // Track how much capacity is already consumed per week
    const weekConsumed: Record<string, number> = {};

    for (const taskId of orderedTaskIds) {
      // Find the earliest week this task has effort for this role
      const taskEffort = result[taskId]?.[roleId];
      if (!taskEffort) continue;

      const sortedWeeks = Object.keys(taskEffort)
        .filter(w => taskEffort[w] > 0)
        .sort();

      for (const origWeek of sortedWeeks) {
        const md = taskEffort[origWeek];
        if (!md) continue;

        // Find first week (>= origWeek) with enough room
        let targetWeek = origWeek;
        let weekIdx = weeks.indexOf(origWeek);
        if (weekIdx < 0) weekIdx = 0;

        while (weekIdx < weeks.length) {
          const w = weeks[weekIdx];
          const cap  = capacityMap[roleId]?.[w];
          const avail = (cap?.capacity ?? 0)
            - (cap?.taken_other ?? 0)
            - (cap?.holiday ?? 0)
            - (cap?.buffer_threshold ?? 0);
          const used = weekConsumed[w] ?? 0;

          if (used + md <= avail) {
            targetWeek = w;
            break;
          }
          weekIdx++;
        }

        if (targetWeek !== origWeek) {
          // Move effort to the target week
          if (!result[taskId]) result[taskId] = {};
          if (!result[taskId][roleId]) result[taskId][roleId] = {};
          result[taskId][roleId][origWeek]  = 0;
          result[taskId][roleId][targetWeek] = (result[taskId][roleId][targetWeek] ?? 0) + md;
        }

        weekConsumed[targetWeek] = (weekConsumed[targetWeek] ?? 0) + md;
      }
    }
  }

  return result;
}

// ── Total effort for a task ───────────────────────────────────────────────────
export function getTaskTotalEffort(
  taskId: string,
  effortMap: EffortMap,
): number {
  const roleMap = effortMap[taskId];
  if (!roleMap) return 0;
  return Object.values(roleMap).reduce((sum, weekMap) => {
    return sum + Object.values(weekMap).reduce((s, v) => s + (v ?? 0), 0);
  }, 0);
}

// ── ETA derivation ────────────────────────────────────────────────────────────
/** Find the last week a task has any effort allocated */
export function deriveTaskEta(taskId: string, effortMap: EffortMap): string | null {
  const roleMap = effortMap[taskId];
  if (!roleMap) return null;
  let latest: string | null = null;
  for (const weekMap of Object.values(roleMap)) {
    for (const [week, md] of Object.entries(weekMap)) {
      if ((md ?? 0) > 0 && (!latest || week > latest)) latest = week;
    }
  }
  if (!latest) return null;
  // Return end of that week (Friday)
  const d = new Date(latest + "T00:00:00");
  d.setDate(d.getDate() + 4);
  return d.toISOString().slice(0, 10);
}
