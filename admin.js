const client = window.supabaseClient || supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabaseClient = client;
const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
let subjects=[], files=[], quizzes=[], users=[];

function msg(text, error=false){ $('message').textContent=text||''; $('message').className='admin-msg '+(error?'error':'success'); }
function openTab(id){ document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===id)); document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.id===id)); }
window.openTab=openTab;
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>openTab(b.dataset.tab));
$('refreshBtn').onclick=loadAll;

async function boot(){
  try{
    const u=await getCurrentUser();
    if(!u){ location.href='login.html?next='+encodeURIComponent(location.href); return; }
    const {data:me,error}=await client.from('profiles').select('role').eq('id',u.id).single();
    if(error||me?.role!=='admin'){
      document.body.innerHTML='<main class="section"><div class="container"><div class="card" style="text-align:center"><h2>⛔ غير مصرح بالدخول</h2><p>هذه الصفحة مخصصة للمديرين فقط.</p><a class="btn primary" href="index.html">العودة للموقع</a></div></div></main>';return;
    }
    await loadAll();
  }catch(e){console.error(e);msg('تعذر تحميل لوحة الإدارة. شغّل supabase.sql أولاً وتأكد من إعدادات Supabase.',true);}
}

async function loadAll(){
  msg('جاري التحديث...');
  const results=await Promise.all([
    client.from('subjects').select('*').order('year').order('semester').order('name'),
    client.from('materials').select('*,subjects(name)').order('created_at',{ascending:false}),
    client.from('quizzes').select('*,subjects(name),quiz_questions(id)').order('created_at',{ascending:false}),
    client.from('profiles').select('id,full_name,email,phone,grade,role,created_at').order('created_at',{ascending:false}),
    client.from('site_settings').select('key,value')
  ]);
  const [a,b,c,d,e]=results;
  if(a.error){msg(a.error.message,true);return;} if(b.error){msg(b.error.message,true);return;} if(c.error){msg(c.error.message,true);return;} if(d.error){msg(d.error.message,true);return;} if(e.error){msg(e.error.message,true);return;}
  subjects=a.data||[];files=b.data||[];quizzes=c.data||[];users=d.data||[];
  renderStats();renderSubjects();fillSubjectSelects();renderFiles();renderQuizzes();renderUsers();renderSettings(e.data||[]);msg('تم التحديث.');
}
function renderStats(){ $('total').textContent=users.length; $('students').textContent=users.filter(x=>x.role!=='admin').length; $('admins').textContent=users.filter(x=>x.role==='admin').length; $('subjectCount').textContent=subjects.length; }
function renderSubjects(){
 $('subjectsList').innerHTML=subjects.map(s=>`<div class="item"><div><strong>${esc(s.name)}</strong><div class="muted">الفرقة ${s.year} • ${esc(s.semester)} • ${esc(s.teacher||'بدون مدرس')}</div></div><div class="item-actions"><button class="btn small" onclick="editSubject('${s.id}')">تعديل</button><button class="danger" onclick="deleteSubject('${s.id}')">حذف</button></div></div>`).join('')||'<div class="card">لا توجد مواد.</div>';
}
window.editSubject=id=>{const s=subjects.find(x=>x.id===id);if(!s)return;$('subjectId').value=s.id;$('subjectName').value=s.name;$('subjectTeacher').value=s.teacher||'';$('subjectYear').value=s.year;$('subjectSemester').value=s.semester;$('subjectGrade').value=s.grade_label||'';$('subjectDescription').value=s.description||'';openTab('subjects');scrollTo(0,0)};
window.deleteSubject=async id=>{if(!confirm('حذف المادة؟ سيتم حذف المواد والاختبارات المرتبطة بها أيضاً.'))return;const {error}=await client.from('subjects').delete().eq('id',id);if(error)alert(error.message);else loadAll();};
$('subjectForm').onsubmit=async e=>{e.preventDefault();const id=$('subjectId').value;const row={name:$('subjectName').value.trim(),teacher:$('subjectTeacher').value.trim(),year:Number($('subjectYear').value),semester:$('subjectSemester').value,grade_label:$('subjectGrade').value.trim(),description:$('subjectDescription').value.trim()};const q=id?client.from('subjects').update(row).eq('id',id):client.from('subjects').insert(row);const {error}=await q;if(error)alert(error.message);else{$('subjectForm').reset();$('subjectId').value='';loadAll();}};
$('cancelSubject').onclick=()=>{$('subjectForm').reset();$('subjectId').value='';};
function fillSubjectSelects(){const opts=subjects.map(s=>`<option value="${s.id}">${esc(s.name)} — الفرقة ${s.year}</option>`).join('');$('fileSubject').innerHTML='<option value="">اختر المادة</option>'+opts;$('quizSubject').innerHTML='<option value="">اختبار عام</option>'+opts;}

