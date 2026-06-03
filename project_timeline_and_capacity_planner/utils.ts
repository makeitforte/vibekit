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

export interface CascadeChange {
  taskId: string;
  roleId: string;
  fromWeek: string;
  toWeek: string;
  amount: number;
}

/**
 * Fill-from-top cascade algorithm:
 *
 * For each week × role where buffer < 0:
 *   1. Walk tasks top-to-bottom (priority order).
 *   2. Accumulate effort until we exceed available capacity (= capacity - taken - holiday).
 *      The task that causes the overflow is the "overflow point".
 *   3. At the overflow point: keep only what fits (buffer = 0), push the rest to next week.
 *   4. Every task BELOW the overflow point in that week: push ALL effort to next week.
 *
 * "Next week" means the immediately following week in the `weeks` array.
 * Tasks pushed to next week may cascade further (run this function again if needed).
 *
 * Returns the updated effort map and a list of changes for audit logging.
 */
export function runCascadeRecalculate(
  orderedTaskIds: string[],   // sorted top → bottom (index 0 = highest priority)
  weeks: string[],             // sorted chronologically (ISO YYYY-MM-DD Mondays)
  roleIds: string[],
  effortMap: EffortMap,
  capacityMap: CapacityMap,
): { newEffortMap: EffortMap; changes: CascadeChange[] } {
  const result: EffortMap = JSON.parse(JSON.stringify(effortMap));
  const changes: CascadeChange[] = [];

  for (const roleId of roleIds) {
    for (let wi = 0; wi < weeks.length; wi++) {
      const week = weeks[wi];
      const cap = capacityMap[roleId]?.[week];
      // Available = capacity minus deductions; target is buffer >= 0
      const available = (cap?.capacity ?? 0) - (cap?.taken_other ?? 0) - (cap?.holiday ?? 0);
      if (available <= 0) {
        // No capacity at all — push every task with effort here to next week
        if (wi + 1 >= weeks.length) continue;
        const nextWeek = weeks[wi + 1];
        for (const taskId of orderedTaskIds) {
          const md = result[taskId]?.[roleId]?.[week] ?? 0;
          if (md <= 0) continue;
          result[taskId][roleId][week] = 0;
          result[taskId][roleId][nextWeek] = (result[taskId][roleId][nextWeek] ?? 0) + md;
          changes.push({ taskId, roleId, fromWeek: week, toWeek: nextWeek, amount: md });
        }
        continue;
      }

      let cumulative = 0;
      let overflowFound = false;

      for (const taskId of orderedTaskIds) {
        if (!result[taskId]?.[roleId]) continue;
        const md = result[taskId][roleId][week] ?? 0;
        if (md <= 0) continue;

        if (overflowFound) {
          // Below overflow point → push everything to next week
          if (wi + 1 < weeks.length) {
            const nextWeek = weeks[wi + 1];
            if (!result[taskId][roleId]) result[taskId][roleId] = {};
            result[taskId][roleId][week] = 0;
            result[taskId][roleId][nextWeek] = (result[taskId][roleId][nextWeek] ?? 0) + md;
            changes.push({ taskId, roleId, fromWeek: week, toWeek: nextWeek, amount: md });
          }
        } else {
          cumulative += md;
          if (cumulative > available) {
            // This is the overflow point
            overflowFound = true;
            const overflow = cumulative - available;
            const keep     = md - overflow;

            if (!result[taskId][roleId]) result[taskId][roleId] = {};
            result[taskId][roleId][week] = Math.max(0, keep);

            if (overflow > 0 && wi + 1 < weeks.length) {
              const nextWeek = weeks[wi + 1];
              result[taskId][roleId][nextWeek] = (result[taskId][roleId][nextWeek] ?? 0) + overflow;
              changes.push({ taskId, roleId, fromWeek: week, toWeek: nextWeek, amount: overflow });
            }
          }
          // else: fits within available capacity, cumulative stays
        }
      }
    }
  }

  return { newEffortMap: result, changes };
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
