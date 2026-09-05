const client = window.supabaseClient || supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabaseClient = client;

let user = null;
let profile = null;
let grade = null;
let messages = [];
let selectedFile = null;
let channel = null;
let chatSettings = {locked:false, attachments_enabled:true, lock_message:'لا يمكن إرسال رسائل حاليًا.'};

const $ = id => document.getElementById(id);
const gradeNames = {"Year 1":"الفرقة الأولى","Year 2":"الفرقة الثانية","Year 3":"الفرقة الثالثة","Year 4":"الفرقة الرابعة"};
function esc(v){return String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function time(v){return new Date(v).toLocaleTimeString("ar-EG",{hour:"2-digit",minute:"2-digit"});}
async function getLoggedUser(){if(typeof getCurrentUser === "function") return await getCurrentUser(); const {data}=await client.auth.getUser(); return data?.user||null;}

async function boot(){
  user=await getLoggedUser();
  if(!user){location.href="login.html?next="+encodeURIComponent(location.href);return;}
  const {data,error}=await client.from("profiles").select("id,full_name,email,grade,role").eq("id",user.id).single();
  if(error) throw error;
  profile=data; grade=data.grade;
  if(!grade){$("messages").innerHTML='<div class="empty">⚠️ لا توجد فرقة محددة في حسابك. حدّد الفرقة أولًا من صفحة الحساب.</div>';return;}
  $("groupTitle").textContent=(gradeNames[grade]||grade);
  $("topName").textContent=profile.full_name||profile.email||"طالب";
  $("topRole").textContent=profile.role==="admin"?"👑 OWNER":"طالب";
  $("topYear").textContent=grade;
  $("topAvatar").textContent=(profile.full_name||"ط").trim().slice(0,1)||"ط";
  renderGroups();
  if(profile.role==="admin") $("ownerBadge")?.removeAttribute("hidden");
  if(profile.role==="admin") $("adminCard").hidden=false;
  await loadSettings();
  await loadMessages();
  startRealtime();
}

function renderGroups(){const arr=["Year 1","Year 2","Year 3","Year 4"];const box=$("groupList");if(!box)return;box.innerHTML=arr.map((g,i)=>`<div class="group-item ${g===grade?'active':''}" onclick="selectGroup('${g}')"><span class="group-num">${i+1}</span><div><b>${gradeNames[g]}</b><small>${g===grade?'متصل الآن':'جروب منفصل'}</small></div></div>`).join("");}
window.selectGroup=async g=>{
  if(g===grade)return;
  if(profile?.role!=="admin")return alert("هذا الجروب مخصص لطلاب "+(gradeNames[g]||g)+". حسابك تابع لـ "+(gradeNames[grade]||grade)+".");
  grade=g;
  if(channel){try{await client.removeChannel(channel);}catch(e){} channel=null;}
  $("groupTitle").textContent=gradeNames[grade]||grade;
  $("onlineCount").textContent="0 متصل الآن";
  $("topYear").textContent=grade;
  $("chat-panel")?.setAttribute("data-grade",grade);
  renderGroups();
  await loadSettings();
  await loadMessages();
  startRealtime();
};
async function renderMembers(){const box=$("membersList");if(!box)return;let arr=[];if(profile?.role==="admin"){const r=await client.from("profiles").select("id,full_name,email,grade,role").eq("grade",grade).order("full_name",{ascending:true});if(!r.error){arr=(r.data||[]).map(p=>({id:p.id,name:p.full_name||p.email||"طالب",role:p.role||"student"}));}}if(!arr.length){const map=new Map();messages.forEach(m=>{if(m.sender_id)map.set(m.sender_id,{id:m.sender_id,name:m.sender_name,role:m.sender_role||"student"});});map.set(user.id,{id:user.id,name:profile.full_name||profile.email||"طالب",role:profile.role||"student"});arr=[...map.values()];}const onlineIds=new Set();if(channel){Object.values(channel.presenceState()).flat().forEach(x=>{if(x.user_id)onlineIds.add(x.user_id);});}$("memberCount").textContent=`(${arr.length})`;box.innerHTML=arr.map(m=>`<div class="member"><span class="member-avatar">${esc((m.name||"ط").slice(0,1))}</span><div class="member-info"><b>${esc(m.name)}</b><small class="${onlineIds.has(m.id)?"":"off"}">${onlineIds.has(m.id)?"● متصل الآن":"عضو في الجروب"}</small></div>${m.role==="admin"?'<span class="owner-tag">OWNER</span><span class="crown">♛</span>':""}</div>`).join("")||'<div class="empty">لا يوجد أعضاء في هذه الفرقة بعد.</div>';}
function updateStatus(){const el=$("chatStatus");if(!el)return;el.className=chatSettings.locked?'status-closed':'status-open';el.innerHTML=chatSettings.locked?'<b>الشات مقفول</b><small>لا يمكن للأعضاء إرسال رسائل حاليًا</small>':'<b>الشات مفتوح</b><small>يمكن لجميع الأعضاء إرسال الرسائل</small>';}
window.pinLatest=async()=>{if(profile.role!=="admin")return;const last=messages[messages.length-1];if(!last)return alert("لا توجد رسائل لتثبيتها.");await pinMessage(last.id,true);};
window.sendAdminNotice=async()=>{if(profile.role!=="admin")return;const t=prompt("اكتب الرسالة الجماعية:");if(!t?.trim())return;const {error}=await client.from("ch_chat_messages").insert({sender_id:user.id,sender_name:profile.full_name||"الإدارة",grade,message:"📣 "+t.trim()});if(error)alert(error.message);};
window.showAdminStatus=()=>alert(`حالة الشات: ${chatSettings.locked?'مقفول':'مفتوح'}\nرفع الملفات: ${chatSettings.attachments_enabled?'مفعل':'متوقف'}\nالصلاحية: OWNER`);
async function loadSettings(){
  const {data,error}=await client.from("ch_chat_settings").select("id,locked,attachments_enabled,lock_message").eq("id",1).maybeSingle();
  if(!error && data) chatSettings=data;
  applySettings();
  renderAdminPanel();
}
function applySettings(){
  const locked=!!chatSettings.locked && profile?.role!=="admin";
  $("lockBanner").hidden=!chatSettings.locked;
  $("lockMessage").textContent=chatSettings.lock_message||"لا يمكن إرسال رسائل حاليًا.";
  $("messageInput").disabled=locked;
  $("sendButton").disabled=locked;
  const fileOff=!chatSettings.attachments_enabled && profile?.role!=="admin";
  $("fileInput").disabled=locked||fileOff;
  $("attachLabel").classList.toggle("disabled",locked||fileOff);
  updateStatus();
}
function renderAdminPanel(){
  const panel=$("adminPanel");
  if(profile?.role!=="admin"){panel.hidden=true;return;}
  panel.hidden=false;
  panel.innerHTML=`<span class="admin-label">👑 OWNER</span>
    <button type="button" onclick="toggleChat()">${chatSettings.locked?'🔓 فتح الشات':'🔒 قفل الشات'}</button>
    <button type="button" onclick="toggleAttachments()">${chatSettings.attachments_enabled?'📎 تعطيل الملفات':'📎 تفعيل الملفات'}</button>
    <button type="button" onclick="deleteGroupMessages()">🗑 مسح رسائل الجروب</button>`;
}

async function loadMessages(){
  const {data,error}=await client.from("ch_chat_messages").select("*").eq("grade",grade).order("created_at",{ascending:true}).limit(200);
  if(error) throw error; messages=data||[]; await render();
}
async function signedUrl(path){if(!path)return null;const {data,error}=await client.storage.from("chemistryhub-chat").createSignedUrl(path,3600);return error?null:data?.signedUrl;}

async function render(){
  const box=$("messages"), q=$("searchInput").value.trim().toLowerCase();
  const list=messages.filter(m=>!q||String(m.message||"").toLowerCase().includes(q)||String(m.sender_name||"").toLowerCase().includes(q));
  await renderMembers();
  if(!list.length){box.innerHTML='<div class="empty">💬<br>لا توجد رسائل بعد.<br><small>ابدأ أول محادثة مع زملائك.</small></div>';renderPinned();return;}
  box.innerHTML="";
  for(const m of list){
    const mine=m.sender_id===user.id, row=document.createElement("div"); row.className="message"+(mine?" mine":"");
    const avatar=document.createElement("div"); avatar.className="msg-avatar"; avatar.textContent=String(m.sender_name||"ط").trim().slice(0,1);
    const content=document.createElement("div"); content.className="msg-content";
    let attachment="";
    if(m.attachment_path){const url=await signedUrl(m.attachment_path);if(url){attachment=String(m.attachment_type||"").startsWith("image/")?`<div class="attachment"><a href="${url}" target="_blank" rel="noopener"><img src="${url}" alt="${esc(m.attachment_name)}"></a></div>`:`<div class="attachment"><a class="file-link" href="${url}" target="_blank" rel="noopener">📄 ${esc(m.attachment_name||"ملف")}</a></div>`;}}
    const admin=profile.role==="admin";
    const actions=(mine||admin)?`<div class="actions">${(mine||admin)?`<button type="button" onclick="deleteMessage('${m.id}')">🗑 حذف</button>`:""}${admin?`<button type="button" onclick="pinMessage('${m.id}',${!m.pinned})">${m.pinned?'إلغاء التثبيت':'📌 تثبيت'}</button>`:""}</div>`:"";
    const ownerMark=(m.sender_role==='admin')?' <span class="owner-mini">OWNER</span>':'';
    content.innerHTML=`<div class="msg-name">${esc(m.sender_name)}${ownerMark}${m.pinned?' 📌':''}</div>${m.message?`<div class="bubble">${esc(m.message)}</div>`:""}${attachment}<div class="msg-meta">${time(m.created_at)}</div>${actions}`;
    row.append(avatar,content);box.appendChild(row);
  }
  box.scrollTop=box.scrollHeight;renderPinned();
}
function renderPinned(){const pinned=messages.find(m=>m.pinned);if(!pinned){$("pinned").hidden=true;return;}$("pinnedText").textContent=pinned.message||"📎 ملف مرفق";$("pinned").hidden=false;}

window.deleteMessage=async id=>{if(!confirm("هل تريد حذف الرسالة؟"))return;const {error}=await client.from("ch_chat_messages").delete().eq("id",id);if(error)alert(error.message);};
window.pinMessage=async(id,pin)=>{if(profile.role!=="admin")return;if(pin){const {error}=await client.from("ch_chat_messages").update({pinned:false}).eq("grade",grade).eq("pinned",true);if(error){alert(error.message);return;}}const {error}=await client.from("ch_chat_messages").update({pinned:pin}).eq("id",id);if(error)alert(error.message);};
window.toggleChat=async()=>{if(profile.role!=="admin")return;const next=!chatSettings.locked;const {data,error}=await client.from("ch_chat_settings").update({locked:next,updated_by:user.id,updated_at:new Date().toISOString()}).eq("id",1).select().single();if(error)return alert(error.message);chatSettings=data;applySettings();renderAdminPanel();};
window.toggleAttachments=async()=>{if(profile.role!=="admin")return;const next=!chatSettings.attachments_enabled;const {data,error}=await client.from("ch_chat_settings").update({attachments_enabled:next,updated_by:user.id,updated_at:new Date().toISOString()}).eq("id",1).select().single();if(error)return alert(error.message);chatSettings=data;applySettings();renderAdminPanel();};
window.deleteGroupMessages=async()=>{if(profile.role!=="admin")return;if(!confirm("حذف كل رسائل جروب هذه الفرقة؟ لا يمكن التراجع."))return;const {error}=await client.from("ch_chat_messages").delete().eq("grade",grade);if(error)alert(error.message);};

async function uploadFile(){
  if(!selectedFile)return null;
  if(!chatSettings.attachments_enabled && profile.role!=="admin")throw new Error("رفع الملفات متوقف حاليًا من الإدارة.");
  const safe=selectedFile.name.replace(/[^\w\u0600-\u06FF.\- ]/g,"_").slice(0,100),path=`${grade}/${user.id}/${Date.now()}-${safe}`;
  const {data,error}=await client.storage.from("chemistryhub-chat").upload(path,selectedFile,{upsert:false,contentType:selectedFile.type});
  if(error)throw error;return data.path;
}
function clearFile(){selectedFile=null;$("fileInput").value="";$("filePreview").hidden=true;$("fileName").textContent="";}
$("fileInput").addEventListener("change",e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>10*1024*1024){alert("الحد الأقصى للمرفق 10MB.");e.target.value="";return;}selectedFile=file;$("fileName").textContent=file.name;$("filePreview").hidden=false;});
$("clearFile").addEventListener("click",clearFile);
$("composer").addEventListener("submit",async e=>{
  e.preventDefault();if(chatSettings.locked&&profile.role!=="admin")return alert(chatSettings.lock_message||"الشات مقفول حاليًا.");
  const text=$("messageInput").value.trim();if(!text&&!selectedFile)return;$("sendButton").disabled=true;
  try{let path=null;if(selectedFile)path=await uploadFile();const {error}=await client.from("ch_chat_messages").insert({sender_id:user.id,sender_name:profile.full_name||"طالب",grade,message:text,attachment_path:path,attachment_name:selectedFile?.name||null,attachment_type:selectedFile?.type||null});if(error)throw error;$("messageInput").value="";clearFile();}
  catch(err){console.error(err);alert("تعذر إرسال الرسالة: "+err.message);}finally{applySettings();}
});
$("searchInput").addEventListener("input",render);
$("messageInput").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("composer").requestSubmit();}});

