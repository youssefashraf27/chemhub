-- تشغيل هذا الملف مرة واحدة من Supabase > SQL Editor
-- يضيف بيانات الطالب اللازمة لصفحة إنشاء الحساب.
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists department text;
alter table public.profiles add column if not exists email text;

-- RLS: الطالب يقرأ/يعدل صفه فقط.
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select to authenticated using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
for insert to authenticated with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- مهم: لا تسمح لأي مستخدم بتغيير role.
-- لو عندك trigger prevent_profile_role_escalation بالفعل اتركه كما هو.
