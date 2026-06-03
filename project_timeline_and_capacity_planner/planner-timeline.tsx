"use client";

import { Role, Project, Task, EffortMap, PlannerDateRange } from "./types";
import { formatWeekRange, getTaskTotalEffort } from "./utils";
import { cn } from "@/lib/cn";

interface Props {
  roles: Role[];
  projects: Project[];
  tasks: Task[];
  effortMap: EffortMap;
  dateRange: PlannerDateRange;
  weeks: string[];
}

const ROLE_EC_CLASS = ["ec-be", "ec-fw", "ec-fa", "ec-fi", "ec-qa"];

export function PlannerTimeline({ roles, projects, tasks, effortMap, weeks }: Props) {
  const sortedProjects = [...projects].sort((a, b) => a.priority_order - b.priority_order);
  const sortedTasks    = [...tasks].sort((a, b) => a.priority_order - b.priority_order);

  // Find the first and last week a task has effort (for Gantt bars)
  function getTaskWeekRange(taskId: string): { first: string | null; last: string | null } {
    let first: string | null = null;
    let last: string | null = null;
    const roleMap = effortMap[taskId];
    if (!roleMap) return { first: null, last: null };
    for (const weekMap of Object.values(roleMap)) {
      for (const [w, md] of Object.entries(weekMap)) {
        if ((md ?? 0) > 0) {
          if (!first || w < first) first = w;
          if (!last  || w > last ) last  = w;
        }
      }
    }
    return { first, last };
  }

  function getWeekRoleTotal(taskId: string, week: string): number {
    return roles.reduce((s, r) => s + (effortMap[taskId]?.[r.id]?.[week] ?? 0), 0);
  }

  return (
    <div className="timeline-view">
      <div className="gantt-wrap">
        <table className="gantt-table">
          <thead>
            <tr>
              <th>Feature / Task</th>
              {weeks.map(w => (
                <th key={w} className="gantt-week-col">
                  {formatWeekRange(w)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedProjects.map((proj, pi) => {
              const projTasks = sortedTasks.filter(t => t.project_id === proj.id);
              const totalEffort = projTasks.reduce((s, t) => s + getTaskTotalEffort(t.id, effortMap), 0);

              // Find project span
              let projFirst: string | null = null;
              let projLast: string | null = null;
              for (const task of projTasks) {
                const { first, last } = getTaskWeekRange(task.id);
                if (first && (!projFirst || first < projFirst)) projFirst = first;
                if (last  && (!projLast  || last  > projLast )) projLast  = last;
              }
              const isPushed = projFirst && weeks.indexOf(projFirst) > 0;

              return [
                /* Project row */
                <tr key={`proj-${proj.id}`} className="gantt-row gantt-project-row">
                  <td>
                    <div className="gantt-name">
                      <span className={`pri-badge pri-${Math.min(pi + 1, 3)}`}>P{pi + 1}</span>
                      {proj.name}
                      {isPushed && <span className="push-tag">→{projFirst ? `W${weeks.indexOf(projFirst) + 1}` : ""}</span>}
                      <span className={cn("inline-status", pi === 0 ? "st-ip" : "st-td")} style={{ marginLeft: "auto", cursor: "default" }}>
                        <span className="st-dot" style={{ background: pi === 0 ? "#3b82f6" : "var(--fg-4)" }} />
                        {pi === 0 ? "In Progress" : "To Do"}
                      </span>
                    </div>
                  </td>
                  {weeks.map((w, wi) => {
                    const inRange = projFirst && projLast && w >= projFirst && w <= projLast;
                    const isBlocked = isPushed && projFirst && w < projFirst;
                    if (isBlocked) return <td key={w} className="gantt-hatch" />;
                    if (!inRange)  return <td key={w} className="gantt-empty" />;
                    const isCurrent = w === projFirst;
                    return (
                      <td key={w} className="gantt-bar-cell">
                        <div className="gantt-bar gantt-bar-all" style={{ width: "100%" }}>
                          {isCurrent && totalEffort > 0 ? `${totalEffort} md` : ""}
                        </div>
                      </td>
                    );
                  })}
                </tr>,

                /* Task rows */
                ...projTasks.map((task) => {
                  const { first: tFirst, last: tLast } = getTaskWeekRange(task.id);
                  const taskTotal = getTaskTotalEffort(task.id, effortMap);

                  return (
                    <tr key={`task-${task.id}`} className="gantt-row gantt-task">
                      <td>
                        <div className="gantt-name">{task.name}</div>
                      </td>
                      {weeks.map((w, wi) => {
                        const md = getWeekRoleTotal(task.id, w);
                        const isBlocked = isPushed && projFirst && w < projFirst;
                        if (isBlocked) return <td key={w} className="gantt-hatch" />;
                        if (md === 0) return <td key={w} className="gantt-empty" />;

                        // Determine dominant role for bar color
                        let maxMd = 0;
                        let dominantRoleIdx = 0;
                        roles.forEach((r, ri) => {
                          const m = effortMap[task.id]?.[r.id]?.[w] ?? 0;
                          if (m > maxMd) { maxMd = m; dominantRoleIdx = ri; }
                        });
                        const ecClass = ROLE_EC_CLASS[dominantRoleIdx % ROLE_EC_CLASS.length];

                        return (
                          <td key={w} className="gantt-bar-cell">
                            <div
                              className="gantt-bar"
                              style={{
                                width: "100%",
                                background: `${roles[dominantRoleIdx]?.color ?? "#16a268"}18`,
                                border: `1px solid ${roles[dominantRoleIdx]?.color ?? "#16a268"}40`,
                                color: roles[dominantRoleIdx]?.color ?? "#0e7a4e",
                              }}
                            >
                              {md} md
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                }),

                /* Spacer row */
                <tr key={`spacer-${proj.id}`} style={{ height: 6 }}>
                  <td colSpan={weeks.length + 1} style={{ border: "none", background: "var(--bg-sunken)" }} />
                </tr>,
              ];
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="gantt-legend">
        <span className="toolbar-label">Legend</span>
        {roles.map((role, ri) => (
          <span key={role.id} className="legend-item" style={{ color: role.color }}>
            <span className="legend-swatch" style={{ background: `${role.color}18`, border: `1px solid ${role.color}40` }} />
            {role.name}
          </span>
        ))}
        <span className="legend-item" style={{ color: "var(--fg-3)" }}>
          <span className="legend-hatch" />
          Blocked (priority cascade)
        </span>
      </div>
    </div>
  );
}
