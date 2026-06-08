-- Project Planner — Board Sharing v1 — run after project-planner-v2.sql
-- Purely additive: new tables + helper function + RLS policy rewrite on existing
-- planner_* tables. No existing rows are touched, altered, or deleted.
--
-- Review before running. Safe to re-run (drops/recreates policies & functions).

-- ── 1. Sharing tables ─────────────────────────────────────────────────────────

-- A link an owner generates and can revoke. Token is opaque, generated client-side.
create table if not exists public.board_shares (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid references auth.users(id) on delete cascade not null,
  token       text unique not null,
  permission  text not null check (permission in ('view','edit')),
  created_at  timestamptz default now(),
  revoked_at  timestamptz
);

-- Created when an authenticated user redeems a share link (see redeem_board_share below).
create table if not exists public.board_members (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid references auth.users(id) on delete cascade not null,
  member_id   uuid references auth.users(id) on delete cascade not null,
  permission  text not null check (permission in ('view','edit')),
  joined_at   timestamptz default now(),
  unique (owner_id, member_id)
);

create index if not exists idx_board_shares_owner   on public.board_shares(owner_id);
create index if not exists idx_board_shares_token   on public.board_shares(token);
create index if not exists idx_board_members_owner  on public.board_members(owner_id);
create index if not exists idx_board_members_member on public.board_members(member_id);

alter table public.board_shares  enable row level security;
alter table public.board_members enable row level security;

drop policy if exists "owner manages own shares" on public.board_shares;
create policy "owner manages own shares" on public.board_shares
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
-- No public SELECT policy on board_shares — token redemption goes through the
-- security-definer function below, which avoids leaking other people's tokens/owners.

drop policy if exists "view memberships" on public.board_members;
create policy "view memberships" on public.board_members
  for select using (auth.uid() = member_id or auth.uid() = owner_id);

drop policy if exists "owner or member removes membership" on public.board_members;
create policy "owner or member removes membership" on public.board_members
  for delete using (auth.uid() = owner_id or auth.uid() = member_id);
-- No public INSERT policy — membership rows are only created via redeem_board_share,
-- which runs as security definer (bypasses RLS for that single, validated insert).

-- ── 2. Redeem a share link ────────────────────────────────────────────────────
-- Validates the token, upserts a board_members row for the calling user, and
-- returns the resulting (owner_id, permission). Runs as security definer so it
-- can read board_shares / write board_members without needing public policies on them.

