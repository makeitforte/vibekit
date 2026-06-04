-- Project Planner v2 — run after project-planner.sql
-- Safe to re-run (all statements use IF NOT EXISTS / IF EXISTS)

-- 1. User-selectable priority label (independent of row order)
alter table public.planner_projects
  add column if not exists priority_label text
    check (priority_label in ('P1','P2','P3'))
    default null;

-- 2. Expand project status to match task statuses
--    Migrate existing 'active' → 'in_progress' first, then update constraint
update public.planner_projects set status = 'in_progress' where status = 'active';
alter table public.planner_projects
  drop constraint if exists planner_projects_status_check;
alter table public.planner_projects
  add constraint planner_projects_status_check
    check (status in ('todo','in_progress','done','released','cancelled'));
-- Update default for new projects
alter table public.planner_projects
  alter column status set default 'todo';

-- 3. Explicit archive flag (done/released stay in grid until manually archived)
alter table public.planner_projects
  add column if not exists is_archived boolean not null default false;

alter table public.planner_tasks
  add column if not exists is_archived boolean not null default false;

-- 4. Per-task priority label (independent from project priority)
alter table public.planner_tasks
  add column if not exists priority_label text
    check (priority_label in ('P1','P2','P3'))
    default null;
