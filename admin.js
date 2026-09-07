const SUPABASE_URL="https://gypdbqfqbfqedqekftuh.supabase.co";
const SUPABASE_KEY="sb_publishable_CMhxbEfoCraLLypVIkqvOA_C_jj0w1q";
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);
let currentAdmin=null, users=[], subjects=[], quizzes=[], questions=[], results=[], news=[], notes=[];
const views={dashboard:"لوحة التحكم",users:"المستخدمون",subjects:"المواد الدراسية",quizzes:"الاختبارات",questions:"بنك الأسئلة",results:"النتائج",news:"الأخبار",notes:"ملاحظات الطلاب"};

function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function toast(msg){$("toast").textContent=msg;$("toast").classList.add("show");clearTimeout(window.__toast);window.__toast=setTimeout(()=>$("toast").classList.remove("show"),2600)}
function errorMsg(e){toast("حدث خطأ: "+(e?.message||"تعذر تنفيذ العملية"));console.error(e)}
function fmtDate(v){return v?new Date(v).toLocaleString("ar-EG",{dateStyle:"medium",timeStyle:"short"}):"—"}

async function init(){
  const {data:{session}}=await sb.auth.getSession();
  if(!session){location.href="auth.html";return}
  const {data:profile,error}=await sb.from("profiles").select("role,full_name,email").eq("id",session.user.id).maybeSingle();
  if(error||!profile||profile.role!=="admin"){alert("ليس لديك صلاحية الدخول إلى لوحة الإدارة.");location.href="index.html";return}
  currentAdmin=session.user;
  $("adminEmail").textContent=profile.full_name?`${profile.full_name} — ${session.user.email}`:session.user.email;
  $("loading").classList.add("hidden");$("app").classList.remove("hidden");
  bindNav();bindFilters();await loadAll();
}
async function loadAll(){
  await Promise.all([loadUsers(),loadSubjects(),loadQuizzes(),loadResults(),loadNews(),loadNotes()]);
  updateStats();fillQuizSelect();if($("questionQuizSelect").value)await loadQuestions($("questionQuizSelect").value);
}
function updateStats(){ $("statUsers").textContent=users.length;$("statSubjects").textContent=subjects.length;$("statQuizzes").textContent=quizzes.length;$("statResults").textContent=results.length}
function bindNav(){
  document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
  $("mobileNav").onclick=()=>document.querySelector(".sidebar").classList.toggle("open");
  $("logoutBtn").onclick=async()=>{await sb.auth.signOut();location.href="auth.html"};
  $("closeModal").onclick=closeModal;
  $("modal").addEventListener("click",e=>{if(e.target.id==="modal")closeModal()});
  $("newSubject").onclick=()=>subjectForm();
  $("newQuiz").onclick=()=>quizForm();
  $("newQuestion").onclick=()=>{const q=$("questionQuizSelect").value;if(q)questionForm(q);else toast("اختر اختبارًا أولاً")};
  $("newNews").onclick=()=>newsForm();
  $("questionQuizSelect").onchange=()=>loadQuestions($("questionQuizSelect").value);
  $("userSearch").oninput=renderUsers;$("resultSearch").oninput=renderResults;
}
function showView(name){
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  $("view-"+name).classList.add("active");
  document.querySelectorAll(".nav-btn").forEach(v=>v.classList.toggle("active",v.dataset.view===name));
  $("viewTitle").textContent=views[name]||"لوحة التحكم";
  $("sidebar").classList.remove("open");
  if(name==="questions")fillQuizSelect();
}
function bindFilters(){["subjectYear","subjectDept","subjectTerm"].forEach(id=>$(id).oninput=renderSubjects)}
async function loadUsers(){
  const {data,error}=await sb.rpc("admin_list_users");if(error){errorMsg(error);return}users=data||[];renderUsers()
}
function renderUsers(){
  const q=($("userSearch").value||"").toLowerCase();
  const list=users.filter(u=>[u.full_name,u.email,u.phone,u.student_code,u.department].some(x=>String(x||"").toLowerCase().includes(q)));
  $("usersTable").innerHTML=list.length?list.map(u=>`<tr>
<td><b>${esc(u.full_name||"بدون اسم")}</b></td><td dir="ltr">${esc(u.email||"—")}</td><td>${esc(u.department||"—")}</td><td dir="ltr">${esc(u.phone||"—")}</td><td>${esc(u.student_code||"—")}</td>
<td><span class="badge ${u.role==="admin"?"admin":"student"}">${u.role==="admin"?"Admin":"طالب"}</span></td><td>${fmtDate(u.last_sign_in_at)}</td>
<td><div class="actions"><button class="icon-btn" onclick="userForm('${u.id}')"><i class="fa fa-pen"></i></button><button class="icon-btn" onclick="resetUser('${esc(u.email||"")}')"><i class="fa fa-key"></i></button><button class="icon-btn danger" onclick="deleteUser('${u.id}')"><i class="fa fa-trash"></i></button></div></td></tr>`).join(""):`<tr><td colspan="8" class="empty">لا يوجد مستخدمون.</td></tr>`
}
async function userForm(id){
  const u=users.find(x=>x.id===id);if(!u)return;
  openModal("تعديل بيانات المستخدم",`<div class="form-grid">
<div class="form-field"><label>الاسم الرباعي</label><input name="full_name" value="${esc(u.full_name)}"></div>
<div class="form-field"><label>الفرقة</label><select name="department"><option value="">—</option>${["الأولى","الثانية","الثالثة","الرابعة"].map(x=>`<option ${u.department===x?"selected":""}>${x}</option>`).join("")}</select></div>
<div class="form-field"><label>رقم الهاتف</label><input name="phone" value="${esc(u.phone)}"></div>
<div class="form-field"><label>الكود الجامعي</label><input name="student_code" value="${esc(u.student_code)}"></div>
<div class="form-field"><label>الصلاحية</label><select name="role"><option value="student" ${u.role!=="admin"?"selected":""}>طالب</option><option value="admin" ${u.role==="admin"?"selected":""}>Admin</option></select></div>
<div class="form-field"><label>البريد (للعرض فقط)</label><input disabled value="${esc(u.email)}"></div></div><div class="form-actions"><button class="primary" type="submit">حفظ</button><button class="secondary" type="button" onclick="closeModal()">إلغاء</button></div>`,
async form=>{const payload={full_name:form.full_name.value,department:form.department.value,phone:form.phone.value,student_code:form.student_code.value,role:form.role.value};const {error}=await sb.from("profiles").update(payload).eq("id",id);if(error)throw error;closeModal();await loadUsers();toast("تم تحديث المستخدم")})
}
async function resetUser(email){if(!email)return;const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname.replace(/admin\.html.*$/,"auth.html")});if(error)errorMsg(error);else toast("تم إرسال رابط إعادة تعيين كلمة السر")}
async function deleteUser(id){if(!confirm("حذف الحساب نهائيًا؟ لا يمكن التراجع عن هذا الإجراء."))return;const {error}=await sb.rpc("admin_delete_user",{p_user_id:id});if(error)errorMsg(error);else{await loadUsers();updateStats();toast("تم حذف الحساب")}}

