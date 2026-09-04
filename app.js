const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
if($('#year'))$('#year').textContent=new Date().getFullYear();
if($('#menuBtn'))$('#menuBtn').onclick=()=>{const n=$('#navLinks');n.style.display=n.style.display==='flex'?'none':'flex'};
if($('#themeBtn'))$('#themeBtn').onclick=()=>{document.documentElement.classList.toggle('dark');localStorage.setItem('chemistryTheme',document.documentElement.classList.contains('dark')?'dark':'light')};
if(localStorage.getItem('chemistryTheme')==='dark')document.documentElement.classList.add('dark');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
async function loadSite(){
 const {data:subs,error}=await supabaseClient.from('subjects').select('*').eq('active',true).order('year').order('semester').order('name');
 const data=error?null:subs;
 if(!data){ return; }
 window.dynamicSubjects=data;
 $$('.year-card').forEach(card=>card.onclick=()=>renderYear(card.dataset.year));
}
function renderYear(year){
 const view=$('#subjectView');const list=(window.dynamicSubjects||[]).filter(s=>String(s.year)===String(year));
 const groups={};list.forEach(s=>(groups[s.semester]??=[]).push(s));
 let html=`<div class="section-head"><span class="eyebrow">الفرقة ${year}</span><h2>الفصول الدراسية</h2><p>أسماء المواد متاحة للاستكشاف؛ فتح ملفات المادة يحتاج تسجيل دخول.</p></div>`;
 for(const [sem,arr] of Object.entries(groups)){html+=`<div class="semester"><h3>📚 ${esc(sem)}</h3><div class="subject-grid">${arr.map(s=>`<a class="subject" href="subject.html?subject=${encodeURIComponent(s.id)}" onclick="event.preventDefault();protectService(()=>location.href=this.href,'فتح ملفات المادة يحتاج تسجيل دخول.')"><div><strong>${esc(s.name)}</strong><small>${esc(s.teacher||'')}</small></div><b>${esc(s.grade_label||'—')}</b></a>`).join('')}</div></div>`}
 if(!list.length)html+=`<div class="card empty">لا توجد مواد مضافة لهذه الفرقة بعد.</div>`;view.innerHTML=html;location.hash='subjects';
}
let courses=JSON.parse(localStorage.getItem('chemCourses')||'[]');
function gp(g){if(g>=90)return 4;if(g>=85)return 3.7;if(g>=80)return 3.3;if(g>=75)return 3;if(g>=70)return 2.7;if(g>=65)return 2.3;if(g>=60)return 2;if(g>=50)return 1;return 0}
function renderCourses(){const l=$('#courseList');if(!l)return;l.innerHTML=courses.length?courses.map((c,i)=>`<div class="course-row"><span>${esc(c.name||'مادة')}</span><span>${c.grade}/100</span><span>${c.hours} ساعات</span><button onclick="removeCourse(${i})">×</button></div>`).join(''):'<p class="empty">لم تتم إضافة مواد بعد.</p>';let p=0,h=0;courses.forEach(c=>{p+=gp(+c.grade)*(+c.hours);h+=+c.hours});if($('#gpaValue'))$('#gpaValue').textContent=h?(p/h).toFixed(2):'0.00';if($('#hoursValue'))$('#hoursValue').textContent=`${h} ساعات`;localStorage.setItem('chemCourses',JSON.stringify(courses))}
window.removeCourse=async i=>{if(!(await requireLogin()))return showLoginRequired('تعديل حاسبة GPA يحتاج تسجيل دخول.');courses.splice(i,1);renderCourses()};
if($('#addCourse'))$('#addCourse').onclick=async()=>{if(!(await requireLogin()))return showLoginRequired('استخدام حاسبة GPA يحتاج تسجيل دخول.');const grade=+$('#courseGrade').value,hours=+$('#courseHours').value;if(!Number.isFinite(grade)||grade<0||grade>100||!hours)return alert('أدخل درجة صحيحة وعدد الساعات.');courses.push({name:$('#courseName').value.trim(),grade,hours});$('#courseName').value='';$('#courseGrade').value='';$('#courseHours').value='';renderCourses()};
if($('#clearCourses'))$('#clearCourses').onclick=async()=>{if(!(await requireLogin()))return showLoginRequired('تعديل حاسبة GPA يحتاج تسجيل دخول.');if(confirm('مسح كل المواد؟')){courses=[];renderCourses()}};
(async()=>{try{await setupAuthUI();await loadSite();renderCourses()}catch(e){console.error(e);renderCourses()}})();

(async()=>{
  try{
    const {data}=await supabaseClient.from('site_settings').select('key,value');
    const s={};(data||[]).forEach(x=>s[x.key]=x.value);
    const hero=document.querySelector('.hero h1'); if(hero&&s.hero_title) hero.innerHTML=esc(s.hero_title);
    const desc=document.querySelector('.hero p'); if(desc&&s.hero_description) desc.textContent=s.hero_description;
    const notice=document.querySelector('.notice p'); if(notice&&s.notice) notice.textContent=s.notice;
    const brand=document.querySelector('.brand span:last-child'); if(brand&&s.site_name) brand.firstChild.textContent=s.site_name;
  }catch(e){console.warn('settings load skipped',e)}
})();
