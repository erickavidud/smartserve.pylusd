const WRAPPER_MASS_G = 0.15;
const DEFAULT_PARTICIPATION = 26.6;

const defaultValencia = {
  name:"Valencia High School",
  enrollment:2445,
  level:"high",
  participation:26.6,
  baseline:650,
  dispensers:8,
  days:180,
  coverage:100,
  daily:650,
  annual:117000,
  startDate:"2026-09-29"
};

const SUPABASE_URL = "https://lfjdxsxjyoomycsgbbuw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_b8iWMeU3mYDqSO9D1nJZTQ_hOl__a9A";

let potentialScenarios = JSON.parse(localStorage.getItem("smartServePotential_v3") || "[]");
let implementedScenarios = [];
let databaseConnected = false;


function mapDatabaseSchool(row){
  const enrollment = Number(row.enrollment) || 0;
  const participation = Number(row.participation) || 0;
  const coverage = Number(row.coverage) || 0;
  const dispensers = Number(row.dispensers) || 0;
  const days = Number(row.school_days) || 180;
  const baseline = baselineFor(enrollment, participation);
  const daily = baseline * (coverage / 100);
  return {
    id: row.id,
    name: row.name || "Unnamed School",
    enrollment,
    level: row.level || "high",
    participation,
    coverage,
    dispensers,
    days,
    startDate: row.start_date || "",
    baseline,
    daily,
    annual: daily * days
  };
}