$('fileForm').onsubmit=async e=>{e.preventDefault();const sid=$('fileSubject').value,file=$('fileInput').files[0],title=$('fileTitle').value.trim();if(!sid||!file||!title)return; if(file.type!=='application/pdf'){alert('مسموح PDF فقط.');return;} if(file.size>30*1024*1024){alert('الحد الأقصى 30MB.');return;}
 const subject=subjects.find(s=>s.id===sid);const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');const path=`${sid}/${Date.now()}-${safe}`;$('uploadBtn').disabled=true;$('uploadProgress').textContent='جاري الرفع...';
 const up=await client.storage.from('chemistry-files').upload(path,file,{contentType:'application/pdf',upsert:false});if(up.error){$('uploadBtn').disabled=false;$('uploadProgress').textContent='';alert(up.error.message);return;}
 const ins=await client.from('materials').insert({subject_id:sid,title,file_name:file.name,storage_path:path,mime_type:file.type,size_bytes:file.size});if(ins.error){await client.storage.from('chemistry-files').remove([path]);$('uploadBtn').disabled=false;alert(ins.error.message);return;}
 $('uploadBtn').disabled=false;$('fileForm').reset();$('uploadProgress').textContent=`تم رفع ${subject?.name||''} بنجاح.`;loadAll();};
window.deleteFile=async(id,path)=>{if(!confirm('حذف الملف؟'))return;const r=await client.storage.from('chemistry-files').remove([path]);if(r.error){alert(r.error.message);return;}const d=await client.from('materials').delete().eq('id',id);if(d.error)alert(d.error.message);else loadAll();};
async function renderFiles(){ $('filesList').innerHTML=files.map(f=>`<div class="item"><div><strong>${esc(f.title)}</strong><div class="muted">${esc(f.subjects?.name||'')} • ${esc(f.file_name||'')}</div></div><div class="item-actions"><button class="btn small" onclick="previewFile('${f.id}')">معاينة</button><button class="danger" onclick="deleteFile('${f.id}','${esc(f.storage_path)}')">حذف</button></div></div>`).join('')||'<div class="card">لا توجد ملفات مرفوعة.</div>';}
window.previewFile=async id=>{const f=files.find(x=>x.id===id);if(!f)return;const {data,error}=await client.storage.from('chemistry-files').createSignedUrl(f.storage_path,600);if(error)alert(error.message);else window.open(data.signedUrl,'_blank');};

function addQuestionUI(q={}){const wrap=document.createElement('div');wrap.className='question';wrap.dataset.id=q.id||'';wrap.innerHTML=`<button type="button" class="danger" style="float:left" onclick="this.closest('.question').remove()">حذف السؤال</button><label>السؤال</label><textarea class="q-text" rows="2" required>${esc(q.question||'')}</textarea><div class="options"></div>`;const options=q.options||['','','',''];const opts=wrap.querySelector('.options');options.slice(0,4).forEach((o,i)=>{const d=document.createElement('div');d.className='option-row';d.innerHTML=`<input class="q-opt" placeholder="اختيار ${i+1}" value="${esc(o)}" required><label class="checkline"><input type="radio" name="correct-${Math.random()}" class="q-correct" ${Number(q.correct_index)===i?'checked':''}> صحيح</label>`;opts.appendChild(d);});$('questions').appendChild(wrap);}
$('addQuestion').onclick=()=>addQuestionUI();
$('quizForm').onsubmit=async e=>{e.preventDefault();const id=$('quizId').value;const payload={title:$('quizTitle').value.trim(),subject_id:$('quizSubject').value||null,description:$('quizDescription').value.trim(),active:true};let quizId=id;if(id){const r=await client.from('quizzes').update(payload).eq('id',id).select().single();if(r.error){alert(r.error.message);return;}}else{const r=await client.from('quizzes').insert(payload).select().single();if(r.error){alert(r.error.message);return;}quizId=r.data.id;}
 await client.from('quiz_questions').delete().eq('quiz_id',quizId);const rows=[...document.querySelectorAll('#questions .question')].map(q=>{const opts=[...q.querySelectorAll('.q-opt')].map(x=>x.value.trim());const correct=[...q.querySelectorAll('.q-correct')].findIndex(x=>x.checked);return {quiz_id:quizId,question:q.querySelector('.q-text').value.trim(),options:opts,correct_index:correct<0?0:correct};});if(rows.length){const r=await client.from('quiz_questions').insert(rows);if(r.error){alert(r.error.message);return;}}$('quizForm').reset();$('quizId').value='';$('questions').innerHTML='';loadAll();};
