-- ChemistryHub FINAL database setup
-- شغّل الملف كله مرة واحدة في Supabase SQL Editor.
-- هذا الإصدار يستخدم جداول ch_* لتجنب أي تعارض مع جداول قديمة موجودة عندك.

create extension if not exists pgcrypto;

-- =========================
-- Profiles / Admin
-- =========================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  phone text,
  grade text,
  role text not null default 'student' check (role in ('student','admin','owner')),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('student','admin','owner'));

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role in ('admin','owner'));
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,email,full_name,phone,grade)
  values(new.id,new.email,new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'phone',new.raw_user_meta_data->>'grade')
  on conflict(id) do update set
    email=excluded.email,
    full_name=coalesce(excluded.full_name,public.profiles.full_name),
    phone=coalesce(excluded.phone,public.profiles.phone),
    grade=coalesce(excluded.grade,public.profiles.grade),
    updated_at=now();
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.handle_user_update()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  update public.profiles set
    email=new.email,
    full_name=coalesce(new.raw_user_meta_data->>'full_name',full_name),
    phone=coalesce(new.raw_user_meta_data->>'phone',phone),
    grade=coalesce(new.raw_user_meta_data->>'grade',grade),
    updated_at=now()
  where id=new.id;
  return new;
end; $$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated after update of email,raw_user_meta_data on auth.users for each row execute procedure public.handle_user_update();

insert into public.profiles(id,email,full_name,phone,grade)
select id,email,raw_user_meta_data->>'full_name',raw_user_meta_data->>'phone',raw_user_meta_data->>'grade'
from auth.users
on conflict(id) do update set
  email=excluded.email,
  full_name=coalesce(excluded.full_name,public.profiles.full_name),
  phone=coalesce(excluded.phone,public.profiles.phone),
  grade=coalesce(excluded.grade,public.profiles.grade);

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
using(id=auth.uid() or public.is_admin());
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated
with check(id=auth.uid());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
using(id=auth.uid() or public.is_admin())
with check(public.is_admin() or (id=auth.uid() and role=(select p.role from public.profiles p where p.id=auth.uid())));

-- =========================
-- Site settings
-- =========================
create table if not exists public.site_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
drop policy if exists settings_public_read on public.site_settings;
create policy settings_public_read on public.site_settings for select to anon,authenticated using(true);
drop policy if exists settings_admin_write on public.site_settings;
create policy settings_admin_write on public.site_settings for all to authenticated using(public.is_admin()) with check(public.is_admin());

insert into public.site_settings(key,value) values
('site_name','ChemistryHub'),
('brand_subtitle','كلية التربية • قسم الكيمياء'),
('hero_badge','🎓 بوابتك الدراسية'),
('hero_title','كلية التربية<br><strong>قسم الكيمياء</strong>'),
('hero_description','مكان واحد يجمع موادك، محاضراتك، الملخصات، الاختبارات، الأدوات الدراسية وكل ما تحتاجه خلال سنوات الدراسة.'),
('notice','هذا الموقع منصة طلابية تعليمية غير رسمية، والمحتوى قابل للتعديل والإضافة من لوحة الإدارة.'),
('stat_years','4'),('stat_semesters','8'),('stat_content','∞'),
('about_badge','About ChemistryHub'),
('about_title','منصة طلابية صُممت لتسهّل رحلة دراسة الكيمياء.'),
('about_text','أضف المواد والملفات والاختبارات والخدمات من لوحة الإدارة بدون تعديل أي كود.'),
('about_value_1','محتوى كيمياء منظم'),('about_value_2','وصول سريع للمواد'),('about_value_3','متوافق مع الهاتف'),('about_value_4','خفيف وسريع'),
('facebook',''),('youtube',''),('whatsapp',''),
('ai_url',''),('footer_text','كلية التربية • قسم الكيمياء')
on conflict(key) do nothing;

