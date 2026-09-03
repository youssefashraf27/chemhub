const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

$("#year").textContent = new Date().getFullYear();

$("#menuBtn").addEventListener("click", () => {
  const nav = $("#navLinks");
  nav.style.display = nav.style.display === "flex" ? "none" : "flex";
});

$("#themeBtn").addEventListener("click", () => {
  document.documentElement.classList.toggle("dark");
  localStorage.setItem("chemistryTheme", document.documentElement.classList.contains("dark") ? "dark" : "light");
});
if(localStorage.getItem("chemistryTheme")==="dark") document.documentElement.classList.add("dark");

function renderYear(year){
  const view = $("#subjectView");
  const data = siteData[year];
  let html = `<div class="section-head"><span class="eyebrow">الفرقة ${year}</span><h2>الفصول الدراسية</h2></div>`;
  Object.entries(data).forEach(([semester, subjects])=>{
    html += `<div class="semester"><h3>📚 ${semester}</h3>`;
    if(!subjects.length){
      html += `<div class="card empty">لم تتم إضافة مواد هذه الفرقة بعد. أضفها من <code>js/data.js</code>.</div>`;
    }else{
      html += `<div class="subject-grid">`;
      subjects.forEach(([name,teacher,grade])=>{
        html += `<div class="subject"><div><strong>${name}</strong><small>${teacher}</small></div><b>${grade}</b></div>`;
      });
      html += `</div>`;
    }
    html += `</div>`;
  });
  view.innerHTML = html;
  location.hash = "subjects";
}

$$(".year-card").forEach(card=>card.addEventListener("click",()=>renderYear(card.dataset.year)));

let courses = JSON.parse(localStorage.getItem("chemCourses") || "[]");

function gradePoint(g){
  if(g >= 90) return 4;
  if(g >= 85) return 3.7;
  if(g >= 80) return 3.3;
  if(g >= 75) return 3;
  if(g >= 70) return 2.7;
  if(g >= 65) return 2.3;
  if(g >= 60) return 2;
  if(g >= 50) return 1;
  return 0;
}

function renderCourses(){
  const list = $("#courseList");
  if(!courses.length){ list.innerHTML = '<p class="empty">لم تتم إضافة مواد بعد.</p>'; }
  else {
    list.innerHTML = courses.map((c,i)=>`
      <div class="course-row">
        <span>${c.name || "مادة"}</span><span>${c.grade}/100</span><span>${c.hours} ساعات</span>
        <button onclick="removeCourse(${i})">×</button>
      </div>`).join("");
  }
  let points=0,hours=0;
  courses.forEach(c=>{points += gradePoint(Number(c.grade))*Number(c.hours);hours += Number(c.hours)});
  $("#gpaValue").textContent = hours ? (points/hours).toFixed(2) : "0.00";
  $("#hoursValue").textContent = `${hours} ساعات معتمدة`;
  localStorage.setItem("chemCourses",JSON.stringify(courses));
}
window.removeCourse = i => { courses.splice(i,1); renderCourses(); };

$("#addCourse").addEventListener("click",()=>{
  const grade=Number($("#courseGrade").value), hours=Number($("#courseHours").value);
  if(!grade || grade<0 || grade>100 || !hours){ alert("أدخل درجة صحيحة وعدد الساعات."); return; }
  courses.push({name:$("#courseName").value.trim(),grade,hours});
  $("#courseName").value=""; $("#courseGrade").value=""; $("#courseHours").value="";
  renderCourses();
});
$("#clearCourses").addEventListener("click",()=>{
  if(confirm("مسح كل المواد؟")){courses=[];renderCourses();}
});
renderCourses();