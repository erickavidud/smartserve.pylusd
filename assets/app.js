



const interactiveBgEnabled =
  window.matchMedia("(hover:hover) and (pointer:fine)").matches &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if(interactiveBgEnabled){
  const root=document.documentElement;
  const aura=document.getElementById("mouseAura");
  let targetX=window.innerWidth*.5;
  let targetY=window.innerHeight*.28;
  root.style.setProperty("--spot-x",`${targetX}px`);
  root.style.setProperty("--spot-y",`${targetY}px`);
  let auraX=targetX;
  let auraY=targetY;
  let rafId=0;

  const animateAura=()=>{
    auraX += (targetX-auraX)*0.12;
    auraY += (targetY-auraY)*0.12;
    root.style.setProperty("--aura-x",`${auraX}px`);
    root.style.setProperty("--aura-y",`${auraY}px`);
    rafId=requestAnimationFrame(animateAura);
  };

  let idleTimer=0;
  document.addEventListener("pointermove",e=>{
    targetX=e.clientX;
    targetY=e.clientY;
    root.style.setProperty("--spot-x",`${e.clientX}px`);
    root.style.setProperty("--spot-y",`${e.clientY}px`);
    document.body.classList.add("mouse-active");
    clearTimeout(idleTimer);
    idleTimer=setTimeout(()=>document.body.classList.remove("mouse-active"),420);
  },{passive:true});

  document.addEventListener("pointerleave",()=>{
    document.body.classList.remove("mouse-active");
  });

  animateAura();
}



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
const ADMIN_USERNAME = "smartserveadmin";
const ADMIN_EMAIL = "smartserveinitiative@gmail.com";
let adminSession = JSON.parse(sessionStorage.getItem("smartServeAdminSession") || "null");

let potentialScenarios = JSON.parse(localStorage.getItem("smartServePotential_v3") || "[]");
let implementedScenarios = [];
let databaseConnected = false;



function isAdmin(){
  return !!(adminSession && adminSession.access_token && adminSession.user &&
    String(adminSession.user.email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase());
}

function updateAdminUI(){
  const signedOut=document.getElementById("loginSignedOut");
  const signedIn=document.getElementById("loginSignedIn");
  const addOfficial=document.getElementById("addImplemented");
  document.getElementById("loginNavBtn").textContent="Login";
  if(isAdmin()){
    signedOut.style.display="none";
    signedIn.style.display="";
    if(addOfficial) addOfficial.style.display="";
  }else{
    signedOut.style.display="";
    signedIn.style.display="none";
    if(addOfficial) addOfficial.style.display="none";
  }
}

async function adminLogin(){
  const username=document.getElementById("adminUsernameModal").value.trim();
  const password=document.getElementById("adminPasswordModal").value;
  const status=document.getElementById("loginStatus");

  const setStatus=(message,type="")=>{
    if(!status) return;
    status.textContent=message;
    status.className=`loginStatus ${type}`.trim();
  };

  if(!username || !password){
    setStatus("Enter both username and password.","error");
    return false;
  }

  if(username.toLowerCase() !== ADMIN_USERNAME.toLowerCase()){
    setStatus("Login unsuccessful. Check your username or password.","error");
    return false;
  }

  try{
    setStatus("Signing in…","loading");

    const res=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{
      method:"POST",
      headers:{
        "apikey":SUPABASE_PUBLISHABLE_KEY,
        "Content-Type":"application/json"
      },
      body:JSON.stringify({email:ADMIN_EMAIL,password})
    });

    const data=await res.json().catch(()=>({}));

    if(!res.ok || !data.access_token){
      setStatus("Login unsuccessful. Check your username or password.","error");
      return false;
    }

    adminSession=data;
    sessionStorage.setItem("smartServeAdminSession",JSON.stringify(adminSession));
    document.getElementById("adminPasswordModal").value="";
    setStatus("Login successful.","success");
    updateAdminUI();
    renderAll();
    return true;
  }catch(err){
    console.error("Admin login failed:",err);
    setStatus("Login unsuccessful. Could not reach Supabase.","error");
    return false;
  }
}


function adminLogout(){
  adminSession=null;
  sessionStorage.removeItem("smartServeAdminSession");
  updateAdminUI();
  renderAll();
}

