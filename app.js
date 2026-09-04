const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];


/* =====================================================
   SUPABASE
===================================================== */

const siteClient =
  supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );


/* =====================================================
   YEAR
===================================================== */

const yearEl = $("#year");

if (yearEl) {
  yearEl.textContent =
    new Date().getFullYear();
}


/* =====================================================
   AUTH
===================================================== */

setupAuthUI()
  .catch(() =>
    renderAuthUI(null)
  );


/* =====================================================
   MENU
===================================================== */

if ($("#menuBtn")) {

  $("#menuBtn").addEventListener(
    "click",
    () => {

      const nav =
        $("#navLinks");

      nav.style.display =
        nav.style.display === "flex"
          ? "none"
          : "flex";

    }
  );

}


/* =====================================================
   DARK MODE
===================================================== */

if ($("#themeBtn")) {

  $("#themeBtn").addEventListener(
    "click",
    () => {

      document.documentElement
        .classList
        .toggle("dark");

      localStorage.setItem(
        "chemistryTheme",
        document.documentElement
          .classList
          .contains("dark")
          ? "dark"
          : "light"
      );

    }
  );

}


if (
  localStorage.getItem(
    "chemistryTheme"
  ) === "dark"
) {

  document.documentElement
    .classList
    .add("dark");

}


/* =====================================================
   LOAD SITE SETTINGS
===================================================== */

async function loadSiteSettings(){

  try {

    const {
      data,
      error
    } =
      await siteClient
        .from("site_settings")
        .select("key,value");


    if(error){

      console.log(
        "Site settings error:",
        error.message
      );

      return;

    }


    const settings = {};


    data.forEach(row => {

      settings[row.key] =
        row.value ?? "";

    });


    applySiteSettings(settings);


  } catch(error){

    console.log(
      "Could not load site settings:",
      error
    );

  }

}


/* =====================================================
   APPLY SETTINGS
===================================================== */

function setText(id,value){

  const el =
    document.getElementById(id);

  if(!el || value === undefined)
    return;

  el.textContent =
    value;

}


function setHtml(id,value){

  const el =
    document.getElementById(id);

  if(!el || value === undefined)
    return;

  el.innerHTML =
    value;

}


function applySiteSettings(s){

  /* Hero */

  setText(
    "heroDescription",
    s.hero_description
  );

  setHtml(
    "heroTitle",
    s.hero_title
  );


  /* Notice */

  setText(
    "siteNotice",
    s.notice
  );


  /* Stats */

  setText(
    "statYears",
    s.stat_years
  );

  setText(
    "statSemesters",
    s.stat_semesters
  );

  setText(
    "statContent",
    s.stat_content
  );


  /* Years */

  setText(
    "year1Title",
    s.year_1_title
  );

  setText(
    "year1Desc",
    s.year_1_desc
  );


  setText(
    "year2Title",
    s.year_2_title
  );

  setText(
    "year2Desc",
    s.year_2_desc
  );


  setText(
    "year3Title",
    s.year_3_title
  );

  setText(
    "year3Desc",
    s.year_3_desc
  );


  setText(
    "year4Title",
    s.year_4_title
  );

  setText(
    "year4Desc",
    s.year_4_desc
  );


  /* Services */

  setText(
    "toolQuizzesTitle",
    s.tool_quizzes_title
  );

  setText(
    "toolQuizzesDesc",
    s.tool_quizzes_desc
  );


  setText(
    "toolMaterialsTitle",
    s.tool_materials_title
  );

  setText(
    "toolMaterialsDesc",
    s.tool_materials_desc
  );


  setText(
    "toolAiTitle",
    s.tool_ai_title
  );

  setText(
    "toolAiDesc",
    s.tool_ai_desc
  );


  setText(
    "toolGpaTitle",
    s.tool_gpa_title
  );

  setText(
    "toolGpaDesc",
    s.tool_gpa_desc
  );


  /* About */

  setText(
    "aboutBadge",
    s.about_badge
  );

  setText(
    "aboutTitle",
    s.about_title
  );

  setText(
    "aboutText",
    s.about_text
  );


  setText(
    "aboutValue1",
    s.about_value_1
  );

  setText(
    "aboutValue2",
    s.about_value_2
  );

  setText(
    "aboutValue3",
    s.about_value_3
  );

  setText(
    "aboutValue4",
    s.about_value_4
  );


  /* Social */

  const socialLinks =
    document.querySelectorAll(
      ".social-icons a"
    );


  if(socialLinks.length >= 3){

    if(s.youtube)
      socialLinks[0].href =
        s.youtube;

    if(s.facebook)
      socialLinks[1].href =
        s.facebook;

    if(s.whatsapp)
      socialLinks[2].href =
        s.whatsapp;

  }

}