async function loadSubjects(){
  const {data,error}=await sb.from("subjects").select("*").order("created_at",{ascending:false});if(error){errorMsg(error);return}subjects=data||[];renderSubjects()
}
function renderSubjects(){
 const y=$("subjectYear").value,d=$("subjectDept").value.toLowerCase(),t=$("subjectTerm").value;
 const list=subjects.filter(s=>(!y||String(s.year_level??"")===y)&&(!d||String(s.department||"").toLowerCase().includes(d))&&(!t||s.term===t));
 $("subjectsTable").innerHTML=list.length?list.map(s=>`<tr><td><b>${esc(s.name)}</b></td><td>${esc(s.year_level||"—")}</td><td>${esc(s.department||"عام")}</td><td>${esc(s.term||"—")}</td><td>${esc(s.teacher||"—")}</td><td>${esc(s.code||"—")}</td><td>${esc(s.type||"mandatory")}</td><td><div class="actions"><button class="icon-btn" onclick="subjectForm('${s.id}')"><i class="fa fa-pen"></i></button><button class="icon-btn danger" onclick="deleteRow('subjects','${s.id}',loadSubjects)"><i class="fa fa-trash"></i></button></div></td></tr>`).join(""):`<tr><td colspan="8" class="empty">لا توجد مواد مطابقة.</td></tr>`
}
function subjectForm(id){
 const s=subjects.find(x=>String(x.id)===String(id))||{};
 openModal(id?"تعديل مادة":"إضافة مادة",`<div class="form-grid">
<div class="form-field"><label>اسم المادة *</label><input name="name" required value="${esc(s.name)}"></div>
<div class="form-field"><label>الفرقة *</label><select name="year_level" required><option value="">اختر</option>${[1,2,3,4].map(x=>`<option value="${x}" ${String(s.year_level)===String(x)?"selected":""}>الفرقة ${["الأولى","الثانية","الثالثة","الرابعة"][x-1]}</option>`).join("")}</select></div>
<div class="form-field"><label>القسم / البرنامج</label><input name="department" value="${esc(s.department)}" placeholder="مثال: كيمياء منفرد"></div>
<div class="form-field"><label>الترم *</label><select name="term" required>${["الفصل الدراسي الأول","الفصل الدراسي الثاني","متطلبات الجامعة"].map(x=>`<option ${s.term===x?"selected":""}>${x}</option>`).join("")}</select></div>
<div class="form-field"><label>الدكتور</label><input name="teacher" value="${esc(s.teacher||"الدكتور")}"></div>
<div class="form-field"><label>كود المادة</label><input name="code" value="${esc(s.code)}"></div>
<div class="form-field"><label>النوع</label><select name="type"><option value="mandatory" ${s.type!=="optional"?"selected":""}>إجباري</option><option value="optional" ${s.type==="optional"?"selected":""}>اختياري</option></select></div>
<div class="form-field"><label>أيقونة Font Awesome</label><input name="icon" value="${esc(s.icon||"fa-book")}"></div>
<div class="form-field full"><label>رابط المحتوى / Google Drive</label><input name="link" value="${esc(s.link)}"></div></div>
<div class="form-actions"><button class="primary" type="submit">حفظ المادة</button><button class="secondary" type="button" onclick="closeModal()">إلغاء</button></div>`,
async f=>{const payload={name:f.name.value.trim(),year_level:f.year_level.value,department:f.department.value.trim(),term:f.term.value,teacher:f.teacher.value.trim()||"الدكتور",code:f.code.value.trim(),type:f.type.value,icon:f.icon.value.trim()||"fa-book",link:f.link.value.trim()};if(!payload.name)throw Error("اسم المادة مطلوب");let q=id?sb.from("subjects").update(payload).eq("id",id):sb.from("subjects").insert(payload);const {error}=await q;if(error)throw error;closeModal();await loadSubjects();updateStats();toast("تم حفظ المادة")})
}