create or replace function public.redeem_board_share(p_token text)
returns table(owner_id uuid, permission text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_owner uuid;
  v_perm  text;
begin
  select s.owner_id, s.permission into v_owner, v_perm
  from public.board_shares s
  where s.token = p_token and s.revoked_at is null;

  if v_owner is null then
    raise exception 'invalid_or_revoked_share';
  end if;

  if v_owner = auth.uid() then
    raise exception 'cannot_join_own_board';
  end if;

  insert into public.board_members (owner_id, member_id, permission)
  values (v_owner, auth.uid(), v_perm)
  on conflict (owner_id, member_id) do update set permission = excluded.permission;

  return query select v_owner, v_perm;
end;
$$;

grant execute on function public.redeem_board_share(text) to authenticated;

-- ── 3. Board access helper ────────────────────────────────────────────────────
-- True if the caller owns the board, or is a member with sufficient permission.
-- security definer + stable: avoids RLS recursion when used inside other policies.

create or replace function public.has_board_access(target_owner uuid, need_edit boolean)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_owner = auth.uid()
    or exists (
      select 1 from public.board_members m
      where m.owner_id = target_owner
        and m.member_id = auth.uid()
        and (m.permission = 'edit' or not need_edit)
    );
$$;

grant execute on function public.has_board_access(uuid, boolean) to authenticated;

-- ── 4. Rewrite planner_* RLS to allow board collaborators ────────────────────
-- user_id on these tables identifies the BOARD (its owner). Replace the old
-- "auth.uid() = user_id" blanket policy with fine-grained, permission-aware ones.

-- Roles
drop policy if exists "own roles" on public.planner_roles;
create policy "board roles select" on public.planner_roles
  for select using (public.has_board_access(user_id, false));
create policy "board roles insert" on public.planner_roles
  for insert with check (public.has_board_access(user_id, true));
create policy "board roles update" on public.planner_roles
  for update using (public.has_board_access(user_id, true)) with check (public.has_board_access(user_id, true));
create policy "board roles delete" on public.planner_roles
  for delete using (public.has_board_access(user_id, true));

-- Projects
drop policy if exists "own projects" on public.planner_projects;
create policy "board projects select" on public.planner_projects
  for select using (public.has_board_access(user_id, false));
create policy "board projects insert" on public.planner_projects
  for insert with check (public.has_board_access(user_id, true));
create policy "board projects update" on public.planner_projects
  for update using (public.has_board_access(user_id, true)) with check (public.has_board_access(user_id, true));
create policy "board projects delete" on public.planner_projects
  for delete using (public.has_board_access(user_id, true));

-- Tasks
drop policy if exists "own tasks" on public.planner_tasks;
create policy "board tasks select" on public.planner_tasks
  for select using (public.has_board_access(user_id, false));
create policy "board tasks insert" on public.planner_tasks
  for insert with check (public.has_board_access(user_id, true));
create policy "board tasks update" on public.planner_tasks
  for update using (public.has_board_access(user_id, true)) with check (public.has_board_access(user_id, true));
create policy "board tasks delete" on public.planner_tasks
  for delete using (public.has_board_access(user_id, true));

-- Weekly efforts
drop policy if exists "own efforts" on public.planner_weekly_efforts;
create policy "board efforts select" on public.planner_weekly_efforts
  for select using (public.has_board_access(user_id, false));
create policy "board efforts insert" on public.planner_weekly_efforts
  for insert with check (public.has_board_access(user_id, true));
create policy "board efforts update" on public.planner_weekly_efforts
  for update using (public.has_board_access(user_id, true)) with check (public.has_board_access(user_id, true));
create policy "board efforts delete" on public.planner_weekly_efforts
  for delete using (public.has_board_access(user_id, true));

-- Resource capacity
drop policy if exists "own capacity" on public.planner_resource_capacity;
create policy "board capacity select" on public.planner_resource_capacity
  for select using (public.has_board_access(user_id, false));
create policy "board capacity insert" on public.planner_resource_capacity
  for insert with check (public.has_board_access(user_id, true));
create policy "board capacity update" on public.planner_resource_capacity
  for update using (public.has_board_access(user_id, true)) with check (public.has_board_access(user_id, true));
create policy "board capacity delete" on public.planner_resource_capacity
  for delete using (public.has_board_access(user_id, true));

-- Change history — user_id is the ACTOR (who made the change). To correctly
-- scope "show me this board's history" — including entries made by collaborators —
-- we need to know which board each entry belongs to, independent of who made it.
-- Some entries (e.g. capacity_change) have neither project_id nor task_id, so we
-- can't derive the board from a join. Solution: add an explicit owner_id column.
--
-- Purely additive: new NULLABLE column + one-time backfill that copies the
-- existing user_id into it (which was always correct pre-sharing, since every
-- existing row's actor IS its board's owner — no row's data is altered/removed).

alter table public.planner_change_history
  add column if not exists owner_id uuid references auth.users(id) on delete cascade;

update public.planner_change_history
  set owner_id = user_id
  where owner_id is null;

create index if not exists idx_change_history_owner on public.planner_change_history(owner_id);

drop policy if exists "own history" on public.planner_change_history;
drop policy if exists "board history select" on public.planner_change_history;
drop policy if exists "board history insert" on public.planner_change_history;

create policy "board history select" on public.planner_change_history
  for select using (public.has_board_access(owner_id, false));

create policy "board history insert" on public.planner_change_history
  for insert with check (
    auth.uid() = user_id  -- you can only log actions as yourself
    and public.has_board_access(owner_id, true)
  );

-- ── 5. Let board collaborators see each other's display profiles ─────────────
-- The Share dialog needs to resolve member_id UUIDs to names/initials/colors,
-- and collaborators need to attribute history entries to real people. The
-- original "Users can read own profile" policy only allowed auth.uid() = id;
-- this widens SELECT (read-only) to anyone who shares a board with you, in
-- either direction (you're their owner, or they're your owner).

drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can read own or collaborator profiles" on public.profiles;
create policy "Users can read own or collaborator profiles" on public.profiles
  for select using (
    auth.uid() = id
    or exists (
      select 1 from public.board_members m
      where (m.owner_id = auth.uid() and m.member_id = profiles.id)
         or (m.member_id = auth.uid() and m.owner_id = profiles.id)
    )
  );
