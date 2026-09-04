-- ChemistryHub complete database setup
-- Run this whole file once in Supabase SQL Editor.

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

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  year integer not null check (year between 1 and 4),
  semester text not null,
  name text not null,
  teacher text default '',
  grade_label text default '—',
  description text default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists subjects_unique_name_year_semester on public.subjects(year,semester,name);

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  title text not null,
  file_name text,
  storage_path text not null unique,
  mime_type text default 'application/pdf',
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid references public.subjects(id) on delete set null,
  title text not null,
  description text default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  question text not null,
  options jsonb not null default '[]'::jsonb,
  correct_index integer not null default 0 check (correct_index between 0 and 9),
  created_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

-- Existing users -> profiles
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,email,full_name,phone,grade)
  values(new.id,new.email,new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'phone',new.raw_user_meta_data->>'grade')
  on conflict(id) do update set email=excluded.email,full_name=coalesce(excluded.full_name,profiles.full_name),phone=coalesce(excluded.phone,profiles.phone),grade=coalesce(excluded.grade,profiles.grade);
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.handle_user_update()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  update public.profiles set email=new.email,full_name=coalesce(new.raw_user_meta_data->>'full_name',full_name),phone=coalesce(new.raw_user_meta_data->>'phone',phone),grade=coalesce(new.raw_user_meta_data->>'grade',grade),updated_at=now() where id=new.id;
  return new;
end; $$;
drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated after update of email,raw_user_meta_data on auth.users for each row execute procedure public.handle_user_update();

insert into public.profiles(id,email,full_name,phone,grade)
select id,email,raw_user_meta_data->>'full_name',raw_user_meta_data->>'phone',raw_user_meta_data->>'grade' from auth.users
on conflict(id) do update set email=excluded.email,full_name=coalesce(excluded.full_name,profiles.full_name),phone=coalesce(excluded.phone,profiles.phone),grade=coalesce(excluded.grade,profiles.grade);

-- Seed subjects from the original static site if they are not already present.
insert into public.subjects(year,semester,name,teacher,grade_label)
values
(1,'الفصل الدراسي الأول','أساسيات الكيمياء الفيزيائية','الدكتور','71'),(1,'الفصل الدراسي الأول','خواص مادة وحرارة','الدكتور','—'),(1,'الفصل الدراسي الأول','تحليل حجمي ووزني','الدكتور','—'),(1,'الفصل الدراسي الأول','أسس علم النبات','الدكتور','—'),(1,'الفصل الدراسي الأول','كيمياء بيئية','الدكتور','—'),(1,'الفصل الدراسي الأول','تحليل طيفي','الدكتور','—'),(1,'الفصل الدراسي الأول','جبر','الدكتور','—'),(1,'الفصل الدراسي الأول','مهنة التعليم وأدوار المعلم','الدكتور','—'),(1,'الفصل الدراسي الأول','علم نفس','الدكتور','—'),(1,'الفصل الدراسي الأول','منهج مدرسي','الدكتور','—'),(1,'الفصل الدراسي الأول','تواصل صفي','الدكتور','—'),
(1,'الفصل الدراسي الثاني','كيمياء مجموعات رئيسية','الدكتور','—'),(1,'الفصل الدراسي الثاني','بصر وبصريات هندسية وصوت','الدكتور','—'),(1,'الفصل الدراسي الثاني','كيمياء عضوية','الدكتور','—'),(1,'الفصل الدراسي الثاني','أسس علم الحيوان','الدكتور','—'),(1,'الفصل الدراسي الثاني','جيولوجيا','الدكتور','—'),(1,'الفصل الدراسي الثاني','كيمياء غير عضوية','الدكتور','—'),(1,'الفصل الدراسي الثاني','علوم بيئية','الدكتور','—'),(1,'الفصل الدراسي الثاني','قيادة تربوية','الدكتور','—'),(1,'الفصل الدراسي الثاني','علم نفس','الدكتور','—'),(1,'الفصل الدراسي الثاني','تربية مستدامة','الدكتور','—'),(1,'الفصل الدراسي الثاني','تاريخ','الدكتور','—'),(1,'الفصل الدراسي الثاني','تدريب ميداني','الدكتور','—'),(1,'الفصل الدراسي الثاني','إنجليزي','الدكتور','—')
on conflict(year,semester,name) do nothing;

insert into public.site_settings(key,value) values
('site_name','ChemistryHub'),('hero_title','كلية التربية قسم الكيمياء'),('hero_description','مكان واحد يجمع موادك، محاضراتك، الملخصات، الاختبارات والأدوات الدراسية.'),('notice','هذا الموقع منصة طلابية تعليمية غير رسمية، والمحتوى قابل للإضافة والتعديل من لوحة الإدارة.'),('facebook','#'),('youtube','#'),('whatsapp','#')
on conflict(key) do nothing;

-- Admin helper
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public as $$
select exists(select 1 from public.profiles where id=auth.uid() and role='admin'); $$;

