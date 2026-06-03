-- Project Timeline & Capacity Planner — Supabase Schema
-- Run in: Supabase Dashboard → SQL Editor → New query

-- ── 1. Roles ─────────────────────────────────────────────────────────────────
-- Customisable per user. Default rows seeded on first load by the app.
create table if not exists public.planner_roles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  name          text not null,
  color         text not null default '#16a268',  -- hex for the role badge
  display_order int  not null default 0,
  created_at    timestamptz default now()
);

-- ── 2. Projects ───────────────────────────────────────────────────────────────
create table if not exists public.planner_projects (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade not null,
  name           text not null,
  priority_order int  not null default 0,   -- row position → P1/P2/P3 ranking
  status         text not null default 'active'
                   check (status in ('active','done','cancelled')),
  eta            date,
  notes          text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- ── 3. Tasks ─────────────────────────────────────────────────────────────────
create table if not exists public.planner_tasks (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid references public.planner_projects(id) on delete cascade not null,
  user_id        uuid references auth.users(id) on delete cascade not null,
  name           text not null,
  priority_order int  not null default 0,   -- row position within/across projects
  status         text not null default 'todo'
                   check (status in ('todo','in_progress','done','released','cancelled')),
  eta            date,
  notes          text,
  links          text[],
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- ── 4. Weekly efforts ────────────────────────────────────────────────────────
-- One row per (task, role, week). mandays is the allocated effort.
create table if not exists public.planner_weekly_efforts (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid references public.planner_tasks(id) on delete cascade not null,
  role_id     uuid references public.planner_roles(id) on delete cascade not null,
  user_id     uuid references auth.users(id) on delete cascade not null,
  week_start  date not null,                -- always a Monday (ISO week start)
  mandays     numeric(6,2) not null default 0 check (mandays >= 0),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique (task_id, role_id, week_start)
);

-- ── 5. Resource capacity ─────────────────────────────────────────────────────
-- Editable per (user, role, week): capacity ceiling, taken/holiday deductions,
-- and the min-buffer threshold that triggers priority cascade.
create table if not exists public.planner_resource_capacity (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete cascade not null,
  role_id          uuid references public.planner_roles(id) on delete cascade not null,
  week_start       date not null,
  capacity         numeric(6,2) not null default 0 check (capacity >= 0),
  taken_other      numeric(6,2) not null default 0 check (taken_other >= 0),  -- other squad
  holiday          numeric(6,2) not null default 0 check (holiday >= 0),
  buffer_threshold numeric(6,2) not null default 0 check (buffer_threshold >= 0),
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  unique (user_id, role_id, week_start)
);

-- ── 6. Change history ────────────────────────────────────────────────────────
create table if not exists public.planner_change_history (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  project_id  uuid references public.planner_projects(id) on delete set null,
  task_id     uuid references public.planner_tasks(id) on delete set null,
  change_type text not null
                check (change_type in (
                  'priority_change','mandays_change','status_change',
                  'cascade_push','capacity_change','project_created',
                  'task_created','project_archived','project_restored'
                )),
  field_name  text,
  old_value   text,
  new_value   text,
  notes       text,
  created_at  timestamptz default now()
);

-- ── 7. Row Level Security ─────────────────────────────────────────────────────
alter table public.planner_roles             enable row level security;
alter table public.planner_projects          enable row level security;
alter table public.planner_tasks             enable row level security;
alter table public.planner_weekly_efforts    enable row level security;
alter table public.planner_resource_capacity enable row level security;
alter table public.planner_change_history    enable row level security;

-- Roles
create policy "own roles" on public.planner_roles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Projects
create policy "own projects" on public.planner_projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Tasks
create policy "own tasks" on public.planner_tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Weekly efforts
create policy "own efforts" on public.planner_weekly_efforts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Resource capacity
create policy "own capacity" on public.planner_resource_capacity
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Change history
create policy "own history" on public.planner_change_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── 8. Indexes ────────────────────────────────────────────────────────────────
create index if not exists idx_planner_projects_user     on public.planner_projects(user_id, priority_order);
create index if not exists idx_planner_tasks_project     on public.planner_tasks(project_id, priority_order);
create index if not exists idx_planner_efforts_task      on public.planner_weekly_efforts(task_id, week_start);
create index if not exists idx_planner_efforts_week      on public.planner_weekly_efforts(user_id, week_start);
create index if not exists idx_planner_capacity_week     on public.planner_resource_capacity(user_id, week_start);
create index if not exists idx_planner_history_project   on public.planner_change_history(project_id, created_at desc);

-- ── 9. updated_at triggers ───────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger trg_projects_updated before update on public.planner_projects
  for each row execute function public.set_updated_at();
create trigger trg_tasks_updated before update on public.planner_tasks
  for each row execute function public.set_updated_at();
create trigger trg_efforts_updated before update on public.planner_weekly_efforts
  for each row execute function public.set_updated_at();
create trigger trg_capacity_updated before update on public.planner_resource_capacity
  for each row execute function public.set_updated_at();