function startRealtime(){
  channel=client.channel("chemhub-chat-"+grade);
  channel.on("postgres_changes",{event:"INSERT",schema:"public",table:"ch_chat_messages",filter:"grade=eq."+grade},payload=>{if(!messages.some(m=>m.id===payload.new.id)){messages.push(payload.new);render();}})
  .on("postgres_changes",{event:"UPDATE",schema:"public",table:"ch_chat_messages",filter:"grade=eq."+grade},payload=>{const i=messages.findIndex(m=>m.id===payload.new.id);if(i>=0){messages[i]=payload.new;render();}})
  .on("postgres_changes",{event:"DELETE",schema:"public",table:"ch_chat_messages"},payload=>{messages=messages.filter(m=>m.id!==payload.old.id);render();})
  .on("postgres_changes",{event:"UPDATE",schema:"public",table:"ch_chat_settings",filter:"id=eq.1"},payload=>{chatSettings=payload.new;applySettings();renderAdminPanel();})
  .on("presence",{event:"sync"},updatePresence)
  .subscribe(async status=>{if(status==="SUBSCRIBED")await channel.track({user_id:user.id,grade});});
}
function updatePresence(){if(!channel)return;const state=channel.presenceState(),ids=new Set();Object.values(state).flat().forEach(x=>{if(x.user_id)ids.add(x.user_id);});$("onlineCount").textContent="● "+ids.size+" متصل";}
boot().catch(err=>{$("messages").innerHTML=`<div class="empty">❌ حدث خطأ في تشغيل الشات.<br><small>${esc(err.message)}</small></div>`;});
