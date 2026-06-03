-- Project Planner v2 — run after project-planner.sql
-- Adds user-selectable priority label (P1/P2/P3) independent of row order

alter table public.planner_projects
  add column if not exists priority_label text
    check (priority_label in ('P1','P2','P3'))
    default null;
