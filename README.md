# ChemistryHub — نسخة مطوّرة

تم إصلاح وتجهيز نظام الحسابات وإضافة لوحة إدارة.

## أهم التعديلات

- تسجيل دخول فعلي عبر Supabase Auth.
- الاحتفاظ بالجلسة وإظهار اسم المستخدم والبريد في الموقع.
- زر تسجيل خروج واضح من قائمة الحساب.
- صفحة `account.html` لعرض بيانات الحساب.
- إنشاء الحساب مع الاسم والهاتف والفرقة.
- التعامل الصحيح مع تفعيل البريد الإلكتروني: إذا كان مطلوباً، تظهر رسالة للمستخدم بدلاً من اعتباره مسجلاً تلقائياً.
- استعادة كلمة المرور مع صفحة `reset-password.html`.
- إضافة `admin.html` لإدارة المستخدمين والصلاحيات.
- إضافة `supabase.sql` لإنشاء جدول profiles وRLS وآلية إنشاء الملف الشخصي تلقائياً.
- إضافة `supabase-config.js` و`auth.js` لتجميع إعدادات ووظائف المصادقة.
- الحفاظ على حاسبة GPA والمواد والوضع الليلي.

## تشغيل لوحة الإدارة

1. افتح Supabase Dashboard للمشروع.
2. اذهب إلى SQL Editor وشغّل الملف `supabase.sql`.
3. أنشئ حساب المدير من `login.html` بالطريقة العادية.
4. من Supabase > Authentication > Users خذ UUID الخاص بحساب المدير.
5. نفّذ في SQL Editor:
   `update public.profiles set role='admin' where id='UUID-HERE';`
6. سجّل الدخول ثم افتح `admin.html`.

**مهم:** لا تضع `service_role` key في ملفات الموقع. المفتاح الموجود في `supabase-config.js` هو مفتاح anon/public ويمكن استخدامه في الواجهة مع RLS.

## إعدادات Supabase المطلوبة

في Authentication > URL Configuration، اجعل Site URL هو رابط موقعك الفعلي، وأضف رابط:
`reset-password.html`
إلى Redirect URLs إذا كان مشروعك يتطلب ذلك.

إذا كان Email Confirmation مفعلاً، يجب على الطالب تأكيد بريده قبل تسجيل الدخول.

## هيكل الملفات

- `index.html` — الصفحة الرئيسية.
- `login.html` — تسجيل/دخول/استعادة الحساب.
- `account.html` — بيانات الحساب.
- `admin.html` — لوحة الإدارة.
- `reset-password.html` — تغيير كلمة المرور بعد رابط الاستعادة.
- `auth.js` — وظائف الحسابات المشتركة.
- `supabase-config.js` — إعدادات Supabase.
- `supabase.sql` — قاعدة البيانات وRLS.
- `app.js` — تفاعل الصفحة وحاسبة GPA.
- `data.js` — بيانات الفرق والمواد.
- `subject.html` — صفحة المادة.
- `style.css` — التصميم.
