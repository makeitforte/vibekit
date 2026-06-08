-- New change_type values for the change history — run after board-sharing.sql
-- Purely additive: widens the change_type check constraint to allow new
-- values ('project_deleted', 'task_deleted', 'eta_change'). No existing
-- rows are touched. Safe to re-run.

alter table public.planner_change_history
  drop constraint if exists planner_change_history_change_type_check;

alter table public.planner_change_history
  add constraint planner_change_history_change_type_check
  check (change_type in (
    'priority_change','mandays_change','status_change',
    'cascade_push','capacity_change','project_created',
    'task_created','project_archived','project_restored',
    'project_deleted','task_deleted','eta_change'
  ));
