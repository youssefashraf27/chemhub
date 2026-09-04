const client = window.supabaseClient || supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabaseClient = client;

let user = null;
let profile = null;
let grade = null;
let messages = [];
let selectedFile = null;
let channel = null;

const $ = id => document.getElementById(id);

const gradeNames = {
  "Year 1": "الفرقة الأولى",
  "Year 2": "الفرقة الثانية",
  "Year 3": "الفرقة الثالثة",
  "Year 4": "الفرقة الرابعة"
};

function esc(v){
  return String(v ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

function time(v){
  return new Date(v).toLocaleTimeString("ar-EG",{hour:"2-digit",minute:"2-digit"});
}

async function getLoggedUser(){
  if(typeof getCurrentUser === "function"){
    return await getCurrentUser();
  }
  const {data} = await client.auth.getUser();
  return data?.user || null;
}

async function boot(){
  user = await getLoggedUser();

  if(!user){
    location.href = "login.html?next=" + encodeURIComponent(location.href);
    return;
  }

  const {data,error} = await client
    .from("profiles")
    .select("id,full_name,email,grade,role")
    .eq("id",user.id)
    .single();

  if(error) throw error;

  profile = data;
  grade = data.grade;

  if(!grade){
    $("messages").innerHTML =
      '<div class="empty">⚠️ لا توجد فرقة محددة في حسابك. حدّد الفرقة أولًا من صفحة الحساب.</div>';
    return;
  }

  $("groupTitle").textContent = "💬 " + (gradeNames[grade] || grade);
  $("groupSubtitle").textContent = "جروب خاص بطلاب فرقتك";
  await loadMessages();
  startRealtime();
}

async function loadMessages(){
  const {data,error} = await client
    .from("ch_chat_messages")
    .select("*")
    .eq("grade",grade)
    .order("created_at",{ascending:true})
    .limit(200);

  if(error) throw error;
  messages = data || [];
  await render();
}

async function signedUrl(path){
  if(!path) return null;
  const {data,error} = await client.storage
    .from("chemistryhub-chat")
    .createSignedUrl(path,3600);
  return error ? null : data?.signedUrl;
}

async function render(){
  const box = $("messages");
  const q = $("searchInput").value.trim().toLowerCase();

  const list = messages.filter(m =>
    !q ||
    String(m.message || "").toLowerCase().includes(q) ||
    String(m.sender_name || "").toLowerCase().includes(q)
  );

  if(!list.length){
    box.innerHTML = '<div class="empty">💬<br>لا توجد رسائل بعد.<br><small>ابدأ أول محادثة مع زملائك.</small></div>';
    renderPinned();
    return;
  }

  box.innerHTML = "";

  for(const m of list){
    const mine = m.sender_id === user.id;
    const row = document.createElement("div");
    row.className = "message" + (mine ? " mine" : "");

    const avatar = document.createElement("div");
    avatar.className = "msg-avatar";
    avatar.textContent = String(m.sender_name || "ط").trim().slice(0,1);

    const content = document.createElement("div");
    content.className = "msg-content";

    let attachment = "";
    if(m.attachment_path){
      const url = await signedUrl(m.attachment_path);
      if(url){
        if(String(m.attachment_type || "").startsWith("image/")){
          attachment = `<div class="attachment"><a href="${url}" target="_blank" rel="noopener"><img src="${url}" alt="${esc(m.attachment_name)}"></a></div>`;
        }else{
          attachment = `<div class="attachment"><a class="file-link" href="${url}" target="_blank" rel="noopener">📄 ${esc(m.attachment_name || "ملف")}</a></div>`;
        }
      }
    }

    const admin = profile.role === "admin";
    const actions = (mine || admin || admin) ? `
      <div class="actions">
        ${(mine || admin) ? `<button type="button" onclick="deleteMessage('${m.id}')">🗑 حذف</button>` : ""}
        ${admin ? `<button type="button" onclick="pinMessage('${m.id}',${!m.pinned})">${m.pinned ? "إلغاء التثبيت" : "📌 تثبيت"}</button>` : ""}
      </div>` : "";

    content.innerHTML = `
      <div class="msg-name">${esc(m.sender_name)}${m.pinned ? " 📌" : ""}</div>
      ${m.message ? `<div class="bubble">${esc(m.message)}</div>` : ""}
      ${attachment}
      <div class="msg-meta">${time(m.created_at)}</div>
      ${actions}
    `;

    row.append(avatar,content);
    box.appendChild(row);
  }

  box.scrollTop = box.scrollHeight;
  renderPinned();
}

function renderPinned(){
  const pinned = messages.find(m => m.pinned);
  if(!pinned){
    $("pinned").hidden = true;
    return;
  }
  $("pinnedText").textContent = pinned.message || "📎 ملف مرفق";
  $("pinned").hidden = false;
}

window.deleteMessage = async id => {
  if(!confirm("هل تريد حذف الرسالة؟")) return;
  const {error} = await client.from("ch_chat_messages").delete().eq("id",id);
  if(error) alert(error.message);
};

window.pinMessage = async (id,pin) => {
  if(profile.role !== "admin") return;

  if(pin){
    const {error:clearError} = await client
      .from("ch_chat_messages")
      .update({pinned:false})
      .eq("grade",grade)
      .eq("pinned",true);
    if(clearError){ alert(clearError.message); return; }
  }

  const {error} = await client
    .from("ch_chat_messages")
    .update({pinned:pin})
    .eq("id",id);

  if(error) alert(error.message);
};

async function uploadFile(){
  if(!selectedFile) return null;

  const safe = selectedFile.name
    .replace(/[^\w\u0600-\u06FF.\- ]/g,"_")
    .slice(0,100);

  const path = `${grade}/${user.id}/${Date.now()}-${safe}`;

  const {data,error} = await client.storage
    .from("chemistryhub-chat")
    .upload(path,selectedFile,{upsert:false,contentType:selectedFile.type});

  if(error) throw error;
  return data.path;
}

function clearFile(){
  selectedFile = null;
  $("fileInput").value = "";
  $("filePreview").hidden = true;
  $("fileName").textContent = "";
}

$("fileInput").addEventListener("change",e => {
  const file = e.target.files?.[0];
  if(!file) return;

  if(file.size > 10 * 1024 * 1024){
    alert("الحد الأقصى للمرفق 10MB.");
    e.target.value = "";
    return;
  }

  selectedFile = file;
  $("fileName").textContent = file.name;
  $("filePreview").hidden = false;
});

$("clearFile").addEventListener("click",clearFile);

$("composer").addEventListener("submit",async e => {
  e.preventDefault();

  const text = $("messageInput").value.trim();
  if(!text && !selectedFile) return;

  $("sendButton").disabled = true;

  try{
    let path = null;
    if(selectedFile) path = await uploadFile();

    const {error} = await client.from("ch_chat_messages").insert({
      sender_id:user.id,
      sender_name:profile.full_name || "طالب",
      grade:grade,
      message:text,
      attachment_path:path,
      attachment_name:selectedFile?.name || null,
      attachment_type:selectedFile?.type || null
    });

    if(error) throw error;

    $("messageInput").value = "";
    clearFile();
  }catch(err){
    console.error(err);
    alert("تعذر إرسال الرسالة: " + err.message);
  }finally{
    $("sendButton").disabled = false;
  }
});

$("searchInput").addEventListener("input",render);

$("messageInput").addEventListener("keydown",e => {
  if(e.key === "Enter" && !e.shiftKey){
    e.preventDefault();
    $("composer").requestSubmit();
  }
});

function startRealtime(){
  channel = client.channel("chemhub-chat-" + grade);

  channel
    .on("postgres_changes",
      {event:"INSERT",schema:"public",table:"ch_chat_messages",filter:"grade=eq."+grade},
      payload => {
        if(!messages.some(m => m.id === payload.new.id)){
          messages.push(payload.new);
          render();
        }
      })
    .on("postgres_changes",
      {event:"UPDATE",schema:"public",table:"ch_chat_messages",filter:"grade=eq."+grade},
      payload => {
        const i = messages.findIndex(m => m.id === payload.new.id);
        if(i >= 0){
          messages[i] = payload.new;
          render();
        }
      })
    .on("postgres_changes",
      {event:"DELETE",schema:"public",table:"ch_chat_messages"},
      payload => {
        messages = messages.filter(m => m.id !== payload.old.id);
        render();
      })
    .on("presence",{event:"sync"},updatePresence)
    .subscribe(async status => {
      if(status === "SUBSCRIBED"){
        await channel.track({
          user_id:user.id,
          grade:grade
        });
      }
    });
}

function updatePresence(){
  if(!channel) return;
  const state = channel.presenceState();
  const ids = new Set();

  Object.values(state).flat().forEach(x => {
    if(x.user_id) ids.add(x.user_id);
  });

  $("onlineCount").textContent = "● " + ids.size + " متصل";
}

boot().catch(err => {
  console.error(err);
  $("messages").innerHTML = `<div class="empty">❌ حدث خطأ في تشغيل الشات.<br><small>${esc(err.message)}</small></div>`;
});
