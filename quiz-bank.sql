-- ChemistryHub Quiz Bank
-- شغّل هذا الملف مرة واحدة في Supabase SQL Editor.
-- الهدف: الطالب يرى ويقرأ اختبارات مواد فرقته فقط.

alter table public.ch_quizzes enable row level security;
alter table public.ch_quiz_questions enable row level security;

-- الاختبارات: الطالب لا يرى إلا الاختبارات المرتبطة بمادة في نفس فرقته.
drop policy if exists ch_quizzes_read on public.ch_quizzes;
create policy ch_quizzes_read on public.ch_quizzes
for select to authenticated
using (
  public.is_admin()
  or (
    active = true
    and subject_id is not null
    and exists (
      select 1
      from public.ch_subjects s
      join public.ch_years y on y.id = s.year_id
      join public.profiles p on p.id = auth.uid()
      where s.id = ch_quizzes.subject_id
        and s.active = true
        and y.active = true
        and y.year_number = case
          when p.grade ilike 'Year 1' then 1
          when p.grade ilike 'Year 2' then 2
          when p.grade ilike 'Year 3' then 3
          when p.grade ilike 'Year 4' then 4
          when p.grade ilike 'الفرقة الأولى' then 1
          when p.grade ilike 'الفرقة الثانية' then 2
          when p.grade ilike 'الفرقة الثالثة' then 3
          when p.grade ilike 'الفرقة الرابعة' then 4
          else 0
        end
    )
  )
);

-- الأسئلة تتبع صلاحية الاختبار نفسه.
drop policy if exists ch_questions_read on public.ch_quiz_questions;
create policy ch_questions_read on public.ch_quiz_questions
for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.ch_quizzes q
    where q.id = quiz_id
      and q.active = true
  )
);

-- الكتابة تظل للمدير فقط.
drop policy if exists ch_quizzes_write on public.ch_quizzes;
create policy ch_quizzes_write on public.ch_quizzes
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists ch_questions_write on public.ch_quiz_questions;
create policy ch_questions_write on public.ch_quiz_questions
for all to authenticated
using (public.is_admin())
with check (public.is_admin());