/* =====================================================
   LOAD SETTINGS
===================================================== */

loadSiteSettings();


/* =====================================================
   YEARS / SUBJECTS
===================================================== */

function renderYear(year){

  const view =
    $("#subjectView");

  const data =
    siteData[year];


  if(!data)
    return;


  let html = `

    <div class="section-head">

      <span class="eyebrow">
        الفرقة ${year}
      </span>

      <h2>
        الفصول الدراسية
      </h2>

    </div>

  `;


  Object.entries(data)
    .forEach(
      ([semester, subjects]) => {

        html += `
          <div class="semester">

            <h3>
              📚 ${semester}
            </h3>
        `;


        if(!subjects.length){

          html += `
            <div class="card empty">
              لم تتم إضافة مواد هذه الفرقة بعد.
            </div>
          `;

        }else{

          html += `
            <div class="subject-grid">
          `;


          subjects.forEach(
            ([name,teacher,grade]) => {

              html += `

                <a
                  class="subject"
                  href="subject.html?subject=${encodeURIComponent(name)}">

                  <div>

                    <strong>
                      ${name}
                    </strong>

                    <small>
                      ${teacher}
                    </small>

                  </div>

                  <b>
                    ${grade}
                  </b>

                </a>

              `;

            }
          );


          html += `
            </div>
          `;

        }


        html += `
          </div>
        `;

      }
    );


  view.innerHTML =
    html;


  location.hash =
    "subjects";

}


$$(".year-card")
  .forEach(card => {

    card.addEventListener(
      "click",
      () =>
        renderYear(
          card.dataset.year
        )
    );

  });


/* =====================================================
   GPA
===================================================== */

let courses =
  JSON.parse(
    localStorage.getItem(
      "chemCourses"
    ) || "[]"
  );


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

  const list =
    $("#courseList");


  if(!list)
    return;


  if(!courses.length){

    list.innerHTML =
      '<p class="empty">لم تتم إضافة مواد بعد.</p>';

  }else{

    list.innerHTML =
      courses.map(
        (c,i) => `

          <div class="course-row">

            <span>
              ${c.name || "مادة"}
            </span>

            <span>
              ${c.grade}/100
            </span>

            <span>
              ${c.hours} ساعات
            </span>

            <button
              onclick="removeCourse(${i})">

              ×

            </button>

          </div>

        `
      ).join("");

  }


  let points = 0;
  let hours = 0;


  courses.forEach(c => {

    points +=
      gradePoint(
        Number(c.grade)
      ) *
      Number(c.hours);

    hours +=
      Number(c.hours);

  });


  if($("#gpaValue")){

    $("#gpaValue")
      .textContent =
      hours
        ? (points / hours)
            .toFixed(2)
        : "0.00";

  }


  if($("#hoursValue")){

    $("#hoursValue")
      .textContent =
      `${hours} ساعات معتمدة`;

  }


  localStorage.setItem(
    "chemCourses",
    JSON.stringify(courses)
  );

}


window.removeCourse =
  i => {

    courses.splice(i,1);

    renderCourses();

  };


if($("#addCourse")){

  $("#addCourse")
    .addEventListener(
      "click",
      () => {

        const grade =
          Number(
            $("#courseGrade").value
          );

        const hours =
          Number(
            $("#courseHours").value
          );


        if(
          !grade ||
          grade < 0 ||
          grade > 100 ||
          !hours
        ){

          alert(
            "أدخل درجة صحيحة وعدد الساعات."
          );

          return;

        }


        courses.push({

          name:
            $("#courseName")
              .value
              .trim(),

          grade,

          hours

        });


        $("#courseName")
          .value = "";

        $("#courseGrade")
          .value = "";

        $("#courseHours")
          .value = "";


        renderCourses();

      }
    );

}


if($("#clearCourses")){

  $("#clearCourses")
    .addEventListener(
      "click",
      () => {

        if(
          confirm(
            "مسح كل المواد؟"
          )
        ){

          courses = [];

          renderCourses();

        }

      }
    );

}


renderCourses();
