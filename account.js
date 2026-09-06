const accountClient = window.supabaseClient || supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = (id) => document.getElementById(id);

function esc(v){
  return String(v ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[c]));
}

function gradeLabel(grade){
  const s=String(grade||'').trim();
  const m=s.match(/(?:Year\s*)?([1-4])/i);
  return m ? `الفرقة ${['الأولى','الثانية','الثالثة','الرابعة'][Number(m[1])-1]}` : (s || 'الفرقة —');
}

function showNotice(message, type='ok'){
  const box=$('pageNotice');
  box.textContent=message;
  box.className=`notice-box ${type}`;
  setTimeout(()=>{ if(box) box.className='notice-box'; },4500);
}

function renderAvatar(url, name){
  const box=$('avatarBox');
  if(!box) return;
  if(url){
    box.innerHTML=`<img src="${esc(url)}" alt="صورة الحساب" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
  }else{
    box.textContent=String(name||'ط').trim().slice(0,1)||'ط';
  }
}

async function loadAccount(){
  if(!(await protectPage())) return;

  const {data:{user},error:userError}=await accountClient.auth.getUser();
  if(userError || !user){
    window.location.href='login.html?next='+encodeURIComponent(location.href);
    return;
  }

  const {data:profile,error:profileError}=await accountClient
    .from('profiles')
    .select('id,email,full_name,phone,grade,avatar_url,role,approved')
    .eq('id',user.id)
    .maybeSingle();

  if(profileError){
    console.error(profileError);
    showNotice('تعذر تحميل بيانات الحساب: '+profileError.message,'err');
    return;
  }

  const p=profile||{};
  const name=p.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'الطالب';

  $('profileName').textContent=name;
  $('profileEmail').textContent=user.email||'';
  $('profileGrade').textContent=gradeLabel(p.grade);
  $('fullName').value=p.full_name||user.user_metadata?.full_name||'';
  $('phone').value=p.phone||'';
  $('grade').value=(String(p.grade||'').match(/(?:Year\s*)?([1-4])/i)?.[0]) ? `Year ${String(p.grade).match(/([1-4])/)[1]}` : 'Year 1';
  $('email').value=user.email||'';
  renderAvatar(p.avatar_url,name);

  $('logoutBtn').onclick=()=>logout();

  $('profileForm').onsubmit=async(e)=>{
    e.preventDefault();
    const btn=$('saveProfile');
    btn.disabled=true;
    const full_name=$('fullName').value.trim();
    const phone=$('phone').value.trim();
    const grade=$('grade').value;
    if(!full_name){
      showNotice('اكتب الاسم أولاً.','err');
      btn.disabled=false;
      return;
    }
    const r=await accountClient.from('profiles').update({full_name,phone,grade}).eq('id',user.id);
    if(r.error) showNotice('تعذر حفظ البيانات: '+r.error.message,'err');
    else{
      $('profileName').textContent=full_name;
      $('profileGrade').textContent=gradeLabel(grade);
      showNotice('تم حفظ بيانات الحساب بنجاح.');
    }
    btn.disabled=false;
  };

  $('avatarInput').onchange=async(e)=>{
    const file=e.target.files?.[0];
    if(!file) return;
    if(file.size>5*1024*1024){
      showNotice('الصورة يجب ألا تتجاوز 5 ميجابايت.','err');
      e.target.value='';
      return;
    }
    if(!/^image\/(png|jpeg|webp)$/.test(file.type)){
      showNotice('مسموح فقط PNG أو JPG أو WEBP.','err');
      e.target.value='';
      return;
    }

    const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
    const path=`${user.id}/avatar.${ext}`;
    const {error:uploadError}=await accountClient.storage
      .from('avatars')
      .upload(path,file,{upsert:true,contentType:file.type,cacheControl:'3600'});

    if(uploadError){
      console.error(uploadError);
      showNotice('تعذر رفع الصورة. تأكد أنك شغلت كود SQL الخاص بالصور.','err');
      e.target.value='';
      return;
    }

    const {data:publicData}=accountClient.storage.from('avatars').getPublicUrl(path);
    const avatar_url=publicData.publicUrl+`?v=${Date.now()}`;
    const {error:updateError}=await accountClient.from('profiles').update({avatar_url}).eq('id',user.id);

    if(updateError){
      showNotice('تم رفع الصورة لكن تعذر حفظها في الحساب: '+updateError.message,'err');
    }else{
      renderAvatar(avatar_url,$('profileName').textContent);
      showNotice('تم تحديث صورة الحساب.');
    }
    e.target.value='';
  };

  await loadResults(user.id);
}

async function loadResults(userId){
  const box=$('resultsBox');
  const r=await accountClient
    .from('ch_quiz_attempts')
    .select(`
      id,score,total_questions,answered_questions,created_at,
      ch_quizzes(title,ch_subjects(name))
    `)
    .eq('user_id',userId)
    .order('created_at',{ascending:false});

  if(r.error){
    console.error(r.error);
    box.innerHTML=`<div class="empty-results">تعذر تحميل النتائج: ${esc(r.error.message)}</div>`;
    return;
  }

  const rows=r.data||[];
  $('attemptCount').textContent=rows.length;

  const percentages=rows.map(x=>x.total_questions>0 ? (Number(x.score)/Number(x.total_questions))*100 : 0);
  const avg=percentages.length ? percentages.reduce((a,b)=>a+b,0)/percentages.length : 0;
  const best=percentages.length ? Math.max(...percentages) : 0;
  $('averageScore').textContent=Math.round(avg)+'%';
  $('bestScore').textContent=Math.round(best)+'%';

  if(!rows.length){
    box.innerHTML='<div class="empty-results">لم تحل أي اختبار حتى الآن. ابدأ من بنك الاختبارات 🚀</div>';
    return;
  }

  box.innerHTML=`
    <div style="overflow:auto">
      <table class="results-table">
        <thead>
          <tr>
            <th>الاختبار</th>
            <th>المادة</th>
            <th>النتيجة</th>
            <th>النسبة</th>
            <th>التاريخ</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(x=>{
            const total=Number(x.total_questions)||0;
            const score=Number(x.score)||0;
            const pct=total?Math.round((score/total)*100):0;
            const title=x.ch_quizzes?.title||'اختبار';
            const subject=x.ch_quizzes?.ch_subjects?.name||'—';
            const date=new Date(x.created_at).toLocaleString('ar-EG',{dateStyle:'medium',timeStyle:'short'});
            return `<tr>
              <td><b>${esc(title)}</b></td>
              <td>${esc(subject)}</td>
              <td class="score-good">${score} / ${total}</td>
              <td>${pct}%</td>
              <td>${esc(date)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

loadAccount();
