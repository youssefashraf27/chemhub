const SUPABASE_URL="https://gypdbqfqbfqedqekftuh.supabase.co";
const SUPABASE_KEY="sb_publishable_CMhxbEfoCraLLypVIkqvOA_C_jj0w1q";
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

const $=id=>document.getElementById(id);
const alertBox=$("alert");
function showAlert(msg,type="error"){alertBox.textContent=msg;alertBox.className=`alert show ${type}`;}
function clearAlert(){alertBox.className="alert";alertBox.textContent="";}
function setBusy(btn,busy){btn.disabled=busy;btn.dataset.old=btn.innerHTML;btn.innerHTML=busy?'<i class="fas fa-spinner fa-spin"></i> جاري التنفيذ...':btn.dataset.old;}

function setMode(mode){
  clearAlert();
  document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t.dataset.mode===mode));
  $("loginForm").classList.toggle("active",mode==="login");
  $("signupForm").classList.toggle("active",mode==="signup");
  $("resetForm").classList.remove("active");
}
document.querySelectorAll(".tab").forEach(t=>t.addEventListener("click",()=>setMode(t.dataset.mode)));

document.querySelectorAll(".eye").forEach(btn=>btn.addEventListener("click",()=>{
  const input=$(btn.dataset.target); input.type=input.type==="password"?"text":"password";
  btn.innerHTML=input.type==="password"?'<i class="far fa-eye"></i>':'<i class="far fa-eye-slash"></i>';
}));

$("forgotBtn").addEventListener("click",()=>{clearAlert();$("loginForm").classList.remove("active");$("signupForm").classList.remove("active");$("resetForm").classList.add("active");});
$("backLogin").addEventListener("click",()=>setMode("login"));

function validEgyptPhone(v){return /^(01)[0125][0-9]{8}$/.test(v.replace(/\s+/g,""))}

$("loginForm").addEventListener("submit",async e=>{
 e.preventDefault();clearAlert();
 const btn=e.submitter;
 setBusy(btn,true);
 const {error}=await sb.auth.signInWithPassword({email:$("loginEmail").value.trim(),password:$("loginPassword").value});
 if(error){showAlert(error.message.includes("Invalid login credentials")?"البريد الإلكتروني أو كلمة السر غير صحيحة.":error.message);setBusy(btn,false);return;}
 window.location.href="index.html";
});

$("signupForm").addEventListener("submit",async e=>{
 e.preventDefault();clearAlert();
 const btn=e.submitter, name=$("fullName").value.trim(), phone=$("phone").value.trim(), email=$("signupEmail").value.trim(), pass=$("signupPassword").value, pass2=$("signupPassword2").value, dept=$("department").value;
 const parts=name.split(/\s+/).filter(Boolean);
 if(parts.length<4){showAlert("من فضلك اكتب الاسم الرباعي كاملًا.");return}
 if(!validEgyptPhone(phone)){showAlert("اكتب رقم هاتف مصري صحيح مثل 01012345678.");return}
 if(pass.length<8){showAlert("كلمة السر يجب أن تكون 8 أحرف على الأقل.");return}
 if(pass!==pass2){showAlert("تأكيد كلمة السر غير مطابق.");return}
 setBusy(btn,true);
 const {data,error}=await sb.auth.signUp({
   email,password:pass,
   options:{data:{full_name:name,phone,department:dept,year_level:dept},emailRedirectTo:location.origin+location.pathname}
 });
 if(error){showAlert(error.message.includes("already registered")?"هذا البريد مسجل بالفعل. جرّب تسجيل الدخول أو استعادة كلمة السر.":error.message);setBusy(btn,false);return}
 if(data.session){
   await saveProfile(data.user,name,phone,dept,email);
   showAlert("تم إنشاء الحساب بنجاح، جاري فتح الموقع...","success");
   setTimeout(()=>location.href="index.html",700);
 }else{
   showAlert("تم إنشاء الحساب. راجع بريدك الإلكتروني لتأكيد الحساب ثم سجّل الدخول.","success");
   setMode("login");
 }
 setBusy(btn,false);
});

async function saveProfile(user,name,phone,dept,email){
 try{
   await sb.from("profiles").upsert({id:user.id,full_name:name,phone:phone,department:dept,year_level:dept,email:email},{onConflict:"id"});
 }catch(e){console.warn("Profile sync skipped",e)}
}

$("resetForm").addEventListener("submit",async e=>{
 e.preventDefault();clearAlert();
 const btn=e.submitter;setBusy(btn,true);
 const {error}=await sb.auth.resetPasswordForEmail($("resetEmail").value.trim(),{redirectTo:location.origin+location.pathname});
 if(error)showAlert(error.message);else showAlert("تم إرسال رابط استعادة كلمة السر إلى بريدك الإلكتروني.","success");
 setBusy(btn,false);
});

(async()=>{
 const {data:{session}}=await sb.auth.getSession();
 if(session) location.href="index.html";
})();