async function loadQuizzes(){
 const {data,error}=await sb.from("quizzes").select("*").order("created_at",{ascending:false});if(error){errorMsg(error);return}quizzes=data||[];renderQuizzes()
}
function renderQuizzes(){
 $("quizzesTable").innerHTML=quizzes.length?quizzes.map(q=>`<tr><td><b>${esc(q.title)}</b><small>${esc(q.subject_code||"")}</small></td><td>${esc(q.year_level||"كل الفرق")}</td><td>${esc(q.department||"كل الأقسام")}</td><td>${esc(q.time_limit||0)} دقيقة</td><td>${q.video_url?'<i class="fa fa-circle-play"></i> نعم':'—'}</td><td><span class="badge ${q.is_active?"on":"off"}">${q.is_active?"منشور":"مخفي"}</span></td><td><div class="actions"><button class="icon-btn" onclick="quizForm('${q.id}')"><i class="fa fa-pen"></i></button><button class="icon-btn" onclick="toggleQuiz('${q.id}',${!q.is_active})"><i class="fa fa-power-off"></i></button><button class="icon-btn danger" onclick="deleteRow('quizzes','${q.id}',loadQuizzes)"><i class="fa fa-trash"></i></button></div></td></tr>`).join(""):`<tr><td colspan="7" class="empty">لا توجد اختبارات.</td></tr>`
}
function quizForm(id){
 const q=quizzes.find(x=>String(x.id)===String(id))||{};
 openModal(id?"تعديل اختبار":"إنشاء اختبار",`<div class="form-grid">
<div class="form-field full"><label>عنوان الاختبار *</label><input name="title" required value="${esc(q.title)}"></div>
<div class="form-field"><label>الفرقة المستهدفة</label><select name="year_level"><option value="">كل الفرق</option>${[1,2,3,4].map(x=>`<option value="${x}" ${String(q.year_level)===String(x)?"selected":""}>الفرقة ${["الأولى","الثانية","الثالثة","الرابعة"][x-1]}</option>`).join("")}</select></div>
<div class="form-field"><label>القسم المستهدف</label><input name="department" value="${esc(q.department)}" placeholder="اتركه فارغًا للكل"></div>
<div class="form-field"><label>الزمن بالدقائق *</label><input name="time_limit" type="number" min="1" required value="${esc(q.time_limit||20)}"></div>
<div class="form-field"><label>كود المادة</label><input name="subject_code" value="${esc(q.subject_code)}"></div>
<div class="form-field full"><label>رابط فيديو YouTube</label><input name="video_url" value="${esc(q.video_url)}"></div>
<div class="form-field"><label>الحالة</label><select name="is_active"><option value="true" ${q.is_active!==false?"selected":""}>منشور</option><option value="false" ${q.is_active===false?"selected":""}>مخفي</option></select></div></div>
<div class="form-actions"><button class="primary" type="submit">حفظ الاختبار</button><button class="secondary" type="button" onclick="closeModal()">إلغاء</button></div>`,
async f=>{const payload={title:f.title.value.trim(),year_level:f.year_level.value||null,department:f.department.value.trim()||null,time_limit:Number(f.time_limit.value),subject_code:f.subject_code.value.trim()||null,video_url:f.video_url.value.trim()||null,is_active:f.is_active.value==="true"};const {error}=id?await sb.from("quizzes").update(payload).eq("id",id):await sb.from("quizzes").insert(payload);if(error)throw error;closeModal();await loadQuizzes();updateStats();fillQuizSelect();toast("تم حفظ الاختبار")})
}
async function toggleQuiz(id,state){const {error}=await sb.from("quizzes").update({is_active:state}).eq("id",id);if(error)errorMsg(error);else{await loadQuizzes();toast(state?"تم نشر الاختبار":"تم إخفاء الاختبار")}}
function fillQuizSelect(){const el=$("questionQuizSelect"),old=el.value;el.innerHTML='<option value="">اختر الاختبار</option>'+quizzes.map(q=>`<option value="${q.id}">${esc(q.title)}</option>`).join("");if(old&&quizzes.some(q=>String(q.id)===old))el.value=old}

