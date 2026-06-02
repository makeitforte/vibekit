-- VibeKit Supabase Setup
-- Run this in: Supabase Dashboard → SQL Editor → New query

-- ── 1. Profiles table ────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id         uuid references auth.users(id) on delete cascade primary key,
  name       text not null,
  initials   text not null,
  color      text not null default '#16a268',
  created_at timestamptz default now()
);

-- ── 2. Row Level Security ─────────────────────────────────────────────────────
alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ── 3. Auto-create profile on signup ─────────────────────────────────────────
-- Runs for every auth method: email, GitHub, Google
create or replace function public.handle_new_user()
returns trigger as $$
declare
  display_name text;
  user_initials text;
begin
  -- Extract name from OAuth metadata or email
  display_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'user_name',
    split_part(new.email, '@', 1)
  );

  -- Generate initials (up to 2 characters)
  user_initials := upper(
    left(split_part(display_name, ' ', 1), 1) ||
    left(split_part(display_name, ' ', 2), 1)
  );
  if user_initials = '' then
    user_initials := upper(left(display_name, 1));
  end if;

  insert into public.profiles (id, name, initials, color)
  values (new.id, display_name, user_initials, '#16a268')
  on conflict (id) do nothing;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