window.editQuiz=async id=>{const q=quizzes.find(x=>x.id===id);if(!q)return;const {data,error}=await client.from('quiz_questions').select('*').eq('quiz_id',id).order('created_at');if(error){alert(error.message);return;}$('quizId').value=id;$('quizTitle').value=q.title;$('quizSubject').value=q.subject_id||'';$('quizDescription').value=q.description||'';$('questions').innerHTML='';(data||[]).forEach(addQuestionUI);openTab('quizzes');scrollTo(0,0)};
window.deleteQuiz=async id=>{if(!confirm('حذف الاختبار وكل أسئلته؟'))return;const r=await client.from('quizzes').delete().eq('id',id);if(r.error)alert(r.error.message);else loadAll();};
$('cancelQuiz').onclick=()=>{$('quizForm').reset();$('quizId').value='';$('questions').innerHTML='';};
function renderQuizzes(){ $('quizzesList').innerHTML=quizzes.map(q=>`<div class="item"><div><strong>${esc(q.title)}</strong><div class="muted">${esc(q.subjects?.name||'اختبار عام')} • ${(q.quiz_questions||[]).length} أسئلة</div></div><div class="item-actions"><a class="btn small" href="quiz.html?id=${q.id}" target="_blank">فتح</a><button class="btn small" onclick="editQuiz('${q.id}')">تعديل</button><button class="danger" onclick="deleteQuiz('${q.id}')">حذف</button></div></div>`).join('')||'<div class="card">لا توجد اختبارات.</div>';}

function renderUsers(){const term=($('userSearch').value||'').toLowerCase();const rows=users.filter(u=>[u.full_name,u.email,u.phone,u.grade].join(' ').toLowerCase().includes(term));$('usersBody').innerHTML=rows.map(u=>`<tr data-id="${u.id}"><td>${esc(u.full_name||'—')}</td><td>${esc(u.email||'—')}</td><td>${esc(u.phone||'—')}</td><td>${esc(u.grade||'—')}</td><td><select class="role"><option value="student" ${u.role==='student'?'selected':''}>طالب</option><option value="admin" ${u.role==='admin'?'selected':''}>مدير</option></select></td><td><button class="btn small save-user">حفظ</button></td></tr>`).join('')||'<tr><td colspan="6">لا توجد نتائج.</td></tr>';document.querySelectorAll('.save-user').forEach(b=>b.onclick=async()=>{const row=b.closest('tr');const role=row.querySelector('.role').value;const r=await client.from('profiles').update({role}).eq('id',row.dataset.id);if(r.error)alert(r.error.message);else loadAll();});}
$('userSearch').oninput=renderUsers;

function settingsObj(rows){const o={};rows.forEach(x=>o[x.key]=x.value);return o;}
function renderSettings(rows){const s=settingsObj(rows);$('setSiteName').value=s.site_name||'ChemistryHub';$('setHeroTitle').value=s.hero_title||'كلية التربية قسم الكيمياء';$('setHeroDescription').value=s.hero_description||'';$('setNotice').value=s.notice||'';$('setFacebook').value=s.facebook||'#';$('setYoutube').value=s.youtube||'#';$('setWhatsapp').value=s.whatsapp||'#';}
$('settingsForm').onsubmit=async e=>{e.preventDefault();const values={site_name:$('setSiteName').value,hero_title:$('setHeroTitle').value,hero_description:$('setHeroDescription').value,notice:$('setNotice').value,facebook:$('setFacebook').value,youtube:$('setYoutube').value,whatsapp:$('setWhatsapp').value};for(const [key,value] of Object.entries(values)){const r=await client.from('site_settings').upsert({key,value,updated_at:new Date().toISOString()},{onConflict:'key'});if(r.error){alert(r.error.message);return;}}msg('تم حفظ إعدادات الموقع.');};
boot();