async function loadQuestions(quizId){
 if(!quizId){$("questionsTable").innerHTML='<tr><td colspan="5" class="empty">اختر اختبارًا أولاً.</td></tr>';return}
 const {data,error}=await sb.from("questions").select("*").eq("quiz_id",quizId).order("id");if(error){errorMsg(error);return}questions=data||[];renderQuestions()
}
function renderQuestions(){
 $("questionsTable").innerHTML=questions.length?questions.map((q,i)=>`<tr><td>${i+1}</td><td><b>${esc(q.question_text||"سؤال")}</b><small>${q.explanation?esc(q.explanation):""}</small></td><td>${q.question_type==="mcq"?"اختياري":"مقالي"}</td><td>${q.question_type==="mcq"?esc(q["option_"+q.correct_option]||"—"):"—"}</td><td><div class="actions"><button class="icon-btn" onclick="questionForm('${q.quiz_id}','${q.id}')"><i class="fa fa-pen"></i></button><button class="icon-btn danger" onclick="deleteRow('questions','${q.id}',()=>loadQuestions('${q.quiz_id}'))"><i class="fa fa-trash"></i></button></div></td></tr>`).join(""):`<tr><td colspan="5" class="empty">لا توجد أسئلة في هذا الاختبار.</td></tr>`
}
function questionForm(quizId,id){
 const q=questions.find(x=>String(x.id)===String(id))||{};
 openModal(id?"تعديل السؤال":"إضافة سؤال",`<div class="form-grid">
<div class="form-field full"><label>نص السؤال *</label><textarea name="question_text" required>${esc(q.question_text)}</textarea></div>
<div class="form-field"><label>نوع السؤال</label><select name="question_type" id="qtype"><option value="mcq" ${q.question_type!=="essay"?"selected":""}>اختياري</option><option value="essay" ${q.question_type==="essay"?"selected":""}>مقالي</option></select></div>
<div class="form-field"><label>الإجابة الصحيحة</label><select name="correct_option"><option value="1" ${q.correct_option==1?"selected":""}>الاختيار 1</option><option value="2" ${q.correct_option==2?"selected":""}>الاختيار 2</option><option value="3" ${q.correct_option==3?"selected":""}>الاختيار 3</option><option value="4" ${q.correct_option==4?"selected":""}>الاختيار 4</option></select></div>
<div class="form-field"><label>الاختيار 1</label><input name="option_1" value="${esc(q.option_1)}"></div>
<div class="form-field"><label>الاختيار 2</label><input name="option_2" value="${esc(q.option_2)}"></div>
<div class="form-field"><label>الاختيار 3</label><input name="option_3" value="${esc(q.option_3)}"></div>
<div class="form-field"><label>الاختيار 4</label><input name="option_4" value="${esc(q.option_4)}"></div>
<div class="form-field full"><label>شرح / إجابة نموذجية</label><textarea name="explanation">${esc(q.explanation)}</textarea></div>
<div class="form-field full"><label>رابط صورة السؤال</label><input name="image_url" value="${esc(q.image_url)}"></div></div>
<div class="form-actions"><button class="primary" type="submit">حفظ السؤال</button><button class="secondary" type="button" onclick="closeModal()">إلغاء</button></div>`,
async f=>{const payload={quiz_id:quizId,question_text:f.question_text.value.trim(),question_type:f.question_type.value,correct_option:f.correct_option.value?Number(f.correct_option.value):1,option_1:f.option_1.value,option_2:f.option_2.value,option_3:f.option_3.value,option_4:f.option_4.value,explanation:f.explanation.value,image_url:f.image_url.value.trim()||null};const {error}=id?await sb.from("questions").update(payload).eq("id",id):await sb.from("questions").insert(payload);if(error)throw error;closeModal();await loadQuestions(quizId);toast("تم حفظ السؤال")})
}

