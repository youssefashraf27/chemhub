(function(){
  const client = window.supabaseClient || supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.supabaseClient = client;
  const $ = id => document.getElementById(id);
  const esc = x => String(x ?? '').replace(/[&<>"']/g, z => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[z]));

  async function currentStudent(){
    const user = await getCurrentUser();
    if(!user) return null;
    if(!user.profile){
      const {data} = await client.from('profiles').select('role,full_name,email,phone,grade').eq('id',user.id).maybeSingle();
      if(data) user.profile=data;
    }
    return user;
  }

  function yearNumber(grade){
    const m=String(grade||'').match(/(?:Year|الفرقة)\s*([1-4])/i);
    return m ? Number(m[1]) : null;
  }

  async function bootQuizBank(){
    if(!(await protectPage())) return;
    await setupAuthUI();
    const user=await currentStudent();
    if(!user) return;
    const grade=user.profile?.grade || user.user_metadata?.grade || '';
    const year=yearNumber(grade);
    $('gradeBox').innerHTML = year
      ? `🎓 <strong>الفرقة ${year}</strong><br><small>تظهر لك اختبارات مواد فرقتك فقط.</small>`
      : `⚠️ لم يتم تحديد الفرقة في حسابك. عدّل بيانات حسابك من لوحة الإدارة.`;

    if(!year){ $('list').innerHTML='<div class="card empty">لا يمكن عرض الاختبارات قبل تحديد الفرقة.</div>'; return; }

    const r=await client.from('ch_quizzes').select('id,title,description,subject_id,ch_subjects(name,ch_years(year_number,title)),ch_quiz_questions(id)').eq('active',true).order('created_at',{ascending:false});
    if(r.error){ console.error(r.error); $('list').innerHTML='<div class="card empty">تعذر تحميل الاختبارات.</div>'; return; }
    const rows=(r.data||[]).filter(q=>Number(q.ch_subjects?.ch_years?.year_number)===year);
    $('list').innerHTML=rows.map(q=>`<article class="quiz-card card"><span class="subject-badge">${esc(q.ch_subjects?.name||'مادة')}</span><h3>${esc(q.title)}</h3><p>${esc(q.description||'اختبار للمراجعة والتدريب')}</p><small>${(q.ch_quiz_questions||[]).length} أسئلة</small><a class="btn small" href="quiz.html?id=${encodeURIComponent(q.id)}">ابدأ الاختبار ←</a></article>`).join('') || '<div class="card empty">لا توجد اختبارات متاحة لمواد فرقتك حالياً.</div>';
  }

  async function bootSingleQuiz(){
    if(!(await protectPage())) return;
    await setupAuthUI();
    const user=await currentStudent();
    if(!user) return;
    const year=yearNumber(user.profile?.grade || user.user_metadata?.grade);
    const id=new URLSearchParams(location.search).get('id');
    if(!id || !year){ $('quiz').innerHTML='<div class="card"><h2>لا يمكن فتح الاختبار.</h2><p>تأكد من تسجيل الدخول وتحديد الفرقة.</p></div>'; return; }

    const q=await client.from('ch_quizzes').select('id,title,description,active,subject_id,ch_subjects(name,ch_years(year_number,title))').eq('id',id).eq('active',true).maybeSingle();
    if(q.error || !q.data || Number(q.data.ch_subjects?.ch_years?.year_number)!==year){ $('quiz').innerHTML='<div class="card"><h2>الاختبار غير متاح.</h2><p>هذا الاختبار ليس ضمن مواد فرقتك الدراسية.</p><a class="btn small" href="quizzes.html">العودة لبنك الاختبارات</a></div>'; return; }

    const qs=await client.from('ch_quiz_questions').select('*').eq('quiz_id',id).order('created_at');
    if(qs.error){ $('quiz').innerHTML='<div class="card">تعذر تحميل أسئلة الاختبار.</div>'; return; }
    document.title=q.data.title+' | ChemistryHub';
    $('quiz').innerHTML=`<div class="section-head"><span class="eyebrow">${esc(q.data.ch_subjects?.name||'اختبار')}</span><h1>${esc(q.data.title)}</h1><p>${esc(q.data.description||'اختبار للمراجعة والتدريب')}</p></div><form id="quizForm">${(qs.data||[]).map((x,i)=>`<div class="q-card card"><h3>${i+1}. ${esc(x.question)}</h3>${(Array.isArray(x.options)?x.options:[]).map((o,j)=>`<label class="q-option"><input type="radio" name="q${i}" value="${j}"> ${esc(o)}</label>`).join('')}</div>`).join('')}<button class="btn primary">تصحيح الاختبار</button></form><div id="result"></div>`;
    $('quizForm').onsubmit=e=>{e.preventDefault();let score=0,answered=0;(qs.data||[]).forEach((x,i)=>{const a=document.querySelector('input[name="q'+i+'"]:checked');if(a){answered++;if(Number(a.value)===Number(x.correct_index))score++;}});const total=(qs.data||[]).length;$('result').innerHTML=`<div class="result">النتيجة: <b>${score}</b> / ${total} — تمت الإجابة عن ${answered} من ${total}</div>`;window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'});};
  }
  window.bootQuizBank=bootQuizBank;
  window.bootSingleQuiz=bootSingleQuiz;
})();