-- =========================
-- Academic years
-- =========================
create table if not exists public.ch_years (
  id uuid primary key default gen_random_uuid(),
  year_number integer not null unique check(year_number between 1 and 4),
  title text not null,
  description text default '',
  icon text default '🎓',
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.ch_years(year_number,title,description,icon,sort_order) values
(1,'الفرقة الأولى','المستوى التمهيدي والأساسيات','1️⃣',1),
(2,'الفرقة الثانية','مواد الكيمياء المتقدمة','2️⃣',2),
(3,'الفرقة الثالثة','التخصص والتطبيقات','3️⃣',3),
(4,'الفرقة الرابعة','التخصص والتخرج والتدريب','4️⃣',4)
on conflict(year_number) do nothing;

-- =========================
-- Subjects / files / quizzes
-- =========================
create table if not exists public.ch_subjects (
  id uuid primary key default gen_random_uuid(),
  year_id uuid not null references public.ch_years(id) on delete cascade,
  semester text not null,
  name text not null,
  teacher text default '',
  grade_label text default '—',
  description text default '',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists ch_subjects_unique on public.ch_subjects(year_id,semester,name);

create table if not exists public.ch_materials (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.ch_subjects(id) on delete cascade,
  title text not null,
  file_name text,
  storage_path text not null unique,
  mime_type text default 'application/pdf',
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create table if not exists public.ch_quizzes (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid references public.ch_subjects(id) on delete set null,
  title text not null,
  description text default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ch_quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.ch_quizzes(id) on delete cascade,
  question text not null,
  options jsonb not null default '[]'::jsonb,
  correct_index integer not null default 0 check(correct_index between 0 and 9),
  created_at timestamptz not null default now()
);

-- =========================
-- Services / announcements
-- =========================
create table if not exists public.ch_services (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  icon text default '✨',
  link text default '#',
  requires_login boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists ch_services_unique_title on public.ch_services(title);

create table if not exists public.ch_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text default '',
  link text default '',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.ch_services(title,description,icon,link,requires_login,sort_order) values
('بنك الاختبارات','اختبارات واختيارات متعددة يتم التحكم فيها من لوحة الإدارة.','📝','quizzes.html',true,1),
('المحاضرات والملفات','عرض ملفات كل مادة مع إمكانية رفع PDF من لوحة الإدارة.','📚','#',true,2),
('المساعد الذكي','رابط اختياري لمساعد تعليمي خارجي تضبطه من لوحة الإدارة.','🤖','#',false,3),
('حاسبة GPA','احسب معدلك بسرعة واحفظ المواد على جهازك.','📊','#gpa',true,4)
on conflict(title) do nothing;

-- =========================
-- RLS
-- =========================
alter table public.ch_years enable row level security;
alter table public.ch_subjects enable row level security;
alter table public.ch_materials enable row level security;
alter table public.ch_quizzes enable row level security;
alter table public.ch_quiz_questions enable row level security;
alter table public.ch_services enable row level security;
alter table public.ch_announcements enable row level security;

drop policy if exists ch_years_read on public.ch_years;
create policy ch_years_read on public.ch_years for select to anon,authenticated using(active=true or public.is_admin());
drop policy if exists ch_years_write on public.ch_years;
create policy ch_years_write on public.ch_years for all to authenticated using(public.is_admin()) with check(public.is_admin());

drop policy if exists ch_subjects_read on public.ch_subjects;
create policy ch_subjects_read on public.ch_subjects for select to anon,authenticated using(active=true or public.is_admin());
drop policy if exists ch_subjects_write on public.ch_subjects;
create policy ch_subjects_write on public.ch_subjects for all to authenticated using(public.is_admin()) with check(public.is_admin());

drop policy if exists ch_materials_read on public.ch_materials;
create policy ch_materials_read on public.ch_materials for select to authenticated using(true);
drop policy if exists ch_materials_write on public.ch_materials;
create policy ch_materials_write on public.ch_materials for all to authenticated using(public.is_admin()) with check(public.is_admin());

drop policy if exists ch_quizzes_read on public.ch_quizzes;
create policy ch_quizzes_read on public.ch_quizzes for select to authenticated using(active=true or public.is_admin());
drop policy if exists ch_quizzes_write on public.ch_quizzes;
create policy ch_quizzes_write on public.ch_quizzes for all to authenticated using(public.is_admin()) with check(public.is_admin());

drop policy if exists ch_questions_read on public.ch_quiz_questions;
create policy ch_questions_read on public.ch_quiz_questions for select to authenticated using(exists(select 1 from public.ch_quizzes q where q.id=quiz_id and (q.active=true or public.is_admin())));
drop policy if exists ch_questions_write on public.ch_quiz_questions;
create policy ch_questions_write on public.ch_quiz_questions for all to authenticated using(public.is_admin()) with check(public.is_admin());

drop policy if exists ch_services_read on public.ch_services;
create policy ch_services_read on public.ch_services for select to anon,authenticated using(active=true or public.is_admin());
drop policy if exists ch_services_write on public.ch_services;
create policy ch_services_write on public.ch_services for all to authenticated using(public.is_admin()) with check(public.is_admin());

drop policy if exists ch_announcements_read on public.ch_announcements;
create policy ch_announcements_read on public.ch_announcements for select to anon,authenticated using(active=true or public.is_admin());
drop policy if exists ch_announcements_write on public.ch_announcements;
create policy ch_announcements_write on public.ch_announcements for all to authenticated using(public.is_admin()) with check(public.is_admin());

-- =========================
-- Storage for PDFs
-- =========================
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('chemistryhub-files','chemistryhub-files',false,52428800,array['application/pdf'])
on conflict(id) do update set public=false,file_size_limit=52428800,allowed_mime_types=array['application/pdf'];

drop policy if exists chemistryhub_files_read on storage.objects;
create policy chemistryhub_files_read on storage.objects for select to authenticated using(bucket_id='chemistryhub-files');
drop policy if exists chemistryhub_files_insert on storage.objects;
create policy chemistryhub_files_insert on storage.objects for insert to authenticated with check(bucket_id='chemistryhub-files' and public.is_admin());
drop policy if exists chemistryhub_files_update on storage.objects;
create policy chemistryhub_files_update on storage.objects for update to authenticated using(bucket_id='chemistryhub-files' and public.is_admin()) with check(bucket_id='chemistryhub-files' and public.is_admin());
drop policy if exists chemistryhub_files_delete on storage.objects;
create policy chemistryhub_files_delete on storage.objects for delete to authenticated using(bucket_id='chemistryhub-files' and public.is_admin());

-- =========================
-- Storage for profile avatars
-- =========================
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('chemistryhub-avatars','chemistryhub-avatars',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists chemistryhub_avatars_read on storage.objects;
create policy chemistryhub_avatars_read on storage.objects for select to public using(bucket_id='chemistryhub-avatars');
drop policy if exists chemistryhub_avatars_insert on storage.objects;
create policy chemistryhub_avatars_insert on storage.objects for insert to authenticated with check(bucket_id='chemistryhub-avatars' and (split_part(name,'/',1)=auth.uid()::text));
drop policy if exists chemistryhub_avatars_update on storage.objects;
create policy chemistryhub_avatars_update on storage.objects for update to authenticated using(bucket_id='chemistryhub-avatars' and split_part(name,'/',1)=auth.uid()::text) with check(bucket_id='chemistryhub-avatars' and split_part(name,'/',1)=auth.uid()::text);
drop policy if exists chemistryhub_avatars_delete on storage.objects;
create policy chemistryhub_avatars_delete on storage.objects for delete to authenticated using(bucket_id='chemistryhub-avatars' and split_part(name,'/',1)=auth.uid()::text);

-- =========================
-- Updated-at helper
-- =========================
create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists profiles_updated_at on public.profiles; create trigger profiles_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
drop trigger if exists ch_years_updated_at on public.ch_years; create trigger ch_years_updated_at before update on public.ch_years for each row execute procedure public.set_updated_at();
drop trigger if exists ch_subjects_updated_at on public.ch_subjects; create trigger ch_subjects_updated_at before update on public.ch_subjects for each row execute procedure public.set_updated_at();
drop trigger if exists ch_quizzes_updated_at on public.ch_quizzes; create trigger ch_quizzes_updated_at before update on public.ch_quizzes for each row execute procedure public.set_updated_at();
drop trigger if exists ch_services_updated_at on public.ch_services; create trigger ch_services_updated_at before update on public.ch_services for each row execute procedure public.set_updated_at();
drop trigger if exists ch_announcements_updated_at on public.ch_announcements; create trigger ch_announcements_updated_at before update on public.ch_announcements for each row execute procedure public.set_updated_at();

-- =========================
-- Seed the original first-year subjects
-- =========================
insert into public.ch_subjects(year_id,semester,name,teacher,grade_label,sort_order)
select y.id,v.semester,v.name,'الدكتور',v.grade,v.ord
from public.ch_years y
cross join (values
('الفصل الدراسي الأول','أساسيات الكيمياء الفيزيائية','71',1),('الفصل الدراسي الأول','خواص مادة وحرارة','—',2),('الفصل الدراسي الأول','تحليل حجمي ووزني','—',3),('الفصل الدراسي الأول','أسس علم النبات','—',4),('الفصل الدراسي الأول','كيمياء بيئية','—',5),('الفصل الدراسي الأول','تحليل طيفي','—',6),('الفصل الدراسي الأول','جبر','—',7),('الفصل الدراسي الأول','مهنة التعليم وأدوار المعلم','—',8),('الفصل الدراسي الأول','علم نفس','—',9),('الفصل الدراسي الأول','منهج مدرسي','—',10),('الفصل الدراسي الأول','تواصل صفي','—',11),
('الفصل الدراسي الثاني','كيمياء مجموعات رئيسية','—',1),('الفصل الدراسي الثاني','بصر وبصريات هندسية وصوت','—',2),('الفصل الدراسي الثاني','كيمياء عضوية','—',3),('الفصل الدراسي الثاني','أسس علم الحيوان','—',4),('الفصل الدراسي الثاني','جيولوجيا','—',5),('الفصل الدراسي الثاني','كيمياء غير عضوية','—',6),('الفصل الدراسي الثاني','علوم بيئية','—',7),('الفصل الدراسي الثاني','قيادة تربوية','—',8),('الفصل الدراسي الثاني','علم نفس','—',9),('الفصل الدراسي الثاني','تربية مستدامة','—',10),('الفصل الدراسي الثاني','تاريخ','—',11),('الفصل الدراسي الثاني','تدريب ميداني','—',12),('الفصل الدراسي الثاني','إنجليزي','—',13)
) as v(semester,name,grade,ord)
where y.year_number=1
on conflict do nothing;

-- ضع حساب المدير بعد تشغيل الملف:
-- OWNER: after creating your account, run this once:
-- update public.profiles set role='owner' where email='YOUR_EMAIL_HERE';
-- مثال:
-- update public.profiles set role='admin' where email='abomotahosting@gmail.com';

-- لا تضع service_role key في ملفات الموقع.