async function officialWrite(method, body=null, id=null){
  if(!isAdmin()) throw new Error("Admin login required.");
  let url=`${SUPABASE_URL}/rest/v1/schools`;
  if(id!==null) url+=`?id=eq.${encodeURIComponent(id)}`;
  const headers={
    "apikey":SUPABASE_PUBLISHABLE_KEY,
    "Authorization":`Bearer ${adminSession.access_token}`,
    "Content-Type":"application/json",
    "Prefer":"return=representation"
  };
  const options={method,headers};
  if(body!==null) options.body=JSON.stringify(body);
  const res=await fetch(url,options);
  if(!res.ok){
    let msg=await res.text();
    throw new Error(msg || `Database write failed (${res.status})`);
  }

  if(res.status===204) return null;

  const result=await res.json().catch(()=>null);

  // PATCH/DELETE against an ID should return the affected row.
  // An empty result usually means the authenticated user was blocked by RLS
  // or the requested database row was not matched.
  if((method==="PATCH" || method==="DELETE") && id!==null &&
     Array.isArray(result) && result.length===0){
    throw new Error("Supabase changed 0 rows. Check the UPDATE/DELETE RLS policy for your current admin user UID.");
  }

  return result;
}

function scenarioToDatabase(s){
  return {
    name:s.name,
    level:s.level,
    enrollment:Math.round(s.enrollment),
    participation:Number(s.participation),
    coverage:Number(s.coverage),
    dispensers:Math.round(s.dispensers),
    start_date:s.startDate || null,
    school_days:Math.round(s.days || 180)
  };
}

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
    const controller = new AbortController();
    const timeoutId = setTimeout(()=>controller.abort(), 3500);
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/schools?select=*&order=id.asc`,
      {
        headers:{
          "apikey": SUPABASE_PUBLISHABLE_KEY,
          "Authorization": `Bearer ${SUPABASE_PUBLISHABLE_KEY}`
        },
        signal: controller.signal
      }
    );
    clearTimeout(timeoutId);

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

document.querySelectorAll(".tab[data-view]").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll(".tab[data-view]").forEach(b=>b.classList.remove("active"));
    document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
    btn.classList.add("active");
    const target=document.getElementById(btn.dataset.view);
    if(target) target.classList.add("active");
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
document.getElementById("addImplemented").addEventListener("click",async()=>{
  if(!isAdmin()){ alert("Admin login required."); return; }
  const s=getScenarioFromForm(); if(!s)return;
  try{
    await officialWrite("POST",scenarioToDatabase(s));
    await loadOfficialSchools();
    alert(`${s.name} was added to the official tracker.`);
  }catch(err){ alert("Could not add official school: "+err.message); }
});

function persist(){
  localStorage.setItem("smartServePotential_v3",JSON.stringify(potentialScenarios));
}

function removePotential(i){potentialScenarios.splice(i,1);persist();renderAll();}
async function removeImplemented(i){
  if(!isAdmin()){ alert("Admin login required."); return; }
  const school=implementedScenarios[i];
  if(!school){ alert("Could not find that official school."); return; }

  try{
    await officialWrite("DELETE",null,school.id);
    await loadOfficialSchools();
    alert("School removed from the official tracker.");
  }catch(err){
    alert("Could not remove school: "+err.message);
  }
}
async function promotePotential(i){
  if(!isAdmin()){ alert("Admin login required to make a school official."); return; }
  const s=potentialScenarios[i];
  try{
    await officialWrite("POST",scenarioToDatabase(s));
    potentialScenarios.splice(i,1);
    persist();
    await loadOfficialSchools();
    renderPotential();
    alert(`${s.name} is now on the official tracker.`);
  }catch(err){ alert("Could not make school official: "+err.message); }
}
function toggleEditor(i){
  const editor=document.getElementById("edit-"+i);
  if(!editor){
    alert("Could not open the editor.");
    return;
  }
  editor.style.display = editor.style.display === "none" ? "block" : "none";
}
async function saveImplementedEdit(i){
  if(!isAdmin()){ alert("Admin login required."); return; }
  const s=implementedScenarios[i];
  const prefix=`edit-${i}-`;
  const updated={
    name:document.getElementById(prefix+"name").value.trim(),
    enrollment:parseFloat(document.getElementById(prefix+"enrollment").value)||0,
    level:document.getElementById(prefix+"level").value,
    participation:parseFloat(document.getElementById(prefix+"participation").value)||0,
    dispensers:parseFloat(document.getElementById(prefix+"dispensers").value)||0,
    days:parseFloat(document.getElementById(prefix+"days").value)||180,
    startDate:document.getElementById(prefix+"startDate").value||"",
    coverage:parseFloat(document.getElementById(prefix+"coverage").value)||0
  };
  try{
    await officialWrite("PATCH",scenarioToDatabase(updated),s.id);
    await loadOfficialSchools();
    alert("Official school changes saved.");
  }catch(err){ alert("Could not save changes: "+err.message); }
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
  animateNumber(document.getElementById("kgYearEstimate"),kgYear,1," kg");

  const homeList=document.getElementById("homeImplementedList");
  if(homeList){
    homeList.innerHTML="";
    implementedScenarios.forEach(s=>{
      const el=document.createElement("div");
      el.className="schoolCard";
      el.innerHTML=`
        <div class="schoolIdentity">
          <div class="schoolLogo">${initials(s.name)}</div>
          <div>
            <div class="schoolName">${s.name}</div>
            <div class="schoolMeta">${fmt(s.enrollment)} students · ${fmt(s.daily)} wrappers/day avoided · ${Math.round(s.coverage)}% coverage · ${fmt(s.dispensers)} dispensers · ${s.startDate ? "tracking from "+s.startDate : "tracking not started"}</div>
          </div>
        </div>
        <span class="status live">IMPLEMENTED</span>`;
      homeList.appendChild(el);
    });
  }

}

function renderImplemented(){
  const grid=document.getElementById("implementedGrid");
  grid.innerHTML="";
  if(!implementedScenarios.length){
    grid.innerHTML=`<div class="card"><div class="muted">No official implemented schools are currently in the database.</div></div>`;
    return;
  }
  implementedScenarios.forEach((s,i)=>{
    const wrap=document.createElement("div");
    wrap.className="card";
    const adminControls=isAdmin()?`
      <div class="scenarioActions">
        <span class="status live">DATABASE SYNCED</span>
        <button type="button" class="btn small secondary" data-action="edit-official" data-index="${i}">Edit</button>
        <button type="button" class="btn small danger" data-action="delete-official" data-index="${i}">Delete</button>
      </div>`:
      `<div class="scenarioActions"><span class="status live">DATABASE SYNCED</span></div>`;

    wrap.innerHTML=`
      <div class="scenarioCard" style="border:0;background:transparent;padding:0">
        <div class="schoolIdentity">
          <div class="schoolLogo">${initials(s.name)}</div>
          <div>
            <div class="schoolName">${s.name}</div>
            <div class="schoolMeta">${fmt(s.enrollment)} students · ${fmt(s.daily)} wrappers/day avoided · ${kgFromWrappers(s.annual).toFixed(1)} kg/year · ${Math.round(s.coverage)}% coverage · ${s.startDate ? "tracking from "+s.startDate : "tracking not started"}</div>
          </div>
        </div>
        ${adminControls}
      </div>
      ${isAdmin()?`
      <div id="edit-${i}" style="display:none;margin-top:16px">
        <div class="formGrid">
          <div><label>School name</label><input id="edit-${i}-name" value="${s.name}"></div>
          <div><label>Enrollment</label><input id="edit-${i}-enrollment" type="number" value="${s.enrollment}"></div>
          <div><label>School level</label><select id="edit-${i}-level"><option value="high" ${s.level==="high"?"selected":""}>High</option><option value="middle" ${s.level==="middle"?"selected":""}>Middle</option><option value="elementary" ${s.level==="elementary"?"selected":""}>Elementary</option></select></div>
          <div><label>Cafeteria participation %</label><input id="edit-${i}-participation" type="number" step="0.1" value="${s.participation}"></div>
          <div><label>Dispensers</label><input id="edit-${i}-dispensers" type="number" value="${s.dispensers}"></div>
          <div><label>School days/year</label><input id="edit-${i}-days" type="number" value="${s.days}"></div>
          <div><label>Tracking start date</label><input id="edit-${i}-startDate" type="date" value="${s.startDate||""}"></div>
          <div><label>Coverage %</label><input id="edit-${i}-coverage" type="number" min="0" max="100" value="${s.coverage}"></div>
        </div>
        <div class="actions"><button class="btn" data-action="save-official" data-index="${i}">Save Official Changes</button></div>
      </div>`:""}
    `;
    grid.appendChild(wrap);

    const editBtn=wrap.querySelector('[data-action="edit-official"]');
    const deleteBtn=wrap.querySelector('[data-action="delete-official"]');
    const saveBtn=wrap.querySelector('[data-action="save-official"]');

    if(editBtn){
      editBtn.addEventListener("click",(e)=>{
        e.preventDefault();
        e.stopPropagation();
        toggleEditor(i);
      });
    }
    if(deleteBtn){
      let deleteArmed=false;
      let deleteTimer=null;

      const cancelDelete=()=>{
        if(!deleteArmed) return;
        deleteArmed=false;
        clearTimeout(deleteTimer);
        deleteBtn.textContent="Delete";
        deleteBtn.removeAttribute("aria-label");
      };

      deleteBtn.addEventListener("click",(e)=>{
        e.preventDefault();
        e.stopPropagation();

        if(!deleteArmed){
          deleteArmed=true;
          deleteBtn.textContent="Confirm Delete";
          deleteBtn.setAttribute("aria-label","Click again to confirm deletion");

          deleteTimer=setTimeout(cancelDelete,5000);

          // Clicking anywhere else cancels the pending deletion.
          setTimeout(()=>{
            document.addEventListener("click",cancelDelete,{once:true});
          },0);
          return;
        }

        clearTimeout(deleteTimer);
        deleteArmed=false;
        deleteBtn.disabled=true;
        deleteBtn.textContent="Deleting…";

        removeImplemented(i).finally(()=>{
          if(document.body.contains(deleteBtn)){
            deleteBtn.disabled=false;
            deleteBtn.textContent="Delete";
            deleteBtn.removeAttribute("aria-label");
          }
        });
      });
    }
    if(saveBtn){
      saveBtn.addEventListener("click",(e)=>{
        e.preventDefault();
        e.stopPropagation();
        saveImplementedEdit(i);
      });
    }
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
      <div class="scenarioActions"><span class="status potential">POTENTIAL</span>${isAdmin()?`<button class="btn small potentialBtn" onclick="promotePotential(${i})">Make Official</button>`:""}<button class="btn small danger" onclick="removePotential(${i})">Delete</button></div>`;
    grid.appendChild(row);
  });
  document.getElementById("potentialCount").textContent=potentialScenarios.length;
  document.getElementById("potentialDaily").textContent=fmt(daily);
  document.getElementById("potentialMonthly").textContent=fmt(annual/10);
  document.getElementById("potentialAnnual").textContent=fmt(annual);
  document.getElementById("potentialKgYear").textContent=kgFromWrappers(annual).toFixed(1)+" kg";
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

