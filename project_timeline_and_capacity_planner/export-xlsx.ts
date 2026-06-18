"use client";

import { Role, Project, Task, EffortMap, CapacityMap } from "./types";
import { formatWeekRange, computeWeekRoleSummary, getTaskTotalEffort, deriveTaskEta } from "./utils";

// ── Colour helpers ────────────────────────────────────────────────────────────

/** Convert hex "#rrggbb" to ExcelJS ARGB "FFrrggbb" */
function toArgb(hex: string, alpha = "FF"): string {
  return alpha + hex.replace("#", "").toUpperCase();
}

const ROLE_BG_HEX: Record<string, string> = {
  "#16a268": "D9F5EB",
  "#b7860b": "FEF3C7",
  "#3b82f6": "DBEAFE",
  "#8b5cf6": "EDE9FE",
  "#06b6d4": "CFFAFE",
};

function roleBg(color: string): string {
  return "FF" + (ROLE_BG_HEX[color.toLowerCase()] ?? "F3F4F6");
}

// ── Status / priority helpers (mirror the grid) ─────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  todo: "To Do", prd_in_progress: "PRD In Progress", prd_ready: "PRD Ready",
  in_progress: "In Progress", done: "Done", released: "Released", cancelled: "Cancelled",
};
const STATUS_COLOR: Record<string, string> = {
  todo: "FF6B7280", prd_in_progress: "FFB45309", prd_ready: "FF047857",
  in_progress: "FF1D4ED8", done: "FF0E7A4E", released: "FF6D28D9", cancelled: "FF9CA3AF",
};

/** Same precedence as the grid: project's explicit label, else its priority order → P1/P2/P3. */
function resolveProjectLabel(proj: Project, order: number): "P1" | "P2" | "P3" {
  if (proj.priority_label) return proj.priority_label;
  if (order === 0) return "P1";
  if (order === 1) return "P2";
  return "P3";
}

