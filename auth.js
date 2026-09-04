// ===============================
// ChemistryHub Authentication
// ===============================

const { data: { session } } = await supabaseClient.auth.getSession();

window.currentSession = session;
window.currentUser = session?.user || null;


// --------------------------------
// التحقق من تسجيل الدخول
// --------------------------------

async function requireLogin() {
    const { data: { session } } =
        await supabaseClient.auth.getSession();

    if (!session) {
        return false;
    }

    window.currentSession = session;
    window.currentUser = session.user;

    return true;
}


// --------------------------------
// رسالة للمستخدم غير المسجل
// --------------------------------

function showLoginRequired(message = "سجّل دخولك لاستخدام هذه الخدمة") {

    const ok = confirm(
        message + "\n\nهل تريد تسجيل الدخول الآن؟"
    );

    if (ok) {
        window.location.href = "login.html";
    }
}


// --------------------------------
// تسجيل الخروج
// --------------------------------

async function logout() {

    await supabaseClient.auth.signOut();

    window.location.href = "index.html";
}


// --------------------------------
// حماية خدمة معينة
// --------------------------------

async function protectService(callback) {

    const loggedIn = await requireLogin();

    if (!loggedIn) {
        showLoginRequired();
        return;
    }

    callback();
}


// --------------------------------
// حماية صفحة كاملة
// --------------------------------

async function protectPage() {

    const loggedIn = await requireLogin();

    if (!loggedIn) {
        document.body.innerHTML = `
            <div style="
                min-height:100vh;
                display:flex;
                align-items:center;
                justify-content:center;
                text-align:center;
                padding:30px;
                font-family:Arial;
            ">

                <div>

                    <h2>🔒 هذه الصفحة للمستخدمين المسجلين</h2>

                    <p>
                        سجّل دخولك أولًا للوصول إلى هذه الصفحة.
                    </p>

                    <button
                        onclick="location.href='login.html'"
                        style="
                            padding:12px 25px;
                            border:none;
                            border-radius:10px;
                            cursor:pointer;
                        "
                    >
                        تسجيل الدخول
                    </button>

                </div>

            </div>
        `;

        return false;
    }

    return true;
}