-- RLS
alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.materials enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.site_settings enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using(id=auth.uid() or public.is_admin());
create or replace function public.protect_profile_role()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.role is distinct from new.role and not public.is_admin() then
    raise exception 'Only an admin can change profile roles';
  end if;
  return new;
end; $$;
drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role before update on public.profiles for each row execute procedure public.protect_profile_role();

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated using(id=auth.uid() or public.is_admin()) with check(id=auth.uid() or public.is_admin());
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated with check(id=auth.uid());

-- Public browsing: subjects, quiz list/settings can be read. Actual materials/files remain auth-only.
drop policy if exists subjects_public_read on public.subjects;
create policy subjects_public_read on public.subjects for select to anon,authenticated using(active=true or public.is_admin());
drop policy if exists subjects_admin_insert on public.subjects;
create policy subjects_admin_insert on public.subjects for insert to authenticated with check(public.is_admin());
drop policy if exists subjects_admin_update on public.subjects;
create policy subjects_admin_update on public.subjects for update to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists subjects_admin_delete on public.subjects;
create policy subjects_admin_delete on public.subjects for delete to authenticated using(public.is_admin());

drop policy if exists materials_auth_read on public.materials;
create policy materials_auth_read on public.materials for select to authenticated using(true);
drop policy if exists materials_admin_insert on public.materials;
create policy materials_admin_insert on public.materials for insert to authenticated with check(public.is_admin());
drop policy if exists materials_admin_delete on public.materials;
create policy materials_admin_delete on public.materials for delete to authenticated using(public.is_admin());

drop policy if exists quizzes_auth_read on public.quizzes;
create policy quizzes_auth_read on public.quizzes for select to authenticated using(active=true or public.is_admin());
drop policy if exists quizzes_admin_insert on public.quizzes;
create policy quizzes_admin_insert on public.quizzes for insert to authenticated with check(public.is_admin());
drop policy if exists quizzes_admin_update on public.quizzes;
create policy quizzes_admin_update on public.quizzes for update to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists quizzes_admin_delete on public.quizzes;
create policy quizzes_admin_delete on public.quizzes for delete to authenticated using(public.is_admin());

drop policy if exists questions_auth_read on public.quiz_questions;
create policy questions_auth_read on public.quiz_questions for select to authenticated using(exists(select 1 from public.quizzes q where q.id=quiz_id and (q.active=true or public.is_admin())));
drop policy if exists questions_admin_insert on public.quiz_questions;
create policy questions_admin_insert on public.quiz_questions for insert to authenticated with check(public.is_admin());
drop policy if exists questions_admin_update on public.quiz_questions;
create policy questions_admin_update on public.quiz_questions for update to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists questions_admin_delete on public.quiz_questions;
create policy questions_admin_delete on public.quiz_questions for delete to authenticated using(public.is_admin());

drop policy if exists settings_public_read on public.site_settings;
create policy settings_public_read on public.site_settings for select to anon,authenticated using(true);
drop policy if exists settings_admin_write on public.site_settings;
create policy settings_admin_write on public.site_settings for all to authenticated using(public.is_admin()) with check(public.is_admin());

-- Private Storage bucket for lecture PDFs.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('chemistry-files','chemistry-files',false,31457280,array['application/pdf'])
on conflict(id) do update set public=false,file_size_limit=31457280,allowed_mime_types=array['application/pdf'];

drop policy if exists chemistry_files_read on storage.objects;
create policy chemistry_files_read on storage.objects for select to authenticated using(bucket_id='chemistry-files');
drop policy if exists chemistry_files_admin_insert on storage.objects;
create policy chemistry_files_admin_insert on storage.objects for insert to authenticated with check(bucket_id='chemistry-files' and public.is_admin());
drop policy if exists chemistry_files_admin_update on storage.objects;
create policy chemistry_files_admin_update on storage.objects for update to authenticated using(bucket_id='chemistry-files' and public.is_admin()) with check(bucket_id='chemistry-files' and public.is_admin());
drop policy if exists chemistry_files_admin_delete on storage.objects;
create policy chemistry_files_admin_delete on storage.objects for delete to authenticated using(bucket_id='chemistry-files' and public.is_admin());

-- Updated timestamps
create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists profiles_updated_at on public.profiles; create trigger profiles_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
drop trigger if exists subjects_updated_at on public.subjects; create trigger subjects_updated_at before update on public.subjects for each row execute procedure public.set_updated_at();
drop trigger if exists quizzes_updated_at on public.quizzes; create trigger quizzes_updated_at before update on public.quizzes for each row execute procedure public.set_updated_at();

-- After running this file, make your account admin:
-- update public.profiles set role='admin' where email='YOUR_EMAIL_HERE';
-- Verify:
-- select email,role from public.profiles where email='YOUR_EMAIL_HERE';

-- IMPORTANT: never put a service_role key in frontend files.