function formatEta(eta: string | null): string {
  if (!eta) return "—";
  return new Date(eta + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Main export function ──────────────────────────────────────────────────────

export async function exportToXlsx(params: {
  roles: Role[];
  projects: Project[];
  tasks: Task[];
  effortMap: EffortMap;
  capacityMap: CapacityMap;
  weeks: string[];
  filename?: string;
}) {
  const { roles, projects, tasks, effortMap, capacityMap, weeks, filename = "project-timeline.xlsx" } = params;

  // Dynamic import so ExcelJS is only loaded when needed (keeps initial bundle small)
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "VibeKit";
  wb.created = new Date();

  // Frozen panel = 6 sticky cols (feat, project, pri, eta, status, total) + 8 top rows
  // (2 header rows + 6 summary rows). Mirrors the in-app grid's flat task layout.
  const STICKY_COLS  = 6;
  const HEADER_ROWS  = 2;
  const SUMMARY_ROWS = 6;
  const FROZEN_ROWS  = HEADER_ROWS + SUMMARY_ROWS; // 8

  const ws = wb.addWorksheet("Timeline", {
    views: [{ state: "frozen", xSplit: STICKY_COLS, ySplit: FROZEN_ROWS }],
  });

  // ── Column widths ───────────────────────────────────────────────────────────
  ws.getColumn(1).width = 34;  // Feature / Task
  ws.getColumn(2).width = 18;  // Project
  ws.getColumn(3).width = 6;   // Pri
  ws.getColumn(4).width = 11;  // ETA
  ws.getColumn(5).width = 15;  // Status
  ws.getColumn(6).width = 8;   // Total Effort
  for (let i = 0; i < weeks.length * roles.length; i++) {
    ws.getColumn(STICKY_COLS + 1 + i).width = 7;
  }

  const STICKY_HEADERS = ["Feature / Task", "Project", "Pri", "ETA", "Status", "Total\nEffort"];

  // ── Rows 1–2: sticky column headers (merged vertically) + week / role headers ──
  const weekHeaderRow = ws.getRow(1);
  const roleHeaderRow = ws.getRow(2);

  STICKY_HEADERS.forEach((label, i) => {
    const col  = i + 1;
    const cell = weekHeaderRow.getCell(col);
    cell.value = label;
    cell.font  = { bold: true, size: 10 };
    cell.alignment = { horizontal: i >= 2 ? "center" : "left", vertical: "middle", wrapText: true };
    ws.mergeCells(1, col, 2, col); // span both header rows
  });

  // Week groups (row 1) + role sub-headers (row 2)
  weeks.forEach((w, wi) => {
    const startCol = STICKY_COLS + 1 + wi * roles.length;
    const endCol   = startCol + roles.length - 1;
    const cell = weekHeaderRow.getCell(startCol);
    cell.value = formatWeekRange(w);
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.font = { bold: true, size: 10 };
    if (roles.length > 1) ws.mergeCells(1, startCol, 1, endCol);
    cell.border = { left: { style: "medium", color: { argb: "FFD1D5DB" } } };

    roles.forEach((role, ri) => {
      const rc   = roleHeaderRow.getCell(startCol + ri);
      rc.value = role.name;
      rc.alignment = { horizontal: "center" };
      rc.font = { bold: true, size: 9, color: { argb: toArgb(role.color) } };
      rc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: roleBg(role.color) } };
      if (ri === 0) rc.border = { left: { style: "medium", color: { argb: "FFD1D5DB" } } };
    });
  });

  weekHeaderRow.height = 22;
  weekHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
  roleHeaderRow.height = 16;

  // ── Summary rows (rows 3–8) ───────────────────────────────────────────────────
  const allTaskIds = tasks.map(t => t.id);
  const summaryLabels = ["Capacity (mandays)", "Total Required", "Taken (other squad)", "Holiday / Day-off", "Buffer / Shortage", "Min Buffer Threshold"];
  const summaryFgColors = ["FFF9FAFB", "FFF0FDF4", "FFF9FAFB", "FFF9FAFB", "FFF9FAFB", "FFFFF5F5"];

  summaryLabels.forEach((label, si) => {
    const row = ws.getRow(HEADER_ROWS + 1 + si);
    row.getCell(1).value = label;
    row.getCell(1).font  = { bold: false, size: 9, color: { argb: "FF6B7280" } };
    row.height = 16;
    row.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: summaryFgColors[si] } };

    weeks.forEach((w, wi) => {
      roles.forEach((role, ri) => {
        const col = STICKY_COLS + 1 + wi * roles.length + ri;
        const cell = row.getCell(col);
        const s = computeWeekRoleSummary(role.id, w, capacityMap, effortMap, allTaskIds);
        const cap = capacityMap[role.id]?.[w];

        let val: number | string = "—";
        if (si === 0) val = s.capacity;
        if (si === 1) val = s.totalRequired;
        if (si === 2) val = s.takenOther;
        if (si === 3) val = s.holiday;
        if (si === 4) val = s.buffer;
        if (si === 5) val = cap?.buffer_threshold ?? 0;

        if (typeof val === "number" && val === 0) val = "—";
        cell.value = val;
        cell.alignment = { horizontal: "center" };
        cell.font = { size: 9 };

        if (si === 4 && typeof val === "number") {
          cell.font = { size: 9, bold: val < 0, color: { argb: val < 0 ? "FFC22A32" : "FF0E7A4E" } };
          if (val < 0) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF2F2" } };
        }
        if (ri === 0) cell.border = { left: { style: "medium", color: { argb: "FFD1D5DB" } } };
      });
    });
  });

  // Thick border under last summary row
  const lastSumRow = ws.getRow(FROZEN_ROWS);
  lastSumRow.eachCell(cell => {
    cell.border = { ...cell.border, bottom: { style: "medium", color: { argb: "FF9CA3AF" } } };
  });

  // ── Data rows — flat task list (mirrors the grid; project shown as a column) ───
  const sortedProjects = [...projects].sort((a, b) => a.priority_order - b.priority_order);
  const sortedTasks    = [...tasks].sort((a, b) => a.priority_order - b.priority_order);
  const projOrder = new Map(sortedProjects.map((p, i) => [p.id, i]));

  let dataRowIdx = FROZEN_ROWS + 1; // 1-based, first row after the frozen summary block

  for (const task of sortedTasks) {
    const proj = sortedProjects.find(p => p.id === task.project_id);
    const taskRow  = ws.getRow(dataRowIdx++);
    taskRow.height = 16;

    // Feature / Task
    taskRow.getCell(1).value = task.name;
    taskRow.getCell(1).font  = { size: 10, color: { argb: "FF374151" } };

    // Project
    taskRow.getCell(2).value = proj?.name ?? "—";
    taskRow.getCell(2).font  = { size: 9, color: { argb: "FF6B7280" } };

    // Priority — task's own label takes precedence, else the project's resolved label
    const priLabel = task.priority_label ?? (proj ? resolveProjectLabel(proj, projOrder.get(proj.id) ?? 0) : "P3");
    taskRow.getCell(3).value = priLabel;
    taskRow.getCell(3).font  = { size: 9, bold: true, color: { argb: "FF6B7280" } };
    taskRow.getCell(3).alignment = { horizontal: "center" };

    // ETA — manual override, else auto-derived (last effort week's Friday)
    taskRow.getCell(4).value = formatEta(task.eta ?? deriveTaskEta(task.id, effortMap));
    taskRow.getCell(4).font  = { size: 9 };
    taskRow.getCell(4).alignment = { horizontal: "center" };

    // Status
    taskRow.getCell(5).value = STATUS_LABEL[task.status] ?? task.status;
    taskRow.getCell(5).font  = { size: 9, color: { argb: STATUS_COLOR[task.status] ?? "FF6B7280" } };

    // Total effort
    const tot = getTaskTotalEffort(task.id, effortMap);
    taskRow.getCell(6).value = tot || "—";
    taskRow.getCell(6).font  = { bold: true, size: 10 };
    taskRow.getCell(6).alignment = { horizontal: "center" };

    // Week × role effort cells
    weeks.forEach((w, wi) => {
      roles.forEach((role, ri) => {
        const col = STICKY_COLS + 1 + wi * roles.length + ri;
        const md  = effortMap[task.id]?.[role.id]?.[w] ?? 0;
        const cell = taskRow.getCell(col);
        if (md > 0) {
          cell.value = md;
          cell.alignment = { horizontal: "center" };
          cell.font  = { size: 10, bold: true, color: { argb: toArgb(role.color) } };
          cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: roleBg(role.color) } };
        }
        if (ri === 0) cell.border = { left: { style: "medium", color: { argb: "FFD1D5DB" } } };
      });
    });
  }

  // ── Download ────────────────────────────────────────────────────────────────
  const buffer  = await wb.xlsx.writeBuffer();
  const blob    = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement("a");
  a.href        = url;
  a.download    = filename;
  a.click();
  URL.revokeObjectURL(url);
}
