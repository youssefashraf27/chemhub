/* Shared Supabase auth helpers for ChemistryHub */
let supabaseClient;

function initSupabase() {
  if (!window.supabase) throw new Error("Supabase library لم يتم تحميلها.");
  if (!supabaseClient) supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return supabaseClient;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[ch]));
}

function getDisplayName(user) {
  return user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "الطالب";
}

function isAdmin(user) {
  const role = user?.app_metadata?.role || user?.profile?.role;
  return role === 'admin' || role === 'owner';
}

function isOwner(user) {
  const role = user?.app_metadata?.role || user?.profile?.role;
  return role === 'owner';
}

async function getCurrentUser() {
  const client = initSupabase();
  const { data: { user }, error } = await client.auth.getUser();
  if (error) throw error;
  return user;
}

async function logout() {
  try {
    const client = initSupabase();
    const { error } = await client.auth.signOut();
    if (error) throw error;
  } finally {
    window.location.href = "login.html";
  }
}

function renderAuthUI(user) {
  const box = document.getElementById("accountBox");
  if (!box) return;

  if (!user) {
    box.innerHTML = `<a class="account-login" href="login.html">تسجيل الدخول</a>`;
    return;
  }

  const name = escapeHTML(getDisplayName(user));
  const email = escapeHTML(user.email || "");
  const avatar = user?.profile?.avatar_url || user?.user_metadata?.avatar_url || '';
  const avatarHtml = avatar
    ? `<img src="${escapeHTML(avatar)}" alt="صورة الحساب" class="account-avatar-img">`
    : `<span class="account-avatar-fallback" aria-hidden="true">${escapeHTML(name.slice(0, 1) || "ط")}</span>`;
  const adminLink = isAdmin(user) ? `<a href="admin.html">لوحة الإدارة</a>` : "";

  box.innerHTML = `
    <div class="account-menu">
      <button class="account-toggle" id="accountToggle" type="button" aria-expanded="false">
        ${avatarHtml}
        <span class="account-label"><strong>${name}</strong><small>${email}</small></span>
        <span>⌄</span>
      </button>
      <div class="account-dropdown" id="accountDropdown">
        <div class="account-summary"><strong>${name}</strong><small>${email}</small></div>
        ${adminLink}
        <a href="account.html">حسابي</a>
        <button type="button" onclick="logout()">تسجيل الخروج</button>
      </div>
    </div>`;

  const toggle = document.getElementById("accountToggle");
  const dropdown = document.getElementById("accountDropdown");
  toggle.addEventListener("click", e => {
    e.stopPropagation();
    const open = dropdown.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
  const closeDropdown = event => {
    if (!box.contains(event.target)) {
      dropdown.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    }
  };
  document.addEventListener("click", closeDropdown);
}

async function setupAuthUI() {
  const client = initSupabase();
  const { data: { user } } = await client.auth.getUser();
  if (user) {
    const { data: profile } = await client.from("profiles").select("role,full_name,phone,grade,avatar_url").eq("id", user.id).maybeSingle();
    if (profile) user.profile = profile;
  }
  renderAuthUI(user);
  client.auth.onAuthStateChange(async (_event, session) => {
    const nextUser = session?.user || null;
    if (nextUser) {
      const { data: profile } = await client.from("profiles").select("role,full_name,phone,grade,avatar_url").eq("id", nextUser.id).maybeSingle();
      if (profile) nextUser.profile = profile;
    }
    renderAuthUI(nextUser);
  });
  return user;
}

async function requireLogin(){
  try{ return !!(await getCurrentUser()); }catch(e){ return false; }
}
function showLoginRequired(message="سجّل دخولك لاستخدام هذه الخدمة"){
  if(confirm(message+"\n\nهل تريد تسجيل الدخول الآن؟")){
    window.location.href="login.html?next="+encodeURIComponent(location.href);
  }
}
async function protectService(callback,message="هذه الخدمة تحتاج تسجيل دخول"){
  if(await requireLogin()){ if(typeof callback==='function') callback(); return true; }
  showLoginRequired(message); return false;
}
async function protectPage(){
  const user=await getCurrentUser().catch(()=>null);
  if(!user){
    window.location.href="login.html?next="+encodeURIComponent(location.href);
    return false;
  }
  return true;
}
