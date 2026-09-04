-- ChemistryHub / Supabase database setup
-- Run this once in Supabase Dashboard -> SQL Editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  phone text,
  grade text,
  role text not null default 'student' check (role in ('student','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Create/sync a profile whenever an Auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id,email,full_name,phone,grade)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'grade'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    phone = coalesce(excluded.phone, public.profiles.phone),
    grade = coalesce(excluded.grade, public.profiles.grade);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Keep profile data synced when user metadata/email changes.
create or replace function public.handle_user_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles
  set
    email = new.email,
    full_name = coalesce(new.raw_user_meta_data->>'full_name', full_name),
    phone = coalesce(new.raw_user_meta_data->>'phone', phone),
    grade = coalesce(new.raw_user_meta_data->>'grade', grade),
    updated_at = now()
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
after update of email, raw_user_meta_data on auth.users
for each row execute procedure public.handle_user_update();

-- Backfill existing users (including the phone already stored in raw_user_meta_data).
insert into public.profiles (id,email,full_name,phone,grade)
select
  u.id,
  u.email,
  u.raw_user_meta_data->>'full_name',
  u.raw_user_meta_data->>'phone',
  u.raw_user_meta_data->>'grade'
from auth.users u
on conflict (id) do update set
  email = excluded.email,
  full_name = coalesce(excluded.full_name, public.profiles.full_name),
  phone = coalesce(excluded.phone, public.profiles.phone),
  grade = coalesce(excluded.grade, public.profiles.grade);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Students can read their own profile; admins can read all profiles.
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_admin());

-- A student can update their own personal fields, but cannot promote themselves.
-- Admins can update any profile, including the role.
drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin" on public.profiles
for update to authenticated
using (id = auth.uid() or public.is_admin())
with check (
  public.is_admin()
  or (
    id = auth.uid()
    and role = (select p.role from public.profiles p where p.id = auth.uid())
  )
);

-- Optional: allow authenticated users to create only their own profile if needed.
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
for insert to authenticated
with check (id = auth.uid());

-- Make updated_at current on profile edits.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

-- After creating/logging into your owner account, make it admin:
-- update public.profiles set role='admin' where id='YOUR-USER-UUID';

-- IMPORTANT:
-- public.profiles.phone is the site's phone field.
-- auth.users.phone is Supabase's verified phone-auth field and should not be
-- filled by exposing a service_role key in the browser. If Phone Auth/SMS is
-- enabled, Supabase can verify/update auth.users.phone through its Auth flow.