function renderAll(){renderHome();renderImplemented();renderPotential();updateAdminUI();}


const loginDropdown=document.getElementById("loginDropdown");

document.getElementById("loginNavBtn").addEventListener("click",e=>{
  e.preventDefault();
  e.stopPropagation();
  const opening=!loginDropdown.classList.contains("open");
  loginDropdown.classList.toggle("open",opening);
  loginDropdown.setAttribute("aria-hidden",opening?"false":"true");
  if(opening){
    const status=document.getElementById("loginStatus");
    if(status){status.textContent="";status.className="loginStatus";}
  }
});

loginDropdown.addEventListener("click",e=>e.stopPropagation());
document.addEventListener("click",()=>{
  loginDropdown.classList.remove("open");
  loginDropdown.setAttribute("aria-hidden","true");
});
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"){
    loginDropdown.classList.remove("open");
    loginDropdown.setAttribute("aria-hidden","true");
  }
});
document.getElementById("adminLoginModal").addEventListener("click",async()=>{
  const ok=await adminLogin();
  updateAdminUI();
  if(ok){
    setTimeout(()=>{
      loginDropdown.classList.remove("open");
      loginDropdown.setAttribute("aria-hidden","true");
    },650);
  }
});
document.getElementById("adminPasswordModal").addEventListener("keydown",async e=>{
  if(e.key==="Enter"){
    const ok=await adminLogin();
    updateAdminUI();
    if(ok){
      setTimeout(()=>{
        loginDropdown.classList.remove("open");
        loginDropdown.setAttribute("aria-hidden","true");
      },650);
    }
  }
});
document.getElementById("adminLogoutModal").addEventListener("click",()=>{
  adminLogout();
  updateAdminUI();
});

renderAll();
loadOfficialSchools();