async function loadOfficialSchools(){
  const status = document.getElementById("syncStatus");
  try{
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/schools?select=*&order=id.asc`,
      {
        headers:{
          "apikey": SUPABASE_PUBLISHABLE_KEY,
          "Authorization": `Bearer ${SUPABASE_PUBLISHABLE_KEY}`
        }
      }
    );

    if(!response.ok){
      throw new Error(`Database request failed (${response.status})`);
    }

    const rows = await response.json();
    implementedScenarios = rows.map(mapDatabaseSchool);
    databaseConnected = true;

    if(status){
      status.innerHTML = `<strong>Live database connected.</strong> ${implementedScenarios.length} official implemented school${implementedScenarios.length===1?"":"s"} synced from Supabase.`;
    }
    renderAll();
  }catch(error){
    console.error("Smart Serve database connection error:", error);
    databaseConnected = false;
    implementedScenarios = [defaultValencia];
    if(status){
      status.innerHTML = `<strong>Database connection unavailable.</strong> Showing the Valencia fallback so the dashboard remains usable.`;
    }
    renderAll();
  }
}

function fmt(n){ return Math.round(n).toLocaleString(); }
function initials(name){
  return name.split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join("").toUpperCase();
}
function kgFromWrappers(w){ return w*WRAPPER_MASS_G/1000; }

document.querySelectorAll(".tab").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll(".tab").forEach(b=>b.classList.remove("active"));
    document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.view).classList.add("active");
    window.scrollTo({top:0,behavior:"smooth"});
  });
});

function baselineFor(enrollment,participation){
  return enrollment*(participation/100);
}

function calculate(){
  const enrollment=parseFloat(document.getElementById("enrollment").value);
  const level=document.getElementById("schoolLevel").value;
  const participation=parseFloat(document.getElementById("participation").value)||0;
  const coverage=parseFloat(document.getElementById("coverage").value)/100;
  const dispensers=parseFloat(document.getElementById("proposedDispensers").value)||0;
  const days=parseFloat(document.getElementById("schoolDays").value)||180;
  if(!enrollment || enrollment<=0) return null;

  const baseline=baselineFor(enrollment,participation);
  const daily=baseline*coverage;
  const annual=daily*days;

  document.getElementById("simBaseline").textContent=fmt(baseline);
  document.getElementById("simDaily").textContent=fmt(daily);
  document.getElementById("simKg").textContent=kgFromWrappers(annual).toFixed(1)+" kg";
  document.getElementById("simCoverage").textContent=Math.round(coverage*100)+"%";

  const startDate=document.getElementById("startDate").value || "";
  return {daily,annual,baseline,dispensers,days,enrollment,level,participation,coverage:coverage*100,startDate};
}

["enrollment","schoolLevel","participation","proposedDispensers","schoolDays","startDate"].forEach(id=>{
  document.getElementById(id).addEventListener("input",calculate);
  document.getElementById(id).addEventListener("change",calculate);
});
const coverageSlider=document.getElementById("coverage");
function syncCoverageSlider(){
  const val=parseFloat(coverageSlider.value)||0;
  document.getElementById("coverageValue").textContent=Math.round(val)+"%";
  document.getElementById("simCoverage").textContent=Math.round(val)+"%";
  coverageSlider.style.background=`linear-gradient(90deg,var(--green) 0%,var(--green) ${val}%,#153522 ${val}%,#153522 100%)`;
  calculate();
}
coverageSlider.addEventListener("input",syncCoverageSlider);
coverageSlider.addEventListener("change",syncCoverageSlider);
syncCoverageSlider();
document.getElementById("calculate").addEventListener("click",calculate);

function getScenarioFromForm(){
  const data=calculate();
  const name=document.getElementById("schoolName").value.trim();
  if(!data || !name){ alert("Enter a school name and enrollment first."); return null; }
  return {name,...data};
}

document.getElementById("addPotential").addEventListener("click",()=>{
  const s=getScenarioFromForm(); if(!s)return;
  potentialScenarios.push(s); persist(); renderAll();
});
document.getElementById("addImplemented").addEventListener("click",()=>{
  alert("Official implemented schools are now synced from Supabase. For security, add or edit official schools in the Supabase Table Editor. The simulator remains available for testing potential scenarios.");
});

function persist(){
  localStorage.setItem("smartServePotential_v3",JSON.stringify(potentialScenarios));
}

function removePotential(i){potentialScenarios.splice(i,1);persist();renderAll();}
function removeImplemented(i){
  alert("Official schools are managed in Supabase so public visitors cannot change district data.");
}
function promotePotential(i){
  alert("To make a potential school official, add it to the Supabase schools table. This keeps the public tracker protected.");
}
function toggleEditor(i){
  document.getElementById("editor-"+i).classList.toggle("active");
}
function saveImplementedEdit(i){
  alert("Official school edits are managed in Supabase.");
}


const SCHOOL_YEAR_START = "2026-08-13";
const SCHOOL_YEAR_END = "2027-05-27";
const NON_STUDENT_DATES = new Set([
  "2026-09-07",
  "2026-11-11",
  "2026-11-23","2026-11-24","2026-11-25","2026-11-26","2026-11-27",
  "2026-12-18",
  "2026-12-21","2026-12-22","2026-12-23","2026-12-24","2026-12-25",
  "2026-12-28","2026-12-29","2026-12-30","2026-12-31",
  "2027-01-01",
  "2027-01-18",
  "2027-02-08",
  "2027-02-15",
  "2027-03-29","2027-03-30","2027-03-31","2027-04-01","2027-04-02"
]);

function isoDate(d){
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,"0");
  const day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

function isStudentDay(d, level="high"){
  const iso=isoDate(d);
  const dow=d.getDay();
  if(dow===0 || dow===6) return false;
  if(iso<SCHOOL_YEAR_START || iso>SCHOOL_YEAR_END) return false;
  if(NON_STUDENT_DATES.has(iso)) return false;

  // Elementary-only non-student day.
  if(level==="elementary" && iso==="2026-11-20") return false;

  return true;
}

function studentDayCountSince(startDate, maxDays, level="high"){
  if(!startDate) return 0;
  const start=new Date(startDate+"T12:00:00");
  const today=new Date();
  today.setHours(12,0,0,0);
  if(start>today) return 0;

  let count=0;
  let d=new Date(start);
  while(d<=today && count<maxDays){
    if(isStudentDay(d,level)) count++;
    d.setDate(d.getDate()+1);
  }
  return count;
}
function cumulativeWrappersForSchool(s){
  const trackedDays=studentDayCountSince(s.startDate,s.days||180,s.level||"high");
  return (s.daily||0)*trackedDays;
}

function renderHome(){
  let daily=0,annual=0,disp=0,totalWrappers=0;
  implementedScenarios.forEach(s=>{
    daily+=s.daily; annual+=s.annual; disp+=s.dispensers;
    totalWrappers+=cumulativeWrappersForSchool(s);
  });
  const kgYear=kgFromWrappers(annual);
  const kgToDate=kgFromWrappers(totalWrappers);
  animateNumber(document.getElementById("dailyWrappers"),daily,0,"");
  animateNumber(document.getElementById("totalWrappers"),totalWrappers,0,"");
  animateNumber(document.getElementById("installedDispensers"),disp,0,"");
  animateNumber(document.getElementById("implementedCount"),implementedScenarios.length,0,"");
  animateNumber(document.getElementById("cumulativeKg"),kgToDate,1,"");
  animateNumber(document.getElementById("kgDay"),kgFromWrappers(daily),2," kg");
  animateNumber(document.getElementById("kgMonth"),kgFromWrappers(daily*20),1," kg");
  animateNumber(document.getElementById("kgToDate"),kgToDate,1," kg");

  const list=document.getElementById("homeImplementedList");
  list.innerHTML="";
  implementedScenarios.forEach(s=>{
    const row=document.createElement("div");
    row.className="schoolCard";
    row.innerHTML=`<div class="schoolIdentity"><div class="schoolLogo">${initials(s.name)}</div><div><div class="schoolName">${s.name}</div><div class="schoolMeta">${fmt(s.enrollment)} students · ${fmt(s.daily)} wrappers/day avoided · ${Math.round(s.coverage)}% coverage · ${fmt(s.dispensers)} dispensers · tracking ${s.startDate ? "from "+s.startDate : "not started"}</div></div></div><span class="status live">IMPLEMENTED</span>`;
    list.appendChild(row);
  });
}

function renderImplemented(){
  const grid=document.getElementById("implementedGrid");
  grid.innerHTML="";
  if(!implementedScenarios.length){
    grid.innerHTML=`<div class="card"><div class="muted">No official implemented schools are currently in the database.</div></div>`;
    return;
  }
  implementedScenarios.forEach((s)=>{
    const wrap=document.createElement("div");
    wrap.className="card";
    wrap.innerHTML=`
      <div class="scenarioCard" style="border:0;background:transparent;padding:0">
        <div class="schoolIdentity">
          <div class="schoolLogo">${initials(s.name)}</div>
          <div>
            <div class="schoolName">${s.name}</div>
            <div class="schoolMeta">${fmt(s.enrollment)} students · ${fmt(s.daily)} wrappers/day avoided · ${kgFromWrappers(s.annual).toFixed(1)} kg/year · ${Math.round(s.coverage)}% coverage · ${s.startDate ? "tracking from "+s.startDate : "tracking not started"}</div>
          </div>
        </div>
        <div class="scenarioActions">
          <span class="status live">${databaseConnected ? "DATABASE SYNCED" : "FALLBACK"}</span>
        </div>
      </div>`;
    grid.appendChild(wrap);
  });
}

function renderPotential(){
  const grid=document.getElementById("potentialGrid");grid.innerHTML="";
  let daily=0,annual=0,disp=0;
  potentialScenarios.forEach((s,i)=>{
    daily+=s.daily;annual+=s.annual;disp+=s.dispensers;
    const row=document.createElement("div");
    row.className="scenarioCard";
    row.innerHTML=`<div class="schoolIdentity"><div class="schoolLogo">${initials(s.name)}</div><div><div class="schoolName">${s.name}</div><div class="schoolMeta">${fmt(s.enrollment)} students · ${fmt(s.daily)} wrappers/day avoided · ${kgFromWrappers(s.annual).toFixed(1)} kg/year · ${Math.round(s.coverage)}% coverage</div></div></div>
      <div class="scenarioActions"><span class="status potential">POTENTIAL</span><button class="btn small secondary" onclick="promotePotential(${i})">Make Official</button><button class="btn small danger" onclick="removePotential(${i})">Delete</button></div>`;
    grid.appendChild(row);
  });
  document.getElementById("potentialCount").textContent=potentialScenarios.length;
  document.getElementById("potentialDaily").textContent=fmt(daily);
  document.getElementById("potentialAnnual").textContent=fmt(annual);
  document.getElementById("potentialDispensers").textContent=fmt(disp);
}


function animateNumber(el,target,decimals=0,suffix=""){
  const start=parseFloat((el.textContent||"0").replace(/,/g,""))||0;
  const duration=700;
  const t0=performance.now();
  function step(now){
    const p=Math.min(1,(now-t0)/duration);
    const eased=1-Math.pow(1-p,3);
    const val=start+(target-start)*eased;
    el.textContent=(decimals?val.toFixed(decimals):Math.round(val).toLocaleString())+suffix;
    if(p<1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

const revealObserver=new IntersectionObserver(entries=>{
  entries.forEach(entry=>{
    if(entry.isIntersecting){
      entry.target.classList.add("visible");
      revealObserver.unobserve(entry.target);
    }
  });
},{threshold:.12});

document.querySelectorAll(".reveal").forEach(el=>revealObserver.observe(el));

function renderAll(){renderHome();renderImplemented();renderPotential();}
renderAll();
loadOfficialSchools();