async function loadResults(){const {data,error}=await sb.from("quiz_results").select("*").order("created_at",{ascending:false});if(error){errorMsg(error);return}results=data||[];renderResults()}
function renderResults(){
 const q=($("resultSearch").value||"").toLowerCase();const list=results.filter(r=>[r.student_name,r.quiz_title].some(x=>String(x||"").toLowerCase().includes(q)));
 $("resultsTable").innerHTML=list.length?list.map(r=>{const p=r.total_score?Math.round(r.score/r.total_score*100):0;return `<tr><td><b>${esc(r.student_name||"—")}</b></td><td>${esc(r.quiz_title||"—")}</td><td>${esc(r.score)} / ${esc(r.total_score)}</td><td><span class="badge ${p>=50?"on":"off"}">${p}%</span></td><td>${fmtDate(r.created_at)}</td><td><button class="icon-btn danger" onclick="deleteRow('quiz_results','${r.id}',loadResults)"><i class="fa fa-trash"></i></button></td></tr>`}).join(""):`<tr><td colspan="6" class="empty">لا توجد نتائج.</td></tr>`
}

async function loadNews(){const {data,error}=await sb.from("news").select("*").order("created_at",{ascending:false});if(error){errorMsg(error);return}news=data||[];renderNews()}
function renderNews(){$("newsList").innerHTML=news.length?news.map(n=>`<div class="news-card"><p>${esc(n.content)}</p><div class="actions"><button class="icon-btn" onclick="newsForm('${n.id}')"><i class="fa fa-pen"></i></button><button class="icon-btn danger" onclick="deleteRow('news','${n.id}',loadNews)"><i class="fa fa-trash"></i></button></div></div>`).join(""):`<div class="empty">لا توجد أخبار.</div>`}
function newsForm(id){const n=news.find(x=>String(x.id)===String(id))||{};openModal(id?"تعديل خبر":"إضافة خبر",`<div class="form-field"><label>نص الخبر *</label><textarea name="content" required>${esc(n.content)}</textarea></div><div class="form-actions"><button class="primary" type="submit">حفظ</button><button class="secondary" type="button" onclick="closeModal()">إلغاء</button></div>`,async f=>{const {error}=id?await sb.from("news").update({content:f.content.value.trim()}).eq("id",id):await sb.from("news").insert({content:f.content.value.trim()});if(error)throw error;closeModal();await loadNews();toast("تم حفظ الخبر")})}

async function loadNotes(){const {data,error}=await sb.from("notes").select("*").order("created_at",{ascending:false});if(error){errorMsg(error);return}notes=(data||[]).map(n=>({...n,profiles:users.find(u=>u.id===n.user_id)||null}));renderNotes()}
function renderNotes(){$("notesTable").innerHTML=notes.length?notes.map(n=>`<tr><td>${esc(n.profiles?.full_name||n.user_id)}</td><td>${esc(n.content)}</td><td>${fmtDate(n.created_at)}</td><td><button class="icon-btn danger" onclick="deleteRow('notes','${n.id}',loadNotes)"><i class="fa fa-trash"></i></button></td></tr>`).join(""):`<tr><td colspan="4" class="empty">لا توجد ملاحظات.</td></tr>`}

async function deleteRow(table,id,reload){if(!confirm("هل أنت متأكد من الحذف؟"))return;const {error}=await sb.from(table).delete().eq("id",id);if(error)errorMsg(error);else{await reload();updateStats();toast("تم الحذف")}}
function openModal(title,html,onSubmit){$("modalTitle").textContent=title;$("modalForm").innerHTML=html;$("modal").classList.remove("hidden");$("modalForm").onsubmit=async e=>{e.preventDefault();const btn=e.submitter;if(btn)btn.disabled=true;try{await onSubmit(e.target)}catch(err){errorMsg(err)}finally{if(btn)btn.disabled=false}}
}
function closeModal(){$("modal").classList.add("hidden");$("modalForm").innerHTML=""}
window.addEventListener("DOMContentLoaded",init);
