-- ChemistryHub Admin Setup
-- شغّل هذا الملف مرة واحدة من Supabase > SQL Editor.
-- لا تضع Service Role Key داخل الموقع. لوحة الإدارة تعمل بمفتاح publishable
-- وتتحقق من role=admin بواسطة RLS وSECURITY DEFINER.

alter table public.profiles add column if not exists role text not null default 'student';
alter table public.profiles add column if not exists student_code text;

-- الحقول التي تستخدمها لوحة الإدارة والموقع.
alter table public.subjects add column if not exists year_level text;
alter table public.subjects add column if not exists department text;
alter table public.subjects add column if not exists term text;
alter table public.subjects add column if not exists name text;
alter table public.subjects add column if not exists teacher text default 'الدكتور';
alter table public.subjects add column if not exists code text;
alter table public.subjects add column if not exists link text;
alter table public.subjects add column if not exists type text default 'mandatory';
alter table public.subjects add column if not exists icon text;
alter table public.subjects add column if not exists created_at timestamptz default now();

alter table public.quizzes add column if not exists year_level text;
alter table public.quizzes add column if not exists department text;
alter table public.quizzes add column if not exists title text;
alter table public.quizzes add column if not exists time_limit integer default 20;
alter table public.quizzes add column if not exists subject_code text;
alter table public.quizzes add column if not exists video_url text;
alter table public.quizzes add column if not exists is_active boolean default true;
alter table public.quizzes add column if not exists created_at timestamptz default now();

alter table public.questions add column if not exists quiz_id bigint;
alter table public.questions add column if not exists question_text text;
alter table public.questions add column if not exists question_type text default 'mcq';
alter table public.questions add column if not exists option_1 text;
alter table public.questions add column if not exists option_2 text;
alter table public.questions add column if not exists option_3 text;
alter table public.questions add column if not exists option_4 text;
alter table public.questions add column if not exists correct_option integer;
alter table public.questions add column if not exists explanation text;
alter table public.questions add column if not exists image_url text;

alter table public.quiz_results add column if not exists student_name text;
alter table public.quiz_results add column if not exists quiz_title text;
alter table public.quiz_results add column if not exists score numeric;
alter table public.quiz_results add column if not exists total_score numeric;
alter table public.quiz_results add column if not exists created_at timestamptz default now();

-- دالة التحقق من المشرف. SECURITY DEFINER تمنع مشكلة recursion مع RLS.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- منع الطالب من تحويل نفسه إلى admin.
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_role_escalation on public.profiles;
create trigger trg_prevent_role_escalation
before update on public.profiles
for each row execute function public.prevent_role_escalation();

alter table public.profiles enable row level security;

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all" on public.profiles
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- صلاحيات الإدارة على المحتوى.
do $$ begin
  execute 'alter table public.subjects enable row level security';
  execute 'alter table public.quizzes enable row level security';
  execute 'alter table public.questions enable row level security';
  execute 'alter table public.quiz_results enable row level security';
  execute 'alter table public.news enable row level security';
  execute 'alter table public.notes enable row level security';
exception when undefined_table then null;
end $$;

drop policy if exists "subjects_admin_all" on public.subjects;
create policy "subjects_admin_all" on public.subjects for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "quizzes_admin_all" on public.quizzes;
create policy "quizzes_admin_all" on public.quizzes for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "questions_admin_all" on public.questions;
create policy "questions_admin_all" on public.questions for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "quiz_results_admin_all" on public.quiz_results;
create policy "quiz_results_admin_all" on public.quiz_results for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "news_admin_all" on public.news;
create policy "news_admin_all" on public.news for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "notes_admin_all" on public.notes;
create policy "notes_admin_all" on public.notes for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- جلب كل مستخدمي Auth مع بيانات profiles للمشرف فقط.
create or replace function public.admin_list_users()
returns table(
  id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  full_name text,
  phone text,
  department text,
  student_code text,
  role text
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  return query
  select
    u.id,
    u.email::text,
    u.created_at,
    u.last_sign_in_at,
    coalesce(p.full_name, u.raw_user_meta_data->>'full_name')::text,
    p.phone,
    p.department,
    p.student_code,
    coalesce(p.role,'student')::text
  from auth.users u
  left join public.profiles p on p.id=u.id
  order by u.created_at desc;
end;
$$;

revoke all on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated;

-- حذف حساب Auth للمشرف فقط.
create or replace function public.admin_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'cannot delete current admin';
  end if;
  delete from auth.users where id=p_user_id;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- =========================================================
-- مهم جدًا: بعد تشغيل الملف، اجعل حسابك Admin مرة واحدة فقط:
-- UPDATE public.profiles SET role='admin' WHERE email='YOUR_EMAIL';
-- =========================================================
