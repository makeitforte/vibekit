"use client";

import { Role, Project, Task, EffortMap, CapacityMap } from "./types";
import { formatWeekRange, computeWeekRoleSummary, getTaskTotalEffort } from "./utils";

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

  const ws = wb.addWorksheet("Timeline", {
    views: [{ state: "frozen", xSplit: 6, ySplit: 7 }], // freeze sticky cols + summary rows
  });

  const STICKY_COLS = 6; // cb, drag, feat, pri, eta, total
  const totalCols   = STICKY_COLS + weeks.length * roles.length;

  // ── Column widths ───────────────────────────────────────────────────────────
  ws.getColumn(1).width = 4;   // checkbox
  ws.getColumn(2).width = 4;   // drag
  ws.getColumn(3).width = 30;  // feature
  ws.getColumn(4).width = 7;   // pri
  ws.getColumn(5).width = 10;  // eta
  ws.getColumn(6).width = 8;   // total
  for (let i = 0; i < weeks.length * roles.length; i++) {
    ws.getColumn(STICKY_COLS + 1 + i).width = 7;
  }

  // ── Row 1: Week headers ─────────────────────────────────────────────────────
  const weekHeaderRow = ws.getRow(1);
  weekHeaderRow.getCell(3).value = "Feature / Task";
  weekHeaderRow.getCell(4).value = "Pri";
  weekHeaderRow.getCell(5).value = "ETA";
  weekHeaderRow.getCell(6).value = "Total\nEffort";

  weeks.forEach((w, wi) => {
    const startCol = STICKY_COLS + 1 + wi * roles.length;
    const endCol   = startCol + roles.length - 1;
    const cell = weekHeaderRow.getCell(startCol);
    cell.value = formatWeekRange(w);
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.font = { bold: true, size: 10 };
    if (roles.length > 1) {
      ws.mergeCells(1, startCol, 1, endCol);
    }
    cell.border = { left: { style: "medium", color: { argb: "FFD1D5DB" } } };
  });

  weekHeaderRow.height = 20;
  weekHeaderRow.font = { bold: true, size: 10 };
  weekHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };

  // ── Row 2: Role sub-headers ─────────────────────────────────────────────────
  const roleHeaderRow = ws.getRow(2);
  weeks.forEach((w, wi) => {
    roles.forEach((role, ri) => {
      const col  = STICKY_COLS + 1 + wi * roles.length + ri;
      const cell = roleHeaderRow.getCell(col);
      cell.value = role.name;
      cell.alignment = { horizontal: "center" };
      cell.font = { bold: true, size: 9, color: { argb: toArgb(role.color) } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: roleBg(role.color) } };
      if (ri === 0) cell.border = { left: { style: "medium", color: { argb: "FFD1D5DB" } } };
    });
  });
  roleHeaderRow.height = 16;

  // ── Summary rows ────────────────────────────────────────────────────────────
  const allTaskIds = tasks.map(t => t.id);
  const summaryLabels = ["Capacity (mandays)", "Total Required", "Taken (other squad)", "Holiday / Day-off", "Buffer / Shortage", "Min Buffer Threshold"];
  const summaryFgColors = ["FFF9FAFB", "FFF0FDF4", "FFF9FAFB", "FFF9FAFB", "FFF9FAFB", "FFFFF5F5"];

  summaryLabels.forEach((label, si) => {
    const row = ws.getRow(3 + si);
    row.getCell(3).value = label;
    row.getCell(3).font  = { bold: false, size: 9, color: { argb: "FF6B7280" } };
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
  const lastSumRow = ws.getRow(3 + summaryLabels.length - 1);
  lastSumRow.eachCell(cell => {
    cell.border = { ...cell.border, bottom: { style: "medium", color: { argb: "FF9CA3AF" } } };
  });

  // ── Data rows ───────────────────────────────────────────────────────────────
  const sortedProjects = [...projects].sort((a, b) => a.priority_order - b.priority_order);
  const sortedTasks    = [...tasks].sort((a, b) => a.priority_order - b.priority_order);

  let dataRowIdx = 3 + summaryLabels.length + 1; // 1-based

  for (const [pi, proj] of sortedProjects.entries()) {
    // Project row
    const projRow  = ws.getRow(dataRowIdx++);
    projRow.height = 18;
    projRow.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
    projRow.getCell(3).value = proj.name;
    projRow.getCell(3).font  = { bold: true, size: 10 };
    projRow.getCell(4).value = `P${pi + 1}`;
    projRow.getCell(4).font  = { bold: true, size: 9 };
    projRow.getCell(5).value = proj.eta ? new Date(proj.eta + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";
    const projTotal = sortedTasks.filter(t => t.project_id === proj.id).reduce((s, t) => s + getTaskTotalEffort(t.id, effortMap), 0);
    projRow.getCell(6).value = projTotal || "—";
    projRow.getCell(6).font  = { bold: true, size: 10 };

    // Task rows
    for (const task of sortedTasks.filter(t => t.project_id === proj.id)) {
      const taskRow  = ws.getRow(dataRowIdx++);
      taskRow.height = 16;
      taskRow.getCell(3).value = "  " + task.name;
      taskRow.getCell(3).font  = { size: 10, color: { argb: "FF374151" } };
      taskRow.getCell(4).value = `P${pi + 1}`;
      taskRow.getCell(4).font  = { size: 9, color: { argb: "FF9CA3AF" } };
      taskRow.getCell(5).value = task.eta ? new Date(task.eta + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";
      const tot = getTaskTotalEffort(task.id, effortMap);
      taskRow.getCell(6).value = tot || "—";
      taskRow.getCell(6).font  = { bold: true, size: 10 };

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
