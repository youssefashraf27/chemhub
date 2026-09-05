-- ChemistryHub Student Chat - النسخة الأساسية بعد التحديث
-- شغّل هذا الملف مرة واحدة في Supabase SQL Editor.

create table if not exists public.ch_chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  sender_name text not null default 'طالب',
  grade text not null,
  message text not null default '',
  attachment_path text,
  attachment_name text,
  attachment_type text,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.ch_chat_messages enable row level security;
-- إظهار شارة OWNER للطلاب أيضًا
alter table public.ch_chat_messages add column if not exists sender_role text not null default 'student';

create index if not exists ch_chat_messages_grade_created_idx on public.ch_chat_messages(grade, created_at desc);

create or replace function public.prepare_chat_message()
returns trigger language plpgsql security definer set search_path=public as $$
declare p public.profiles;
begin
  select * into p from public.profiles where id = new.sender_id;
  if p.id is null then raise exception 'لا يوجد ملف مستخدم لهذا الحساب'; end if;
  if p.grade is null or trim(p.grade) = '' then raise exception 'يجب تحديد الفرقة أولاً'; end if;
  new.sender_name := coalesce(nullif(trim(p.full_name), ''), split_part(coalesce(p.email,''),'@',1), 'طالب');
  new.sender_role := coalesce(p.role,'student');
  new.grade := p.grade;
  return new;
end;
$$;

drop trigger if exists prepare_chat_message_trigger on public.ch_chat_messages;
create trigger prepare_chat_message_trigger before insert on public.ch_chat_messages for each row execute procedure public.prepare_chat_message();
update public.ch_chat_messages m
set sender_role=coalesce(p.role,'student')
from public.profiles p
where p.id=m.sender_id;


-- إعدادات الإدارة: قفل الشات / رفع الملفات
create table if not exists public.ch_chat_settings (
  id integer primary key check(id=1),
  locked boolean not null default false,
  attachments_enabled boolean not null default true,
  lock_message text not null default 'لا يمكن إرسال رسائل حاليًا.',
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.ch_chat_settings enable row level security;
insert into public.ch_chat_settings(id) values(1) on conflict(id) do nothing;

create or replace function public.chat_settings_guard()
returns trigger language plpgsql security definer set search_path=public as $$
declare s public.ch_chat_settings; p public.profiles;
begin
  select * into s from public.ch_chat_settings where id=1;
  select * into p from public.profiles where id=auth.uid();
  if coalesce(s.locked,false) and coalesce(p.role,'student') <> 'admin' then raise exception 'الشات مقفول حاليًا من الإدارة'; end if;
  if not coalesce(s.attachments_enabled,true) and new.attachment_path is not null and coalesce(p.role,'student') <> 'admin' then raise exception 'رفع الملفات متوقف حاليًا من الإدارة'; end if;
  return new;
end;
$$;
drop trigger if exists chat_settings_guard on public.ch_chat_messages;
create trigger chat_settings_guard before insert on public.ch_chat_messages for each row execute procedure public.chat_settings_guard();

-- سياسات الرسائل
drop policy if exists ch_chat_select on public.ch_chat_messages;
create policy ch_chat_select on public.ch_chat_messages for select to authenticated using(public.is_admin() or grade=(select p.grade from public.profiles p where p.id=auth.uid()));
drop policy if exists ch_chat_insert on public.ch_chat_messages;
create policy ch_chat_insert on public.ch_chat_messages for insert to authenticated with check(sender_id=auth.uid() and grade=(select p.grade from public.profiles p where p.id=auth.uid()));
drop policy if exists ch_chat_delete on public.ch_chat_messages;
create policy ch_chat_delete on public.ch_chat_messages for delete to authenticated using(sender_id=auth.uid() or public.is_admin());
drop policy if exists ch_chat_update_admin on public.ch_chat_messages;
create policy ch_chat_update_admin on public.ch_chat_messages for update to authenticated using(public.is_admin()) with check(public.is_admin());

-- سياسات إعدادات الشات
drop policy if exists ch_chat_settings_read on public.ch_chat_settings;
create policy ch_chat_settings_read on public.ch_chat_settings for select to authenticated using(true);
drop policy if exists ch_chat_settings_admin on public.ch_chat_settings;
create policy ch_chat_settings_admin on public.ch_chat_settings for all to authenticated using(public.is_admin()) with check(public.is_admin());

-- التخزين: صور وPDF وWord وTXT حتى 10MB
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('chemistryhub-chat','chemistryhub-chat',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists chemistryhub_chat_files_select on storage.objects;
create policy chemistryhub_chat_files_select on storage.objects for select to authenticated using(bucket_id='chemistryhub-chat' and (public.is_admin() or split_part(name,'/',1)=(select p.grade from public.profiles p where p.id=auth.uid())));
drop policy if exists chemistryhub_chat_files_insert on storage.objects;
create policy chemistryhub_chat_files_insert on storage.objects for insert to authenticated with check(bucket_id='chemistryhub-chat' and split_part(name,'/',1)=(select p.grade from public.profiles p where p.id=auth.uid()) and split_part(name,'/',2)=auth.uid()::text);
drop policy if exists chemistryhub_chat_files_delete on storage.objects;
create policy chemistryhub_chat_files_delete on storage.objects for delete to authenticated using(bucket_id='chemistryhub-chat' and (public.is_admin() or split_part(name,'/',2)=auth.uid()::text));

-- Realtime
do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='ch_chat_messages') then alter publication supabase_realtime add table public.ch_chat_messages; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='ch_chat_settings') then alter publication supabase_realtime add table public.ch_chat_settings; end if;
end $$;
