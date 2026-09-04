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
  return user?.app_metadata?.role === "admin";
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
  const adminLink = isAdmin(user) ? `<a href="admin.html">لوحة الإدارة</a>` : "";

  box.innerHTML = `
    <div class="account-menu">
      <button class="account-toggle" id="accountToggle" type="button" aria-expanded="false">
        <span class="account-avatar">${name.slice(0,1)}</span>
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
  document.addEventListener("click", () => dropdown.classList.remove("open"), { once: true });
}

async function setupAuthUI() {
  const client = initSupabase();
  const { data: { user } } = await client.auth.getUser();
  renderAuthUI(user);
  client.auth.onAuthStateChange((_event, session) => renderAuthUI(session?.user || null));
  return user;
}
