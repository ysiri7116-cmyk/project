-- CivicTrack database schema
-- Run this entire file in Supabase Dashboard -> SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null default 'citizen' check (role in ('citizen', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.issues (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  title varchar(120) not null check (char_length(trim(title)) between 5 and 120),
  category text not null check (category in ('Roads & Potholes', 'Waste & Sanitation', 'Water Supply', 'Streetlights', 'Public Safety', 'Parks & Public Spaces', 'Other')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  location varchar(180) not null check (char_length(trim(location)) between 3 and 180),
  description varchar(2000) not null check (char_length(trim(description)) between 10 and 2000),
  status text not null default 'reported' check (status in ('reported', 'in_progress', 'resolved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists issues_created_at_idx on public.issues (created_at desc);
create index if not exists issues_status_idx on public.issues (status);
create index if not exists issues_reporter_id_idx on public.issues (reporter_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists issues_updated_at on public.issues;
create trigger issues_updated_at before update on public.issues
for each row execute function public.set_updated_at();

-- Create a profile automatically whenever Supabase Auth creates a user.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''), 'citizen');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- The Express backend uses the service-role/secret key, so it performs all
-- authorization checks itself. RLS is enabled as defence in depth; no browser
-- client policy is granted because the browser never accesses Supabase directly.
alter table public.profiles enable row level security;
alter table public.issues enable row level security;

-- Do not expose the service-role key to the browser. Only trusted server code
-- should use it. Supabase service role bypasses RLS, so backend checks matter.
