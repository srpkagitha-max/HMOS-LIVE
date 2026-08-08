import {
  loginSuperAdmin, logoutCurrentUser, watchAuth, listInstitutes, createInstitute, loginInstitute, changeInstitutePassword, validateInstituteSession,
  generateInstituteCode, generateTemporaryPassword, updateInstitute, setInstituteStatus,
  archiveInstitute, restoreInstitute, resetInstitutePassword, renewSubscription, createStudentAdmission, submitPendingAdmission, listPendingAdmissions, approvePendingAdmission, rejectPendingAdmission, generateStudentId, loginStudent, changeStudentPassword, validateStudentSession, listInstituteStudents, updateStudentProfile, setStudentAccountStatus, listInstituteRooms, createRoom, allotStudentBed, vacateStudentBed, setBedDisplayStatus, resetStudentPassword, archiveStudentProfile,
  listInstituteFees, saveStudentFeePlan, recordStudentFeePayment, listStudentPayments,
  saveDailyMenu, getDailyMenu, submitMealAttendance, getStudentMealAttendance, listInstituteMealAttendance,
  submitMovementRequest, markStudentEntry, listInstituteMovements, getStudentMovements,
  submitComplaint, listStudentComplaints, listInstituteComplaints, updateComplaintStatus,
  submitStudentFeePaymentRequest, getInstituteBranding, saveInstituteBranding, saveAdmissionFeeSettings,
  createApprovalRequest, listApprovalRequests, decideApprovalRequest, createNotification, listNotifications, markNotificationRead, createAuditLog, listAuditLogs, softDeleteRecord, listRecycleBin, restoreDeletedRecord, createBackupSnapshot, listBackupSnapshots, exportInstituteBackup, restoreInstituteBackup, findDuplicateAdmissions,
  loginInstituteAdmin, changeInstituteAdminCredentials, checkAdmissionStatus, getSystemHealth, getInstituteLiveMetrics, reconcileResidentBedAssignments
} from "./firebase-service.js?v=4.5.18";

const app = document.querySelector("#app");
const HMOS_VERSION = "4.5.18";
window.__HMOS_VERSION__ = HMOS_VERSION;

const activeOperations = new Set();
async function runOperationOnce(key, task) {
  if (activeOperations.has(key)) {
    const error = new Error("This action is already in progress.");
    error.code = "operation-in-progress";
    throw error;
  }
  activeOperations.add(key);
  try { return await task(); } finally { activeOperations.delete(key); }
}

function humanError(error, fallback = "Something went wrong. Please try again.") {
  const code = error?.code || "";
  const messages = {
    "unavailable": "Network is temporarily unavailable. Please retry.",
    "deadline-exceeded": "The request took too long. Please retry.",
    "permission-denied": "Access was blocked by Firestore Rules.",
    "resource-exhausted": "The service is busy. Please wait and retry.",
    "operation-in-progress": "This action is already being processed."
  };
  return messages[code] || error?.message || fallback;
}

function showConnectionBanner(message, type = "info") {
  let banner = document.querySelector("#hmos-connection-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "hmos-connection-banner";
    banner.className = "hmos-connection-banner";
    document.body.appendChild(banner);
  }
  banner.textContent = message;
  banner.dataset.type = type;
  banner.hidden = false;
}
function hideConnectionBanner() {
  const banner = document.querySelector("#hmos-connection-banner");
  if (banner) banner.hidden = true;
}
window.addEventListener("offline", () => showConnectionBanner("You are offline. Saved data will sync after internet returns.", "warning"));
window.addEventListener("online", () => { showConnectionBanner("Internet restored.", "success"); setTimeout(hideConnectionBanner, 2200); });
if (window.__HMOS_BOOT_TIMER__) clearTimeout(window.__HMOS_BOOT_TIMER__);
const SUPER_ADMIN_EMAIL = "hmos.superadmin@gmail.com";
const CACHE_KEY = "hmosInstitutesCacheV400";
const state = {
  screen: "institute", authUser: null, institutes: [], instituteSession: null, instituteCurrentPassword: "",
  lastCredentials: null, selectedId: null, search: "", filter: "all", notice: null, latestAdmission: null, studentSession: null, studentCurrentPassword: "", adminStudents: [], adminStudentSearch: "", selectedStudentId: null, rooms: [], selectedRoomId: null, selectedFloor: "", selectedBedNumber: "", fees: [], selectedFeeStudentId: null, feePayments: [], pendingAdmissions: [], selectedAdmissionBed: null, dailyMenu: null, mealAttendance: [], movements: [], complaints: [], selectedComplaintId: null, branding: null, approvals: [], notifications: [], auditLogs: [], recycleBin: [], backups: [], adminAuthenticated: false, admissionStatusResult: null, manualAdmissionMode: false
};

const normalizeCodeLocal=value=>String(value||"").trim().toUpperCase().replace(/[^A-Z0-9]/g,"");
const esc = (v="") => String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const readCache = () => { try { return JSON.parse(localStorage.getItem(CACHE_KEY)||"[]"); } catch { return []; } };
const writeCache = items => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(items)); } catch {} };
const dateOf = value => value?.toDate?.() || (value ? new Date(value) : null);
const formatDate = value => { const d=dateOf(value); return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("en-IN") : "—"; };
const formatDateTime = value => { const d=dateOf(value); return d && !Number.isNaN(d.getTime()) ? d.toLocaleString("en-IN", {day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:true}) : "—"; };
const isExpired = item => { const d=dateOf(item.subscriptionEnd); return Boolean(d && d < new Date()); };
const effectiveStatus = item => item.isArchived ? "archived" : isExpired(item) ? "expired" : (item.status || "active");
const INSTITUTE_SESSION_KEY = "hmosInstituteSessionV400";
const REMEMBERED_INSTITUTE_CODE_KEY = "hmosRememberedInstituteCodeV400";
function saveInstituteSession(session, remember=false){
  const safe = { instituteId:session.instituteId, instituteCode:session.instituteCode, instituteName:session.instituteName, hostelType:session.hostelType||"hostel", ownerPhone:session.ownerPhone||"", ownerEmail:session.ownerEmail||"", city:session.city||"", address:session.address||"", payeeName:session.payeeName||"", upiId:session.upiId||"", paymentContact:session.paymentContact||"", paymentQrDataUrl:session.paymentQrDataUrl||"", defaultTotalFees:Number(session.defaultTotalFees||0), shareInstituteId:session.shareInstituteId||"", shareInstitutePassword:session.shareInstitutePassword||"", status:session.status||"active", subscriptionStatus:session.subscriptionStatus||"active", subscriptionEnd:session.subscriptionEnd||null, mustChangePassword:Boolean(session.mustChangePassword), upiId:session.upiId||"", defaultTotalFees:Number(session.defaultTotalFees||0), branding:session.branding||null, shareInstituteId:session.shareInstituteId||"", shareInstitutePassword:session.shareInstitutePassword||"" };
  try { (remember?localStorage:sessionStorage).setItem(INSTITUTE_SESSION_KEY, JSON.stringify(safe)); if(remember) sessionStorage.removeItem(INSTITUTE_SESSION_KEY); else localStorage.removeItem(INSTITUTE_SESSION_KEY); } catch {}
}
function restoreInstituteSession(){
  try { return JSON.parse(sessionStorage.getItem(INSTITUTE_SESSION_KEY)||localStorage.getItem(INSTITUTE_SESSION_KEY)||"null"); } catch { return null; }
}
function clearInstituteSession(){ try{localStorage.removeItem(INSTITUTE_SESSION_KEY);sessionStorage.removeItem(INSTITUTE_SESSION_KEY);}catch{} }


function brand(){
  const b=state.branding;
  if(b&&state.instituteSession){
    const logo=b.logoUrl?`<img class="institute-brand-logo" src="${esc(b.logoUrl)}" alt="${esc(b.instituteName||state.instituteSession.instituteName)} logo">`:`<div class="institute-brand-letter">${esc((b.instituteName||state.instituteSession.instituteName||"I")[0].toUpperCase())}</div>`;
    return `<div class="brand institute-brand" style="--brand-primary:${esc(b.primaryColor||'#0b4f8a')};--brand-secondary:${esc(b.secondaryColor||'#16866b')}">${logo}<div><p class="eyebrow">${esc(b.shortName||'INSTITUTE')}</p><h1>${esc(b.instituteName||state.instituteSession.instituteName)}</h1><p class="tagline">${esc(b.welcomeMessage||state.instituteSession.address||'Powered by HMOS')}</p></div></div>`;
  }
  return `<div class="brand"><div class="brand-mark"><span class="roof"></span><span class="door"></span><span class="shield">✓</span></div><div><p class="eyebrow">HMOS</p><h1>Hostel Management<br class="mobile-break"/> Operating System</h1><p class="tagline">Smart Multi-Institute Hostel Management Platform</p></div></div>`;
}
function shell(content,compact=false){const style=state.branding&&state.instituteSession?` style="--brand-primary:${esc(state.branding.primaryColor||'#0b4f8a')};--brand-secondary:${esc(state.branding.secondaryColor||'#16866b')}"`:'';return `<main class="shell ${compact?"shell-compact":""}"${style}><section class="hero">${brand()}<div class="trust-row"><span>Secure access</span><span>Multi-institute</span><span>Mobile ready</span></div></section>${content}<footer>Powered by <strong>Hostel Management Operating System</strong></footer></main>`;}
function field(id,label,type="text",placeholder="",value="",extra=""){return `<label class="field" for="${id}"><span>${label}</span><input id="${id}" type="${type}" placeholder="${placeholder}" value="${esc(value)}" ${extra}/></label>`;}
function notify(message,type="success-message"){state.notice={message,type};}
function consumeNotice(){const n=state.notice; state.notice=null; return n;}

function renderInstituteLogin(message="") {
  const rememberedCode = (() => { try { return localStorage.getItem(REMEMBERED_INSTITUTE_CODE_KEY) || ""; } catch { return ""; } })();
  app.innerHTML = shell(`<section class="card login-card"><div class="card-heading"><span class="step">Institute access</span><h2>Institute Login</h2><p>Enter credentials issued by HMOS.</p></div><form id="institute-form">${field("institute-id","Institute Code / ID","text","Example: ABCO1234",rememberedCode,"autocomplete='username' autocapitalize='characters'")}<label class="field password-field" for="institute-password"><span>Institute Password</span><div class="password-input-wrap"><input id="institute-password" type="password" placeholder="Enter password" autocomplete="current-password" required/><button id="toggle-institute-password" class="password-toggle" type="button" aria-label="Show password">Show</button></div></label><label class="check"><input type="checkbox" id="remember-institute" ${rememberedCode?"checked":""}/><span>Remember this institute on this device</span></label><p id="form-message" class="form-message ${message?"show error":""}">${esc(message)}</p><button id="institute-submit" class="primary">Continue <span>→</span></button></form><button id="super-admin-link" class="text-link">Super Admin Login</button></section>`);
  document.querySelector("#super-admin-link").onclick=()=>{state.screen="super-admin";render();};
  const passwordInput=document.querySelector("#institute-password");
  document.querySelector("#toggle-institute-password").onclick=e=>{const show=passwordInput.type==="password";passwordInput.type=show?"text":"password";e.currentTarget.textContent=show?"Hide":"Show";};
  document.querySelector("#institute-form").onsubmit=async e=>{
    e.preventDefault();
    const b=document.querySelector("#institute-submit"),m=document.querySelector("#form-message"),code=document.querySelector("#institute-id").value,password=passwordInput.value,remember=document.querySelector("#remember-institute").checked;
    b.disabled=true;b.textContent="Checking…";m.className="form-message";
    try{
      state.instituteSession=await loginInstitute(code,password);
      state.branding=await getInstituteBranding(state.instituteSession.instituteCode).catch(()=>null);
      state.instituteCurrentPassword=password;
      try { remember ? localStorage.setItem(REMEMBERED_INSTITUTE_CODE_KEY,state.instituteSession.instituteCode) : localStorage.removeItem(REMEMBERED_INSTITUTE_CODE_KEY); } catch {}
      if(state.instituteSession.mustChangePassword){state.screen="institute-password-change";}else{saveInstituteSession(state.instituteSession,remember);state.screen="institute-portal";}
      render();
    }catch(err){
      m.textContent={"invalid-institute-credential":"Incorrect institute code or password.","institute-inactive":"This institute account is inactive.","subscription-expired":"Subscription expired. Contact HMOS support.","missing-credentials":"Enter institute code and password.","institute-login-timeout":"Network is slow. Check internet and try again."}[err.code]||`Institute login failed. ${err.code||""}`;
      m.className="form-message show error";b.disabled=false;b.innerHTML="Continue <span>→</span>";
    }
  };
}
function renderInstitutePasswordChange(){
  const i=state.instituteSession;if(!i){state.screen="institute";return render();}
  app.innerHTML=shell(`<section class="card login-card"><span class="step">First login security</span><h2>Create New Password</h2><p class="blocked-copy">For <strong>${esc(i.instituteName||i.instituteCode)}</strong>. Temporary password must be changed before continuing.</p><form id="change-institute-password">${field("new-institute-password","New Password","password","Minimum 10 characters","","autocomplete='new-password'")}${field("confirm-institute-password","Confirm New Password","password","Re-enter new password","","autocomplete='new-password'")}<div class="password-rules"><span>✓ Uppercase</span><span>✓ Lowercase</span><span>✓ Number</span><span>✓ Special character</span></div><p id="form-message" class="form-message"></p><button id="change-password-submit" class="primary">Save & Continue <span>→</span></button></form><button id="cancel-institute-login" class="text-link">Cancel Institute Login</button></section>`,true);
  document.querySelector("#cancel-institute-login").onclick=()=>{state.instituteSession=null;state.instituteCurrentPassword="";state.screen="institute";render();};
  document.querySelector("#change-institute-password").onsubmit=async e=>{e.preventDefault();const n=document.querySelector("#new-institute-password").value,c=document.querySelector("#confirm-institute-password").value,m=document.querySelector("#form-message"),b=document.querySelector("#change-password-submit");if(n!==c){m.textContent="Passwords do not match.";m.className="form-message show error";return;}if(!state.instituteCurrentPassword){m.textContent="Temporary login session was lost. Return to Institute Login and sign in again.";m.className="form-message show error";return;}b.disabled=true;b.textContent="Saving…";try{state.instituteSession=await changeInstitutePassword(i.instituteCode,state.instituteCurrentPassword,n);state.instituteCurrentPassword="";saveInstituteSession(state.instituteSession,true);state.screen="institute-portal";render();}catch(err){const messages={"weak-institute-password":"Use at least 10 characters with uppercase, lowercase, number and special character.","invalid-institute-credential":"Temporary password no longer matches. Return to Institute Login and use the latest password.","permission-denied":"Password update is blocked by Firestore Rules. Publish the V2.7.2 rules.","password-change-timeout":"Network is slow. Password was not confirmed; try again.","missing-credentials":"Temporary login session was lost. Login again."};m.textContent=messages[err.code]||`Could not change password. Error: ${err.code||"unknown"}`;m.className="form-message show error";b.disabled=false;b.innerHTML="Save & Continue <span>→</span>";}};
}
function renderSuperAdmin(message=""){
  app.innerHTML=shell(`<section class="card login-card"><button id="back" class="back">← Institute Login</button><div class="card-heading"><span class="step">Restricted access</span><h2>Super Admin Login</h2><p>Only the authorized HMOS administrator can continue.</p></div><form id="admin-form">${field("admin-email","Email Address","email","Registered email","","autocomplete='username'")}${field("admin-password","Password","password","Enter password","","autocomplete='current-password'")}<p id="form-message" class="form-message ${message?"show error":""}">${esc(message)}</p><button id="admin-submit" class="primary">Secure Login <span>→</span></button></form></section>`,true);
  document.querySelector("#back").onclick=()=>{state.screen="institute";render();};
  document.querySelector("#admin-form").onsubmit=async e=>{e.preventDefault();const b=document.querySelector("#admin-submit"),m=document.querySelector("#form-message");b.disabled=true;b.textContent="Signing in…";try{await loginSuperAdmin(document.querySelector("#admin-email").value.trim(),document.querySelector("#admin-password").value);}catch(err){m.textContent=(err.code==="auth/invalid-credential"?"Incorrect email or password.":"Login failed.")+` Error: ${err.code||"unknown"}`;m.className="form-message show error";b.disabled=false;b.innerHTML="Secure Login <span>→</span>";}};
}
function renderInstitutePortal(){
  const i=state.instituteSession;
  if(!i){state.screen="institute";return render();}
  app.innerHTML=shell(`<section class="card portal-card wide-card gateway-card">
    <div class="portal-head gateway-head"><div class="portal-logo">${esc((i.instituteName||"H").slice(0,1).toUpperCase())}</div><div><span class="step success-step">Institute Portal</span><h2>${esc(i.instituteName||"Institute Portal")}</h2><p>${esc(i.city||i.address||"HMOS verified institute")} · Code: <strong>${esc(i.instituteCode||"")}</strong></p></div><button id="institute-logout" class="secondary compact-button">Logout</button></div>
    <div class="gateway-actions">
      <button id="gateway-admission" class="gateway-action"><span class="gateway-letter">A</span><div><strong>Admission Form</strong><small>New admission application</small></div><b>›</b></button>
      <button id="gateway-resident" class="gateway-action"><span class="gateway-letter">R</span><div><strong>Resident Login</strong><small>ID and password access</small></div><b>›</b></button>
      <button id="gateway-admin" class="gateway-action"><span class="gateway-letter">D</span><div><strong>Admin Login</strong><small>Institute operations dashboard</small></div><b>›</b></button>
    </div>
    
    <div class="portal-status gateway-status"><span class="pill active-pill">${esc(i.status||"active")}</span><span>Subscription: <strong>${formatDate(i.subscriptionEnd)}</strong></span><button id="refresh-institute-session" class="text-link compact-link" type="button">Refresh</button></div>
  </section>`,true);
  document.querySelector("#institute-logout").onclick=()=>{clearInstituteSession();state.instituteSession=null;state.adminAuthenticated=false;try{sessionStorage.removeItem(ADMIN_SESSION_KEY);sessionStorage.removeItem(SHARE_PASSWORD_KEY);}catch{}state.screen="institute";render();};
  document.querySelector("#gateway-admission").onclick=()=>{state.screen="new-admission";render();};
  document.querySelector("#gateway-resident").onclick=()=>{state.screen="student-login";render();};
  document.querySelector("#gateway-admin").onclick=()=>{state.screen=state.adminAuthenticated?"admin-home":"institute-admin-login";render();};
  document.querySelector("#refresh-institute-session").onclick=async e=>{const b=e.currentTarget;b.disabled=true;b.textContent="Checking…";try{state.instituteSession=await validateInstituteSession(i.instituteCode);saveInstituteSession(state.instituteSession,true);b.textContent="Active";}catch(err){clearInstituteSession();state.instituteSession=null;state.screen="institute";return renderInstituteLogin("Institute access expired. Please login again.");}finally{if(document.body.contains(b))b.disabled=false;}};
}


function admissionStatusSection(){
  return `<section class="admission-status-check form-wide"><div><span class="step">Admission tracking</span><h3>Check Admission Approval</h3><p>Enter the phone number used in the admission form.</p></div><form id="admission-status-form"><input id="admission-status-phone" type="tel" inputmode="numeric" maxlength="10" placeholder="10-digit phone number" required/><button class="primary" type="submit">Check Status</button></form><div id="admission-status-result"></div></section>`;
}
function bindAdmissionStatusForm(){
  const form=document.querySelector("#admission-status-form");
  if(!form)return;
  form.onsubmit=async e=>{
    e.preventDefault();
    const i=state.instituteSession;
    const phone=document.querySelector("#admission-status-phone").value.replace(/\D/g,"");
    const out=document.querySelector("#admission-status-result");
    if(!/^\d{10}$/.test(phone)){out.innerHTML='<p class="form-message show error">Enter a valid 10-digit phone number.</p>';return;}
    out.innerHTML='<div class="loading-card compact-loading"><div class="loader"></div><p>Checking admission status…</p></div>';
    try{
      const result=await checkAdmissionStatus(i.instituteCode,phone);
      state.admissionStatusResult=result;
      if(!result){out.innerHTML='<div class="status-result pending"><strong>No application found</strong><p>Check the phone number and try again.</p></div>';return;}
      if(result.status==="approved"){
        out.innerHTML=`<div class="status-result approved"><span class="pill active-pill">Approved</span><h3>Admission Successful</h3><p>${esc(result.studentName||"")}</p><div class="credential-modal-grid"><article><span>Student ID</span><code>${esc(result.studentId||"")}</code></article><article><span>Temporary Password</span><code>${esc(result.temporaryPassword||"Contact Admin")}</code></article></div><p>Please use the Student ID and Password above to login through Resident Login.</p><div class="status-actions"><button id="status-admission-pdf" class="secondary" type="button">Download Admission PDF</button><button id="status-payment-receipt" class="primary" type="button">Download Pay Receipt</button></div></div>`;
        document.querySelector("#status-admission-pdf").onclick=()=>printAdmissionStatusDocument(result,"admission");
        document.querySelector("#status-payment-receipt").onclick=()=>printAdmissionStatusDocument(result,"receipt");
      }else if(result.status==="rejected"){
        out.innerHTML=`<div class="status-result rejected"><span class="pill inactive-pill">Rejected</span><h3>Admission Not Approved</h3><p>${esc(result.rejectionReason||"Please contact the institute admin.")}</p></div>`;
      }else{
        out.innerHTML=`<div class="status-result pending"><span class="pill expired-pill">Pending</span><h3>Admin Approval Pending</h3><p>Your admission and payment are under verification.</p><small>Application ID: ${esc(result.applicationId||"")}</small></div>`;
      }
    }catch(err){out.innerHTML=`<p class="form-message show error">Could not check status. ${esc(err.code||"")}</p>`;}
  };
}

function premiumDocumentInstitute(result={}){
  return state.instituteSession||{
    instituteName:result.instituteName||"Institute",
    instituteCode:result.instituteCode||"",
    ownerPhone:result.ownerPhone||"",
    ownerEmail:result.ownerEmail||"",
    address:result.address||""
  };
}

function openPremiumDocumentWindow({title,eyebrow="HMOS DOCUMENT",subtitle="",content="",result={},autoPrint=true,compact=false}){
  const i=premiumDocumentInstitute(result);
  const safe=x=>esc(x==null?"":String(x));
  const generated=new Date().toLocaleString("en-IN");
  const instituteName=i.instituteName||result.instituteName||"Institute";
  const instituteCode=i.instituteCode||result.instituteCode||"";
  const contact=[i.ownerPhone||result.ownerPhone||"",i.ownerEmail||result.ownerEmail||""].filter(Boolean).join(" · ");
  const address=i.address||result.address||"";
  const initial=(instituteName||"I").trim().charAt(0).toUpperCase();
  const w=window.open("","_blank"); if(!w) return null;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safe(instituteName)} - ${safe(title)}</title><style>
    *{box-sizing:border-box} @page{size:A4;margin:12mm}
    body{margin:0;background:#edf3f8;color:#102b49;font-family:Inter,system-ui,-apple-system,"Segoe UI",Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .sheet{width:min(860px,calc(100% - 28px));margin:22px auto;background:#fff;border:1px solid #dce6ee;border-radius:24px;overflow:hidden;box-shadow:0 18px 50px rgba(20,48,75,.12)}
    .brand{background:linear-gradient(135deg,#123f67,#2f6a4c);color:#fff;padding:30px 34px 26px;display:flex;align-items:center;gap:18px}
    .mark{width:66px;height:66px;border-radius:18px;background:#fff;color:#2f6a4c;display:grid;place-items:center;font-size:34px;font-weight:900;flex:0 0 auto}
    .brand h1{font-size:30px;line-height:1.05;margin:0 0 7px;font-weight:900;letter-spacing:-.02em}.brand p{margin:3px 0;font-size:12px;opacity:.9;overflow-wrap:anywhere}
    .dochead{padding:28px 34px 18px;border-bottom:1px solid #e4ebf1}.eyebrow{font-size:11px;letter-spacing:.16em;text-transform:uppercase;font-weight:900;color:#2f6a4c}.dochead h2{margin:8px 0 6px;font-size:30px;letter-spacing:-.02em}.dochead p{margin:0;color:#68798a;font-size:13px}
    .content{padding:24px 34px 30px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}
    .field{border:1px solid #dce6ee;border-radius:16px;padding:15px 16px;background:#f8fbfd;min-height:76px}.field span{display:block;font-size:10px;letter-spacing:.09em;text-transform:uppercase;font-weight:900;color:#718293;margin-bottom:6px}.field strong{display:block;font-size:17px;color:#112d4b;overflow-wrap:anywhere}.field small{display:block;margin-top:4px;color:#6c7b89}
    .highlight{border:1px solid #b8decf;background:#f1faf6;border-radius:18px;padding:18px 20px;margin-bottom:16px}.highlight span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.12em;font-weight:900;color:#2f6a4c}.highlight strong{display:block;font-size:24px;margin-top:5px;color:#173f31;overflow-wrap:anywhere}
    .section-title{font-size:16px;margin:22px 0 10px;color:#17324d}.note{padding:14px 16px;border-radius:14px;background:#f7f9fb;border:1px solid #e1e8ee;color:#596b7b;font-size:12px;line-height:1.55}
    table{width:100%;border-collapse:separate;border-spacing:0;border:1px solid #dce6ee;border-radius:14px;overflow:hidden;font-size:12px}th{background:#edf4f8;text-align:left;color:#38546d;padding:10px}td{padding:10px;border-top:1px solid #e8eef3;vertical-align:top}
    .footer{display:flex;justify-content:space-between;gap:14px;padding:16px 34px 22px;border-top:1px solid #e3eaf0;color:#71808d;font-size:10px}.actions{display:flex;justify-content:flex-end;padding:0 34px 22px}.actions button{border:0;border-radius:12px;padding:11px 16px;background:#0b5795;color:#fff;font-weight:800}
    ${compact?'.sheet{max-width:620px}.content{padding-top:20px}':''}
    @media(max-width:640px){.sheet{width:100%;margin:0;border-radius:0}.brand,.dochead,.content,.footer,.actions{padding-left:18px;padding-right:18px}.brand h1{font-size:25px}.dochead h2{font-size:25px}.grid,.grid.three{grid-template-columns:1fr}}
    @media print{body{background:#fff}.sheet{width:100%;margin:0;border:0;border-radius:0;box-shadow:none}.actions{display:none}.brand{break-inside:avoid}.field,.highlight{break-inside:avoid}.footer{position:relative}}
  </style></head><body><main class="sheet"><header class="brand"><div class="mark">${safe(initial)}</div><div><h1>${safe(instituteName)}</h1>${instituteCode?`<p>Institute Code: ${safe(instituteCode)}</p>`:""}${address?`<p>${safe(address)}</p>`:""}${contact?`<p>${safe(contact)}</p>`:""}</div></header><section class="dochead"><div class="eyebrow">${safe(eyebrow)}</div><h2>${safe(title)}</h2>${subtitle?`<p>${safe(subtitle)}</p>`:""}</section><section class="content">${content}</section><div class="actions"><button onclick="window.print()">Print / Save PDF</button></div><footer class="footer"><span>Generated: ${safe(generated)}</span><span>Powered by HMOS · Hostel Management Operating System</span></footer></main>${autoPrint?'<script>window.onload=()=>setTimeout(()=>window.print(),250)<\\/script>':''}</body></html>`);
  w.document.close(); return w;
}

function printAdmissionStatusDocument(result,type="admission") {
  const title=type==="receipt"?"Payment Receipt":"Admission Confirmation";
  const content=type==="receipt"?`<div class="highlight"><span>Receipt Number</span><strong>${esc(result.receiptNo||"—")}</strong></div><div class="grid"><div class="field"><span>Student</span><strong>${esc(result.studentName||"")}</strong></div><div class="field"><span>Student ID</span><strong>${esc(result.studentId||"")}</strong></div><div class="field"><span>Amount Paid</span><strong>₹${Number(result.amountPayingNow||0).toLocaleString("en-IN")}</strong></div><div class="field"><span>Remaining Balance</span><strong>₹${Number(result.balanceAmount||0).toLocaleString("en-IN")}</strong></div><div class="field"><span>Transaction ID</span><strong>${esc(result.upiTransactionId||"—")}</strong></div><div class="field"><span>Status</span><strong>Payment verified</strong></div></div>`:`<div class="grid"><div class="field"><span>Student</span><strong>${esc(result.studentName||"")}</strong></div><div class="field"><span>Student ID</span><strong>${esc(result.studentId||"")}</strong></div><div class="field"><span>Temporary Password</span><strong>${esc(result.temporaryPassword||"Contact Admin")}</strong></div><div class="field"><span>Phone</span><strong>${esc(result.studentPhone||"—")}</strong></div><div class="field"><span>Parent / Guardian</span><strong>${esc(result.parentName||"—")}</strong></div><div class="field"><span>Room / Bed</span><strong>${esc(result.floor||"")} · Room ${esc(result.roomNumber||"—")} · Bed ${esc(result.bedNumber||"—")}</strong></div><div class="field"><span>Total Fees</span><strong>₹${Number(result.totalFees||0).toLocaleString("en-IN")}</strong></div><div class="field"><span>Paid</span><strong>₹${Number(result.amountPayingNow||0).toLocaleString("en-IN")}</strong></div><div class="field"><span>Balance</span><strong>₹${Number(result.balanceAmount||0).toLocaleString("en-IN")}</strong></div></div>`;
  openPremiumDocumentWindow({title,eyebrow:type==="receipt"?"FINANCE OPERATIONS":"ADMISSION DOCUMENT",subtitle:type==="receipt"?"Official payment acknowledgement":"Official resident admission confirmation",content,result,autoPrint:true});
}
function renderInstituteAdminLogin(message="") {
 const i=state.instituteSession;if(!i){state.screen="institute";return render();}
 app.innerHTML=shell(`<section class="card login-card"><button id="admin-gate-back" class="back">← Institute Portal</button><div class="card-heading"><span class="step">Institute administration</span><h2>Admin Login</h2><p>Use the Institute Admin ID and Password.</p></div><form id="institute-admin-login-form">${field("institute-admin-id","Admin ID","text","Enter Admin ID","admin","autocomplete='username'")}${field("institute-admin-password","Admin Password","password","Enter password","","autocomplete='current-password'")}<p id="institute-admin-login-message" class="form-message ${message?"show error":""}">${esc(message)}</p><button id="institute-admin-login-submit" class="primary">Admin Login <span>→</span></button></form></section>`,true);
 document.querySelector("#admin-gate-back").onclick=()=>{state.screen="institute-portal";render();};
 document.querySelector("#institute-admin-login-form").onsubmit=async e=>{e.preventDefault();const btn=document.querySelector("#institute-admin-login-submit"),msg=document.querySelector("#institute-admin-login-message");btn.disabled=true;btn.textContent="Checking…";try{await loginInstituteAdmin(i.instituteCode,document.querySelector("#institute-admin-id").value,document.querySelector("#institute-admin-password").value);state.adminAuthenticated=true;try{sessionStorage.setItem(ADMIN_SESSION_KEY,i.instituteCode);}catch{}state.screen="admin-home";render();}catch(err){msg.textContent="Incorrect Admin ID or Password.";msg.className="form-message show error";btn.disabled=false;btn.innerHTML="Admin Login <span>→</span>";}};
}

function renderInstituteAdminHome(){
  const i=state.instituteSession;
  if(!i){state.screen="institute";return render();}
  app.innerHTML=shell(`<section class="card portal-card wide-card compact-admin-home">
    <div class="compact-admin-top"><button id="admin-home-back" class="back" type="button">← Institute Portal</button><div><span class="step success-step">Admin Dashboard</span><h2>Institute Home</h2><p>${esc(i.instituteName)} · ${esc(i.instituteCode)}</p></div></div>
    <section class="live-ops-panel" aria-live="polite">
      <div class="live-ops-head"><div><span class="step">Live operations</span><h3>Today at a Glance</h3><p>Tap any card to open its live details.</p></div><button id="live-metrics-refresh" class="secondary compact-button" type="button">Refresh</button></div>
      <div id="live-metrics-grid" class="live-metrics-grid tappable-live-metrics">
        <button type="button" data-live-target="institute-admin"><span>Residents</span><strong>—</strong><small>Active · Tap to view</small></button>
        <button type="button" data-live-target="pending-admissions"><span>Pending Admissions</span><strong>—</strong><small>Needs review · Tap to view</small></button>
        <button type="button" data-live-target="entry-exit"><span>Outside</span><strong>—</strong><small>Not returned · Tap to view</small></button>
        <button type="button" data-live-target="room-management"><span>Vacant Beds</span><strong>—</strong><small>Ready to allot · Tap to view</small></button>
        <button type="button" data-live-target="fees-management"><span>Fee Due Today</span><strong>—</strong><small>Accounts · Tap to view</small></button>
        <button type="button" data-live-target="complaints-admin"><span>Open Complaints</span><strong>—</strong><small>Needs action · Tap to view</small></button>
      </div>
      <p id="live-metrics-note" class="live-metrics-note">Loading live data…</p>
    </section>
    <div class="admin-home-grid neat-admin-grid">
      <button id="residents-card" class="admin-home-action"><strong>Residents</strong><small>Profiles & search</small></button>
      <button id="admissions-card" class="admin-home-action"><strong>Admissions</strong><small>Forms & approvals</small></button>
      <button id="beds-card" class="admin-home-action"><strong>Beds</strong><small>Floors, rooms & beds</small></button>
      <button id="kitchen-card" class="admin-home-action"><strong>Kitchen</strong><small>Menu & attendance</small></button>
      <button id="fees-card" class="admin-home-action"><strong>Fees</strong><small>Payments & receipts</small></button>
      <button id="entry-exit-card" class="admin-home-action"><strong>Entry / Exit</strong><small>Movement status</small></button>
      <button id="complaints-admin-card" class="admin-home-action"><strong>Complaints</strong><small>Review & resolve</small></button>
      <button id="approvals-card" class="admin-home-action badge-card"><strong>Approvals <span id="approvals-badge" class="live-badge">0</span></strong><small>Admissions, payments, beds & complaints</small></button>
      <button id="notifications-card" class="admin-home-action badge-card"><strong>Notifications <span id="notifications-badge" class="live-badge">0</span></strong><small>Alerts and reminders</small></button>
      <button id="audit-card" class="admin-home-action"><strong>Audit Logs</strong><small>User action history</small></button>
      <button id="recycle-card" class="admin-home-action"><strong>Recycle Bin</strong><small>Restore deleted records</small></button>
      <button id="backup-card" class="admin-home-action"><strong>Backup & Restore</strong><small>Daily snapshot history</small></button>
      <button id="system-health-card" class="admin-home-action"><strong>System Health</strong><small>Network, Firebase and backup status</small></button>
      <button id="settings-card" class="admin-home-action"><strong>Settings</strong><small>Dashboard and admission fees</small></button>
      <button id="pdf-card" class="admin-home-action"><strong>PDF's</strong><small>Reports & lists</small></button>
    </div>
  </section>`,true);

  const go=screen=>{state.screen=screen;render();};
  document.querySelector("#admin-home-back").onclick=()=>go("institute-portal");
  document.querySelector("#residents-card").onclick=()=>go("institute-admin");
  document.querySelector("#admissions-card").onclick=()=>go("admissions-home");
  document.querySelector("#beds-card").onclick=()=>go("room-management");
  document.querySelector("#kitchen-card").onclick=()=>go("kitchen");
  document.querySelector("#fees-card").onclick=()=>go("fees-management");
  document.querySelector("#entry-exit-card").onclick=()=>go("entry-exit");
  document.querySelector("#complaints-admin-card").onclick=()=>go("complaints-admin");
  document.querySelector("#approvals-card").onclick=()=>go("approvals");
  document.querySelector("#notifications-card").onclick=()=>go("admin-notifications");
  document.querySelector("#audit-card").onclick=()=>go("audit-logs");
  document.querySelector("#recycle-card").onclick=()=>go("recycle-bin");
  document.querySelector("#backup-card").onclick=()=>go("backup-restore");
  document.querySelector("#system-health-card").onclick=()=>go("system-health");
  document.querySelector("#settings-card").onclick=()=>go("settings");
  document.querySelector("#pdf-card").onclick=()=>go("pdf-reports");
  document.querySelectorAll("[data-live-target]").forEach(card=>card.onclick=()=>go(card.dataset.liveTarget));

  const paintLiveMetrics = async () => {
    const grid=document.querySelector("#live-metrics-grid"),note=document.querySelector("#live-metrics-note"),btn=document.querySelector("#live-metrics-refresh");
    if(!grid)return;
    if(btn){btn.disabled=true;btn.textContent="Refreshing…";}
    grid.classList.add("is-loading");
    try{
      const m=await getInstituteLiveMetrics(i.instituteCode);
      const values=[m.residents,m.pendingAdmissions,m.outsideResidents,m.vacantBeds,m.feeDueToday,m.openComplaints];
      grid.querySelectorAll("button strong").forEach((el,index)=>el.textContent=String(values[index]??0));
      note.textContent=`Outstanding fees: ₹${Number(m.outstandingAmount||0).toLocaleString("en-IN")} · ${m.pendingApprovals||0} pending approvals · Updated just now`;
      note.classList.remove("metric-error");
    }catch(err){
      note.textContent=`Live summary unavailable. ${humanError(err,"Tap Refresh to try again.")}`;
      note.classList.add("metric-error");
    }finally{
      grid.classList.remove("is-loading");
      if(btn){btn.disabled=false;btn.textContent="Refresh";}
    }
  };
  document.querySelector("#live-metrics-refresh").onclick=paintLiveMetrics;
  paintLiveMetrics();
  refreshAdminBadges();
}

function renderSettingsHome(){
  const i=state.instituteSession;if(!i){state.screen="institute";return render();}
  app.innerHTML=shell(`<section class="card dashboard-card wide-card compact-page"><button id="settings-back" class="back">← Institute Home</button><div class="compact-heading"><span class="step">Institute configuration</span><h2>Settings</h2><p>Manage dashboard identity and admission payment settings.</p></div><div class="admin-home-grid compact-dashboard"><button id="open-dashboard-settings" class="admin-home-action"><strong>Dashboard Settings</strong><small>Name, logo, colours and welcome message</small></button><button id="open-fee-settings" class="admin-home-action"><strong>Admission Fees Settings</strong><small>Total fee and UPI payment ID</small></button><button id="open-admin-login-settings" class="admin-home-action admin-home-wide"><strong>Admin Login Changes</strong><small>Change Institute Admin ID and Password</small></button></div></section>`,true);
  document.querySelector('#settings-back').onclick=()=>{state.screen='admin-home';render();};
  document.querySelector('#open-dashboard-settings').onclick=()=>{state.screen='dashboard-settings';render();};
  document.querySelector('#open-fee-settings').onclick=()=>{state.screen='admission-fee-settings';render();};
  document.querySelector('#open-admin-login-settings').onclick=()=>{state.screen='admin-login-settings';render();};
}

function renderAdminLoginSettings(){
 const i=state.instituteSession;if(!i){state.screen="institute";return render();}
 app.innerHTML=shell(`<section class="card dashboard-card wide-card compact-page"><button id="admin-login-settings-back" class="back">← Settings</button><div class="compact-heading"><span class="step">Admin security</span><h2>Admin Login Changes</h2><p>Default login is Admin ID <strong>admin</strong> and Password <strong>12345</strong>. Change them here.</p></div><form id="admin-login-settings-form" class="compact-form">${field("new-admin-id","New Admin ID","text","Enter new Admin ID",i.adminId||"admin")}${field("new-admin-password","New Admin Password","password","Minimum 5 characters")}${field("confirm-admin-password","Confirm Password","password","Re-enter password")}<p id="admin-login-settings-message" class="form-message form-wide"></p><button id="admin-login-settings-save" class="primary form-wide">Save Admin Login</button></form></section>`,true);
 document.querySelector("#admin-login-settings-back").onclick=()=>{state.screen="settings";render();};
 document.querySelector("#admin-login-settings-form").onsubmit=async e=>{e.preventDefault();const id=document.querySelector("#new-admin-id").value.trim(),p=document.querySelector("#new-admin-password").value,c=document.querySelector("#confirm-admin-password").value,msg=document.querySelector("#admin-login-settings-message"),btn=document.querySelector("#admin-login-settings-save");if(!id||p.length<5){msg.textContent="Enter an Admin ID and a password with at least 5 characters.";msg.className="form-message show error form-wide";return;}if(p!==c){msg.textContent="Passwords do not match.";msg.className="form-message show error form-wide";return;}btn.disabled=true;btn.textContent="Saving…";try{const saved=await changeInstituteAdminCredentials(i.instituteCode,id,p);state.instituteSession={...state.instituteSession,adminId:saved.adminId};saveInstituteSession(state.instituteSession,true);msg.textContent="Admin login changed successfully.";msg.className="form-message show success-message form-wide";}catch(err){msg.textContent=`Could not change admin login. ${err.code||""}`;msg.className="form-message show error form-wide";}finally{btn.disabled=false;btn.textContent="Save Admin Login";}};
}

function readImageAsDataUrl(file,maxBytes=700000){
  return new Promise((resolve,reject)=>{
    if(!file)return resolve("");
    if(!String(file.type||"").startsWith("image/"))return reject(Object.assign(new Error("Select an image file."),{code:"invalid-qr-image"}));
    if(file.size>maxBytes)return reject(Object.assign(new Error("QR image must be smaller than 700 KB."),{code:"qr-image-too-large"}));
    const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||""));reader.onerror=()=>reject(Object.assign(new Error("Could not read QR image."),{code:"qr-image-read-failed"}));reader.readAsDataURL(file);
  });
}
function paymentDetails(){const i=state.instituteSession||{},b=state.branding||{};return {payeeName:b.payeeName||i.payeeName||b.instituteName||i.instituteName||"HMOS",upiId:b.upiId||i.upiId||"",paymentContact:b.paymentContact||i.paymentContact||b.contactNumber||i.ownerPhone||"",paymentQrDataUrl:b.paymentQrDataUrl||i.paymentQrDataUrl||""};}
function paymentBoxHtml(amount=0,showTransaction=true){
  const p=paymentDetails();
  return `<div class="form-wide upi-box payment-compatible-box">
    <h3>Payment Instructions</h3>
    <div class="payment-instructions">
      <p><strong>మీ Admission Fee ను క్రింద ఉన్న 2 పద్ధతుల్లో ఏదైనా ఒకటి ఉపయోగించి చెల్లించవచ్చు.</strong></p>
      <p><strong>1. UPI ID ద్వారా చెల్లింపు</strong><br>Copy UPI ID బటన్ నొక్కండి. UPI ID copy అయిన తర్వాత PhonePe / Google Pay / Paytm లేదా మీకు నచ్చిన UPI app open చేసి, UPI ID paste చేసి చూపించిన amount చెల్లించండి.</p>
      <p><strong>2. QR Code ద్వారా చెల్లింపు</strong><br>QR Code పై tap చేయండి. మీ phoneలో available UPI payment app open అవుతుంది. ఒకవేళ direct payment app open కాకపోతే PhonePe / Google Pay / Paytm ద్వారా QR Code scan చేసి payment complete చేయండి.</p>
      <p><strong>Payment పూర్తయ్యాక</strong><br>మీ UPI appలో కనిపించే Transaction ID / UTR Number ని copy చేసి కింద ఉన్న Transaction ID fieldలో enter చేయండి. తర్వాత Submit for Admin Approval నొక్కండి.</p>
    </div>
    <div class="payment-payee"><span>Pay To</span><strong>${esc(p.payeeName)}</strong></div>
    <div class="payment-upi-row">
      <div class="payment-upi-value"><span>UPI ID</span><strong>${esc(p.upiId||"Not configured")}</strong></div>
      <button id="copy-upi-id" type="button" class="secondary compact-button" ${p.upiId?"":"disabled"}>Copy UPI ID</button>
    </div>
    ${p.paymentContact?`<div class="payment-contact-link"><span>Payment Contact</span><strong>${esc(p.paymentContact)}</strong></div>`:""}
    ${p.paymentQrDataUrl?`<div class="payment-qr-wrap"><span>Tap QR Code to Pay</span><button id="pay-via-qr" type="button" class="payment-qr-button" aria-label="Tap QR Code to Pay"><img src="${esc(p.paymentQrDataUrl)}" alt="Payment QR Code" class="payment-qr-image"/></button><small>QR Code పై tap చేసి UPI appలో payment చేయండి.</small></div>`:`<p class="form-help">Payment QR Code is not configured. Use the UPI ID above.</p>`}
    <p class="form-help">Amount to Pay: <strong id="payment-display-amount">₹${Number(amount||0).toLocaleString("en-IN")}</strong></p>
    ${showTransaction?field("a-upi-transaction","UPI Transaction ID / UTR Number","text","Enter Transaction ID after payment"):""}
  </div>`;
}
function bindPaymentActions(getAmount,referenceText="HMOS Payment"){
  const p=paymentDetails();
  const copy=document.querySelector('#copy-upi-id');
  const qr=document.querySelector('#pay-via-qr');
  if(copy) copy.onclick=async e=>{
    if(!p.upiId) return alert('UPI ID is not configured.');
    try{
      await copyText(p.upiId);
      e.currentTarget.textContent='✓ UPI ID Copied';
      setTimeout(()=>{if(document.body.contains(e.currentTarget))e.currentTarget.textContent='Copy UPI ID';},1500);
    }catch{
      window.prompt('Copy this UPI ID:',p.upiId);
    }
  };
  if(qr) qr.onclick=()=>{
    const amount=Number(getAmount?.()||0);
    if(!p.upiId) return alert('UPI ID is not configured.');
    if(amount<=0) return alert('Please enter a valid payment amount.');
    const params=new URLSearchParams({pa:p.upiId,pn:p.payeeName||'HMOS',am:amount.toFixed(2),cu:'INR',tn:referenceText});
    window.location.href=`upi://pay?${params.toString()}`;
  };
}

function renderAdmissionFeeSettings(){
  const i=state.instituteSession;if(!i){state.screen='institute';return render();}
  const b=state.branding||{},qr=b.paymentQrDataUrl||i.paymentQrDataUrl||"";
  app.innerHTML=shell(`<section class="card dashboard-card wide-card compact-page"><button id="fee-settings-back" class="back">← Settings</button><div class="compact-heading"><span class="step">Admission settings</span><h2>Admission Fees Settings</h2><p>Configure fees, UPI details, QR payment and WhatsApp admission credentials.</p></div><form id="admission-fee-settings-form" class="compact-form">${field("setting-total-fees","Default Total Fees","number","Example: 30000",b.defaultTotalFees||i.defaultTotalFees||0,"min='0'")}${field("setting-payee-name","Payee Name","text","Example: KSR Boys Hostel",b.payeeName||i.payeeName||b.instituteName||i.instituteName||"")}${field("setting-upi-id","UPI ID","text","example@upi",b.upiId||i.upiId||"")}${field("setting-payment-contact","Payment Contact Number","tel","10-digit number",b.paymentContact||i.paymentContact||b.contactNumber||i.ownerPhone||"","inputmode='numeric'")}<label class="field form-wide"><span>Payment QR Code</span><input id="setting-payment-qr" type="file" accept="image/png,image/jpeg,image/webp"/><small>PNG/JPG/WebP, maximum 700 KB.</small></label><div class="form-wide qr-settings-preview" id="qr-settings-preview">${qr?`<img src="${esc(qr)}" alt="Current payment QR"><button type="button" id="remove-payment-qr" class="text-link">Remove QR</button>`:'<p>No QR code uploaded.</p>'}</div>${field("setting-share-id","Institute ID for WhatsApp","text","Institute login ID",b.shareInstituteId||i.instituteCode||"")}${field("setting-share-password","Institute Password for WhatsApp","text","Institute login password",b.shareInstitutePassword||i.shareInstitutePassword||"")}<p class="form-help form-wide">The payment details are displayed in Online Admission and Resident Fees. Institute login credentials are included in the WhatsApp invitation.</p><p id="fee-settings-message" class="form-message form-wide"></p><button id="fee-settings-save" class="primary form-wide">Save Admission Settings</button></form></section>`,true);
  document.querySelector('#fee-settings-back').onclick=()=>{state.screen='settings';render();};
  let qrData=qr;
  const fileInput=document.querySelector('#setting-payment-qr'),preview=document.querySelector('#qr-settings-preview');
  fileInput.onchange=async()=>{try{qrData=await readImageAsDataUrl(fileInput.files?.[0]);preview.innerHTML=qrData?`<img src="${esc(qrData)}" alt="Payment QR preview"><button type="button" id="remove-payment-qr" class="text-link">Remove QR</button>`:'<p>No QR code uploaded.</p>';bindRemove();}catch(err){fileInput.value='';alert(err.message||'Could not read QR image.');}};
  function bindRemove(){const r=document.querySelector('#remove-payment-qr');if(r)r.onclick=()=>{qrData='';fileInput.value='';preview.innerHTML='<p>No QR code uploaded.</p>';};}bindRemove();
  document.querySelector('#admission-fee-settings-form').onsubmit=async e=>{e.preventDefault();const btn=document.querySelector('#fee-settings-save'),msg=document.querySelector('#fee-settings-message'),contact=document.querySelector('#setting-payment-contact').value.replace(/\D/g,'');if(contact&&contact.length!==10){msg.textContent='Payment Contact Number must contain 10 digits.';msg.className='form-message show error form-wide';return;}btn.disabled=true;btn.textContent='Saving…';try{const saved=await saveAdmissionFeeSettings({instituteCode:i.instituteCode,instituteId:i.instituteId,payeeName:document.querySelector('#setting-payee-name').value,upiId:document.querySelector('#setting-upi-id').value,paymentContact:contact,paymentQrDataUrl:qrData,defaultTotalFees:document.querySelector('#setting-total-fees').value,shareInstituteId:document.querySelector('#setting-share-id').value,shareInstitutePassword:document.querySelector('#setting-share-password').value});state.branding={...(state.branding||{}),...saved};state.instituteSession={...state.instituteSession,...saved,branding:state.branding};saveInstituteSession(state.instituteSession,true);msg.textContent='Admission and payment settings saved successfully.';msg.className='form-message show success-message form-wide';}catch(err){msg.textContent=`Could not save admission settings. ${humanError(err,err.code||'Unknown error')}`;msg.className='form-message show error form-wide';}finally{btn.disabled=false;btn.textContent='Save Admission Settings';}};
}

function renderDashboardSettings(){
  const i=state.instituteSession;if(!i){state.screen="institute";return render();}
  const b=state.branding||{};
  app.innerHTML=shell(`<section class="card dashboard-card wide-card"><button id="branding-back" class="back">← Institute Home</button><div class="card-heading"><span class="step">Dashboard customisation</span><h2>Dashboard Settings</h2><p>Choose the institute identity shown after institute login.</p></div><form id="branding-form" class="form-grid">${field("brand-name","Institute Name","text","Institute name",b.instituteName||i.instituteName)}${field("brand-short","Short Name","text","Example: KSR",b.shortName||i.instituteCode)}${field("brand-logo","Logo Image URL","url","https://.../logo.png",b.logoUrl||"")}${field("brand-primary","Primary Colour","color","",b.primaryColor||"#0b4f8a")}${field("brand-secondary","Secondary Colour","color","",b.secondaryColor||"#16866b")}${field("brand-contact","Contact Number","tel","10-digit number",b.contactNumber||i.ownerPhone||"")}<label class="field form-wide"><span>Welcome Message</span><textarea id="brand-message" placeholder="Welcome to our institute">${esc(b.welcomeMessage||"")}</textarea></label><div class="branding-preview form-wide" id="branding-preview"><strong>${esc(b.instituteName||i.instituteName)}</strong><span>${esc(b.welcomeMessage||"Institute dashboard powered by HMOS")}</span></div><p id="branding-message" class="form-message form-wide"></p><button class="primary form-wide" id="branding-save">Save Dashboard</button></form></section>`,true);
  document.querySelector('#branding-back').onclick=()=>{state.screen='admin-home';render();};
  const refresh=()=>{const x=document.querySelector('#branding-preview');x.style.borderColor=document.querySelector('#brand-primary').value;x.querySelector('strong').textContent=document.querySelector('#brand-name').value||i.instituteName;x.querySelector('span').textContent=document.querySelector('#brand-message').value||'Institute dashboard powered by HMOS';};
  ['brand-name','brand-primary','brand-secondary','brand-message'].forEach(id=>document.querySelector('#'+id).oninput=refresh);
  document.querySelector('#branding-form').onsubmit=async e=>{e.preventDefault();const btn=document.querySelector('#branding-save'),msg=document.querySelector('#branding-message');btn.disabled=true;btn.textContent='Saving…';try{state.branding=await saveInstituteBranding({instituteCode:i.instituteCode,instituteId:i.instituteId,instituteName:document.querySelector('#brand-name').value,shortName:document.querySelector('#brand-short').value,logoUrl:document.querySelector('#brand-logo').value,primaryColor:document.querySelector('#brand-primary').value,secondaryColor:document.querySelector('#brand-secondary').value,contactNumber:document.querySelector('#brand-contact').value,upiId:b.upiId||i.upiId||"",defaultTotalFees:b.defaultTotalFees||i.defaultTotalFees||0,welcomeMessage:document.querySelector('#brand-message').value});state.instituteSession={...state.instituteSession,instituteName:state.branding.instituteName,upiId:state.branding.upiId,branding:state.branding};saveInstituteSession(state.instituteSession,true);msg.textContent='Dashboard saved successfully.';msg.className='form-message show success-message form-wide';setTimeout(()=>{state.screen='institute-portal';render();},700);}catch(err){msg.textContent=`Could not save dashboard. ${err.code||''}`;msg.className='form-message show error form-wide';btn.disabled=false;btn.textContent='Save Dashboard';}};
}

function renderAdmissionsHome(){
  const i=state.instituteSession;if(!i){state.screen="institute";return render();}
  const link=`${location.origin}${location.pathname}`;
  app.innerHTML=shell(`<section class="card dashboard-card wide-card"><button id="admissions-back" class="back">← Institute Home</button><div class="card-heading"><span class="step">Admissions centre</span><h2>Admissions</h2><p>Share the online application, verify pending admissions or create a resident manually.</p></div><div class="admin-home-grid compact-dashboard"><button id="share-admission-link" class="admin-home-action"><strong>WhatsApp Share</strong><small>Send online admission invitation</small></button><button id="open-online-admission" class="admin-home-action"><strong>Online Admission</strong><small>Payment and admin approval flow</small></button><button id="open-manual-admission" class="admin-home-action"><strong>Manual Admission</strong><small>Admin entry without online payment</small></button><button id="open-pending-admissions" class="admin-home-action"><strong>Pending Admissions</strong><small>Check payment details and approve</small></button></div><p id="admissions-message" class="form-message"></p></section>`,true);
  document.querySelector("#admissions-back").onclick=()=>{state.screen="admin-home";render();};
  document.querySelector("#open-online-admission").onclick=()=>{state.manualAdmissionMode=false;state.screen="new-admission";render();};
  document.querySelector("#open-manual-admission").onclick=()=>{state.manualAdmissionMode=true;state.screen="manual-admission";render();};
  document.querySelector("#open-pending-admissions").onclick=()=>{state.screen="pending-admissions";render();};
  document.querySelector("#share-admission-link").onclick=()=>{
    const b=state.branding||{};
    const instituteId=b.shareInstituteId||i.shareInstituteId||i.instituteCode||"";
    const institutePassword=b.shareInstitutePassword||i.shareInstitutePassword||"";
    const msg=document.querySelector("#admissions-message");
    if(!instituteId||!institutePassword){msg.textContent="Open Settings → Admission Fees Settings and save the Institute ID and Password first.";msg.className="form-message show error";return;}
    const name=b.instituteName||i.instituteName||i.instituteCode;
    const text=`🏡 *Welcome to ${name}*\n\nDear Student,\n\nGreetings from *${name}*.\nThank you for choosing our institute.\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n🌐 *Admission Portal*\n${link}\n\n🏢 *Institute ID*\n${instituteId}\n\n🔑 *Institute Password*\n${institutePassword}\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n📋 *ప్రవేశ ప్రక్రియ*\n\n✅ పై Admission Portal Link ను Open చేసి Institute ID మరియు Institute Password ఉపయోగించి Login అవ్వండి.\n\n✅ Admission Formలో అడిగిన అన్ని వివరాలను సరైన విధంగా నమోదు చేయండి.\n\n✅ మీకు కావలసిన Floor → Room → Bed ను ఎంపిక చేసుకోండి.\n\n✅ Portalలో చూపించిన UPI ID ద్వారా Admission Fee చెల్లించండి.\n\n✅ Payment పూర్తయిన తర్వాత UPI Transaction ID నమోదు చేసి Submit for Admin Approval పై క్లిక్ చేయండి.\n\n✅ Institute Admin మీ వివరాలు మరియు Paymentను పరిశీలించి Approval ఇస్తారు.\n\n✅ Approval పూర్తయిన వెంటనే Check Admission Approvalలో Phone Number నమోదు చేసి Student ID, Password, Admission PDF మరియు Payment Receipt పొందవచ్చు.\n\n✅ Resident Login ద్వారా Profile, Fees, Attendance, Today Menu, Entry/Exit, Complaints సేవలను ఉపయోగించవచ్చు.\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n⚠️ *Important Note*\n✔ Please ensure that all information entered is accurate.\n✔ Admission will be processed only after payment verification and Admin Approval.\n✔ Incorrect information may delay or reject the admission.\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n📞 *Contact Us*\nInstitute: ${name}\nMobile: ${b.contactNumber||i.ownerPhone||""}\nEmail: ${i.ownerEmail||""}\nAddress: ${i.address||i.city||""}\n\n*Thank You!*\nWe look forward to welcoming you to *${name}*.\n\nPowered by HMOS – Hostel Management Operating System`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,"_blank","noopener");
  };
}

async function renderKitchen(){
  const i=state.instituteSession;if(!i){state.screen="institute";return render();}
  const today=new Date().toISOString().slice(0,10);
  app.innerHTML=shell(`<section class="card dashboard-card wide-card compact-page"><button id="kitchen-back" class="back">← Institute Home</button><div class="compact-heading"><span class="step">Food operations</span><h2>Kitchen</h2><p>Update today’s menu and review meal attendance. Tap an attendance card to view resident names.</p></div><form id="menu-form" class="compact-form">${field("menu-date","Menu Date","date","",today)}${field("menu-breakfast","Breakfast","text","Example: Idli, Sambar")}${field("menu-lunch","Lunch","text","Example: Rice, Dal, Curry")}${field("menu-dinner","Dinner","text","Example: Chapati, Curry")}${field("menu-snacks","Snacks / Special","text","Optional")}<p id="menu-message" class="form-message form-wide"></p><button class="primary form-wide" id="menu-save">Save Today Menu</button></form><div class="compact-section"><h3>Meal Attendance Today</h3><div id="meal-admin-summary" class="mini-stat-grid attendance-admin-grid"><button type="button" data-attendance-type="breakfast"><span>Breakfast</span><strong>—</strong><small>Tap to view names</small></button><button type="button" data-attendance-type="lunch"><span>Lunch</span><strong>—</strong><small>Tap to view names</small></button><button type="button" data-attendance-type="dinner"><span>Dinner</span><strong>—</strong><small>Tap to view names</small></button><button type="button" data-attendance-type="night"><span>Night Present</span><strong>—</strong><small>Tap to view names</small></button><button type="button" class="wide-attendance-card" data-attendance-type="missing"><span>Not Marked / Outside</span><strong>—</strong><small>Tap to view names & status</small></button></div></div></section>`,true);
  document.querySelector("#kitchen-back").onclick=()=>{state.screen="admin-home";render();};

  const mealLabel={breakfast:"Breakfast",lunch:"Lunch",dinner:"Dinner",night:"Night Present"};
  const openAttendanceList=(type,rows,residents,movements)=>{
    const active=residents.filter(x=>(x.accountStatus||"active")==="active");
    const attendanceIds=new Set(rows.filter(x=>x.meal===type).map(x=>String(x.studentId||"")));
    const outsideIds=new Set(movements.filter(x=>x.status==="outside").map(x=>String(x.studentId||"")));

    let list=[];
    let title="";
    if(type==="missing"){
      const nightIds=new Set(rows.filter(x=>x.meal==="night").map(x=>String(x.studentId||"")));
      list=active.filter(r=>!nightIds.has(String(r.studentId||""))).map(r=>({
        studentId:r.studentId,
        studentName:r.studentName,
        roomNumber:r.roomNumber||r.roomName||"",
        bedNumber:r.bedNumber||"",
        status:outsideIds.has(String(r.studentId||""))?"Outside":"Not Marked"
      }));
      title="Not Marked / Outside";
    }else{
      list=active.filter(r=>attendanceIds.has(String(r.studentId||""))).map(r=>({
        studentId:r.studentId,
        studentName:r.studentName,
        roomNumber:r.roomNumber||r.roomName||"",
        bedNumber:r.bedNumber||"",
        status:"Present"
      }));
      title=mealLabel[type]||"Attendance";
    }

    const overlay=document.createElement("div");
    overlay.className="attendance-list-overlay";
    overlay.innerHTML=`<section class="attendance-list-sheet" role="dialog" aria-modal="true" aria-label="${esc(title)} attendance"><div class="attendance-list-head"><div><span class="step">Attendance list</span><h2>${esc(title)}</h2><p>${list.length} resident${list.length===1?"":"s"}</p></div><button type="button" class="attendance-list-close" aria-label="Close">×</button></div><div class="attendance-list-body">${list.map(r=>`<article class="attendance-resident-row"><div><strong>${esc(r.studentName||r.studentId||"Resident")}</strong><span>${esc(r.studentId||"")}</span><small>${r.roomNumber?`Room ${esc(r.roomNumber)}`:""}${r.bedNumber?` · Bed ${esc(r.bedNumber)}`:""}</small></div><span class="attendance-status ${r.status==="Outside"?"outside":r.status==="Not Marked"?"missing":"present"}">${esc(r.status)}</span></article>`).join("")||'<div class="empty-state compact-empty"><strong>No residents in this category.</strong></div>'}</div></section>`;
    document.body.appendChild(overlay);
    const close=()=>overlay.remove();
    overlay.querySelector(".attendance-list-close").onclick=close;
    overlay.onclick=e=>{if(e.target===overlay)close();};
  };

  try{
    const menu=await getDailyMenu(i.instituteCode,today);
    if(menu){
      document.querySelector("#menu-breakfast").value=menu.breakfast||"";
      document.querySelector("#menu-lunch").value=menu.lunch||"";
      document.querySelector("#menu-dinner").value=menu.dinner||"";
      document.querySelector("#menu-snacks").value=menu.snacks||"";
    }
    const [rows,residents,movements]=await Promise.all([
      listInstituteMealAttendance(i.instituteCode,today),
      listInstituteStudents(i.instituteCode),
      listInstituteMovements(i.instituteCode)
    ]);
    const counts={breakfast:0,lunch:0,dinner:0,night:0};
    rows.forEach(x=>{if(counts[x.meal]!==undefined)counts[x.meal]++;});
    const activeResidents=residents.filter(x=>(x.accountStatus||"active")==="active").length;
    const outsideOrNotMarked=Math.max(0,activeResidents-counts.night);

    const values={breakfast:counts.breakfast,lunch:counts.lunch,dinner:counts.dinner,night:counts.night,missing:outsideOrNotMarked};
    document.querySelectorAll("[data-attendance-type]").forEach(card=>{
      const type=card.dataset.attendanceType;
      const strong=card.querySelector("strong");
      if(strong)strong.textContent=values[type]??0;
      card.onclick=()=>openAttendanceList(type,rows,residents,movements);
    });
  }catch(err){
    console.warn(err);
    document.querySelector("#meal-admin-summary").insertAdjacentHTML("afterend",`<p class="form-message show error">${esc(humanError(err,"Could not load attendance."))}</p>`);
  }

  document.querySelector("#menu-form").onsubmit=async e=>{
    e.preventDefault();
    const b=document.querySelector("#menu-save"),msg=document.querySelector("#menu-message");
    b.disabled=true;b.textContent="Saving…";
    try{
      await saveDailyMenu({instituteCode:i.instituteCode,instituteId:i.instituteId,date:document.querySelector("#menu-date").value,breakfast:document.querySelector("#menu-breakfast").value,lunch:document.querySelector("#menu-lunch").value,dinner:document.querySelector("#menu-dinner").value,snacks:document.querySelector("#menu-snacks").value});
      msg.textContent="Menu saved successfully.";msg.className="form-message show success-message form-wide";
    }catch(err){
      msg.textContent=`Could not save menu. ${err.code||""}`;msg.className="form-message show error form-wide";
    }finally{
      b.disabled=false;b.textContent="Save Today Menu";
    }
  };
}
async function renderEntryExit(){
  const i=state.instituteSession;if(!i){state.screen="institute";return render();}
  app.innerHTML=shell(`<section class="card dashboard-card wide-card compact-page"><button id="entry-back" class="back">← Institute Home</button><div class="compact-heading"><span class="step">Movement control</span><h2>Entry / Exit</h2><p>Tap Outside or Returned to open the resident list. Then tap a resident for full trip details.</p></div><div id="movement-summary-grid" class="movement-summary-grid"><button id="movement-outside-tab" class="movement-summary-card" type="button" data-movement-type="outside"><span>Outside Now</span><strong id="outside-count">—</strong><small>Tap to view names</small></button><button id="movement-returned-tab" class="movement-summary-card" type="button" data-movement-type="returned"><span>Returned</span><strong id="returned-count">—</strong><small>Tap to view names</small></button></div><div class="movement-admin-hint"><strong>Select a card above</strong><span>Outside and Returned residents will open in a list.</span></div></section>`,true);
  document.querySelector("#entry-back").onclick=()=>{state.screen="admin-home";render();};

  const dateTimeText=value=>{
    try{
      const d=value?.toDate?value.toDate():(value?.seconds?new Date(value.seconds*1000):(value?new Date(value):null));
      return d&&!Number.isNaN(d.getTime())?d.toLocaleString():"—";
    }catch{return "—";}
  };
  const mapUrl=m=>{
    const lat=Number(m?.latitude),lng=Number(m?.longitude);
    return Number.isFinite(lat)&&Number.isFinite(lng)?`https://www.google.com/maps?q=${lat},${lng}`:"";
  };

  try{
    const [movements,students]=await Promise.all([listInstituteMovements(i.instituteCode),listInstituteStudents(i.instituteCode)]);
    state.movements=movements;
    const outside=movements.filter(x=>x.status==="outside"),returned=movements.filter(x=>x.status==="returned");
    document.querySelector("#outside-count").textContent=outside.length;
    document.querySelector("#returned-count").textContent=returned.length;

    const openMovement=m=>{
      const resident=students.find(s=>String(s.studentId||"")===String(m.studentId||""))||{};
      const url=mapUrl(m);
      const overlay=document.createElement("div");
      overlay.className="movement-detail-overlay";
      overlay.innerHTML=`<section class="movement-detail-sheet" role="dialog" aria-modal="true" aria-label="Movement details">
        <div class="movement-detail-head"><div><span class="step">${m.status==="outside"?"Currently outside":"Returned resident"}</span><h2>${esc(m.studentName||resident.studentName||m.studentId||"Resident")}</h2></div><button type="button" class="movement-close" aria-label="Close">×</button></div>
        <div class="movement-detail-body">
          <div class="movement-detail-grid">
            <div><small>Reason</small><strong>${esc(m.reason||"—")}</strong></div>
            <div><small>Where</small><strong>${esc(m.location||"—")}</strong></div>
            <div><small>Leaving</small><strong>${esc(`${m.leavingDate||""} ${m.leavingTime||""}`)}</strong></div>
            <div><small>Expected Return</small><strong>${esc(`${m.returnDate||""} ${m.returnTime||""}`)}</strong></div>
            ${m.actualReturnAt?`<div><small>Actual Return</small><strong>${esc(dateTimeText(m.actualReturnAt))}</strong></div>`:""}
            <div><small>Student ID</small><strong>${esc(m.studentId||"—")}</strong></div>
          </div>
          <div class="movement-action-grid">
            ${url?`<button type="button" id="movement-view-location" class="primary">📍 View Location</button>`:`<div class="movement-no-location">Location was not shared for this older record.</div>`}
            ${resident.studentPhone?`<a class="secondary movement-call-button" href="tel:${esc(resident.studentPhone)}">Call Resident</a>`:`<button class="secondary" disabled>Call Resident unavailable</button>`}
            ${resident.parentPhone?`<a class="secondary movement-call-button" href="tel:${esc(resident.parentPhone)}">Call Parent</a>`:`<button class="secondary" disabled>Call Parent unavailable</button>`}
            ${m.status==="outside"?`<button type="button" id="movement-mark-entry" class="secondary">Mark Entry</button>`:""}
          </div>
          <p id="movement-detail-message" class="form-message"></p>
        </div>
      </section>`;
      document.body.appendChild(overlay);
      const close=()=>overlay.remove();
      overlay.querySelector(".movement-close").onclick=close;
      overlay.onclick=e=>{if(e.target===overlay)close();};
      const loc=overlay.querySelector("#movement-view-location");
      if(loc)loc.onclick=()=>window.open(url,"_blank","noopener");
      const mark=overlay.querySelector("#movement-mark-entry");
      if(mark)mark.onclick=async()=>{
        const msg=overlay.querySelector("#movement-detail-message");
        mark.disabled=true;mark.textContent="Marking…";
        try{
          await markStudentEntry(m.id);
          msg.textContent="Resident marked as returned.";msg.className="form-message show success-message";
          setTimeout(()=>{close();renderEntryExit();},450);
        }catch(err){
          msg.textContent=humanError(err,"Could not mark entry.");msg.className="form-message show error";
          mark.disabled=false;mark.textContent="Mark Entry";
        }
      };
    };

    const openResidentList=type=>{
      const rows=type==="outside"?outside:returned;
      const overlay=document.createElement("div");
      overlay.className="movement-list-overlay";
      overlay.innerHTML=`<section class="movement-list-sheet" role="dialog" aria-modal="true" aria-label="${type==="outside"?"Outside residents":"Returned residents"}">
        <div class="movement-list-head"><div><span class="step">Movement list</span><h2>${type==="outside"?"Outside Now":"Returned Residents"}</h2><p>${rows.length} resident${rows.length===1?"":"s"}</p></div><button type="button" class="movement-list-close" aria-label="Close">×</button></div>
        <div class="movement-list-body">${rows.map(m=>`<button type="button" class="movement-resident-row" data-list-movement="${esc(m.id)}"><div><strong>${esc(m.studentName||m.studentId)}</strong><span>${esc(m.reason||"")} · ${esc(m.location||"")}</span><small>${type==="outside"?`Expected return: ${esc(`${m.returnDate||""} ${m.returnTime||""}`)}`:`Returned: ${esc(dateTimeText(m.actualReturnAt))}`}</small></div><span class="movement-row-arrow">›</span></button>`).join("")||`<div class="empty-state compact-empty"><strong>${type==="outside"?"No one is outside.":"No returned records yet."}</strong></div>`}</div>
      </section>`;
      document.body.appendChild(overlay);
      const closeList=()=>overlay.remove();
      overlay.querySelector(".movement-list-close").onclick=closeList;
      overlay.onclick=e=>{if(e.target===overlay)closeList();};
      overlay.querySelectorAll("[data-list-movement]").forEach(row=>row.onclick=()=>{
        const m=movements.find(x=>x.id===row.dataset.listMovement);
        if(m){closeList();openMovement(m);}
      });
    };

    const grid=document.querySelector("#movement-summary-grid");
    grid.addEventListener("click",e=>{
      const card=e.target.closest("[data-movement-type]");
      if(!card||!grid.contains(card))return;
      openResidentList(card.dataset.movementType);
    });
  }catch(err){
    document.querySelector("#movement-summary-grid").insertAdjacentHTML("afterend",`<p class="form-message show error">${esc(humanError(err,"Could not load movement records."))}</p>`);
  }
}
async function renderComplaintsAdmin(){
 const i=state.instituteSession;if(!i){state.screen="institute";return render();}
 app.innerHTML=shell(`<section class="card dashboard-card wide-card compact-page"><button id="complaints-back" class="back">← Institute Home</button><div class="compact-heading"><span class="step">Resident support</span><h2>Complaints</h2><p>Tap a complaint to review full details and update its status.</p></div><div id="complaint-admin-list"><div class="loading-card"><div class="loader"></div></div></div></section>`,true);
 document.querySelector("#complaints-back").onclick=()=>{state.screen="admin-home";render();};

 const complaintDate=c=>{
   const raw=c?.createdAt||c?.submittedAt||c?.updatedAt;
   try{
     const d=raw?.toDate?raw.toDate():(raw?.seconds?new Date(raw.seconds*1000):(raw?new Date(raw):null));
     return d && !Number.isNaN(d.getTime()) ? d.toLocaleString() : "Not available";
   }catch{return "Not available";}
 };
 const statusLabel=s=>({"submitted":"Submitted","in-review":"In Review","resolved":"Resolved","rejected":"Rejected"}[s]||s||"Submitted");

 const openComplaint=c=>{
   const overlay=document.createElement("div");
   overlay.className="complaint-detail-overlay";
   overlay.innerHTML=`<section class="complaint-detail-sheet" role="dialog" aria-modal="true" aria-label="Complaint details">
     <div class="complaint-detail-head"><div><span class="step">Complaint details</span><h2>${esc(c.subject||"Complaint")}</h2></div><button type="button" class="complaint-close" aria-label="Close">×</button></div>
     <div class="complaint-detail-body">
       <div class="complaint-detail-resident"><strong>${esc(c.studentName||c.studentId||"Resident")}</strong><span>${esc(c.studentId||"")}</span></div>
       <div class="complaint-detail-grid">
         <div><small>Category</small><strong>${esc(c.category||"Other")}</strong></div>
         <div><small>Submitted</small><strong>${esc(complaintDate(c))}</strong></div>
       </div>
       <div class="complaint-full-text"><small>Complaint</small><p>${esc(c.details||"No details provided.")}</p></div>
       <label class="field"><span>Status</span><select id="complaint-detail-status">
         <option value="submitted">Submitted</option><option value="in-review">In Review</option><option value="resolved">Resolved</option><option value="rejected">Rejected</option>
       </select></label>
       <p id="complaint-detail-message" class="form-message"></p>
       <button type="button" id="complaint-detail-save" class="primary">Save Status</button>
     </div>
   </section>`;
   document.body.appendChild(overlay);
   const close=()=>overlay.remove();
   overlay.querySelector(".complaint-close").onclick=close;
   overlay.onclick=e=>{if(e.target===overlay)close();};
   const select=overlay.querySelector("#complaint-detail-status");
   select.value=c.status||"submitted";
   overlay.querySelector("#complaint-detail-save").onclick=async()=>{
     const btn=overlay.querySelector("#complaint-detail-save"),msg=overlay.querySelector("#complaint-detail-message");
     btn.disabled=true;msg.textContent="Saving…";msg.className="form-message show";
     try{
       await updateComplaintStatus(c.id,select.value);
       c.status=select.value;
       msg.textContent="Status updated.";msg.className="form-message show success-message";
       const row=document.querySelector(`[data-complaint-open="${CSS.escape(c.id)}"]`);
       if(row){const badge=row.querySelector(".complaint-status-badge");if(badge)badge.textContent=statusLabel(c.status);}
       setTimeout(close,450);
     }catch(err){
       msg.textContent=humanError(err,"Could not update complaint status.");msg.className="form-message show error";
     }finally{btn.disabled=false;}
   };
 };
 try{
   state.complaints=await listInstituteComplaints(i.instituteCode);
   const isOpen=c=>!["resolved","rejected","closed","deleted"].includes(String(c.status||"submitted").toLowerCase());
   const openComplaints=state.complaints.filter(isOpen);
   const resolvedComplaints=state.complaints.filter(c=>!isOpen(c));
   const complaintRow=c=>`<button type="button" class="compact-list-row complaint-open-row" data-complaint-open="${esc(c.id)}"><div><strong>${esc(c.studentName||c.studentId)}</strong><span>${esc(c.category||"Other")} · ${esc(c.subject||"Complaint")}</span><small>${esc(c.details||"")}</small></div><span class="complaint-status-badge">${esc(statusLabel(c.status))}</span></button>`;
   document.querySelector("#complaint-admin-list").innerHTML=`<div class="compact-section"><h3>Open Complaints (${openComplaints.length})</h3>${openComplaints.map(complaintRow).join("")||'<div class="empty-state compact-empty"><strong>No open complaints.</strong></div>'}</div>${resolvedComplaints.length?`<div class="compact-section"><h3>Resolved / History (${resolvedComplaints.length})</h3>${resolvedComplaints.map(complaintRow).join("")}</div>`:""}`;
   document.querySelectorAll("[data-complaint-open]").forEach(row=>row.onclick=()=>{const c=state.complaints.find(x=>x.id===row.dataset.complaintOpen);if(c)openComplaint(c);});
 }catch(err){
   document.querySelector("#complaint-admin-list").innerHTML=`<p class="form-message show error">${esc(err.code||"Could not load")}</p>`;
 }
}

function prepareInstitutePrint(title="HMOS Report"){
  document.title=`${state.instituteSession?.instituteName||"HMOS"} - ${String(title||"Report").replaceAll("_"," ")}`;
}

function reportDateTime(value){
  try{
    const d=value?.toDate?value.toDate():(value?.seconds?new Date(value.seconds*1000):(value?new Date(value):null));
    return d && !Number.isNaN(d.getTime()) ? d.toLocaleString("en-IN") : "—";
  }catch{return "—";}
}

function reportDateOnly(value){
  try{
    const d=value?.toDate?value.toDate():(value?.seconds?new Date(value.seconds*1000):(value?new Date(value):null));
    return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("en-IN") : (value||"—");
  }catch{return value||"—";}
}

function openPremiumReportWindow({title,subtitle="",columns=[],rows=[],summary=[],emptyText="No records found."}){
  const i=state.instituteSession||{};
  const w=window.open("","_blank");
  if(!w) return null;
  const safe=x=>esc(x==null?"":String(x));
  const tableRows=rows.length
    ? rows.map((row,idx)=>`<tr><td class="serial">${idx+1}</td>${columns.map(c=>`<td>${safe(typeof c.value==="function"?c.value(row):row[c.value])}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${columns.length+1}" class="empty">${safe(emptyText)}</td></tr>`;
  const summaryHtml=summary.length
    ? `<div class="summary">${summary.map(s=>`<article><span>${safe(s.label)}</span><strong>${safe(s.value)}</strong></article>`).join("")}</div>`
    : "";
  const generated=new Date().toLocaleString("en-IN");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safe(i.instituteName||"HMOS")} - ${safe(title)}</title><style>
    *{box-sizing:border-box}body{margin:0;background:#eef4f8;color:#132b46;font-family:Arial,Helvetica,sans-serif}
    .page{width:min(1100px,calc(100% - 32px));margin:28px auto;background:white;border-radius:24px;box-shadow:0 18px 55px rgba(16,45,73,.12);overflow:hidden}
    .hero{padding:30px 34px 26px;background:linear-gradient(135deg,#123f67,#2f6a4c);color:white}
    .brand{display:flex;align-items:center;gap:18px}.logo{width:66px;height:66px;border-radius:18px;background:white;color:#2f6a4c;display:grid;place-items:center;font-size:34px;font-weight:900}
    .brand h1{margin:0;font-size:30px;line-height:1.05}.brand p{margin:4px 0 0;opacity:.88;font-size:12px}
    .report-head{padding:26px 32px 14px}.eyebrow{text-transform:uppercase;letter-spacing:.12em;font-weight:800;color:#1f668f;font-size:12px}
    .report-head h2{font-size:31px;margin:7px 0 6px}.report-head p{margin:0;color:#647687}
    .summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;padding:10px 32px 22px}
    .summary article{border:1px solid #dce6ed;background:#f8fbfd;border-radius:16px;padding:15px}.summary span{display:block;color:#70808f;font-size:12px;margin-bottom:5px}.summary strong{font-size:22px}
    .table-wrap{padding:0 32px 30px;overflow:auto}table{width:100%;border-collapse:separate;border-spacing:0;border:1px solid #dbe5ec;border-radius:16px;overflow:hidden;font-size:13px}
    th{background:#f0f6fa;color:#31516b;text-align:left;padding:12px;border-bottom:1px solid #dbe5ec}td{padding:12px;border-bottom:1px solid #edf1f4;vertical-align:top}tr:last-child td{border-bottom:0}.serial{width:42px;color:#7b8995}.empty{text-align:center;padding:34px;color:#7a8996}
    .footer{border-top:1px solid #e0e7ed;padding:18px 32px 26px;display:flex;justify-content:space-between;gap:12px;color:#72808d;font-size:11px}
    .actions{padding:0 32px 24px;display:flex;justify-content:flex-end}.print{border:0;background:#0b5795;color:#fff;border-radius:12px;padding:12px 18px;font-weight:800;cursor:pointer}
    @media(max-width:700px){.page{width:100%;margin:0;border-radius:0}.hero,.report-head,.table-wrap,.summary,.footer,.actions{padding-left:18px;padding-right:18px}.report-head h2{font-size:25px}table{font-size:11px}th,td{padding:9px}}
    @media print{body{background:white}.page{width:100%;margin:0;box-shadow:none;border-radius:0}.actions{display:none}.hero{-webkit-print-color-adjust:exact;print-color-adjust:exact}.summary article,th{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body><main class="page"><header class="hero"><div class="brand"><div class="logo">${safe((i.instituteName||"K")[0].toUpperCase())}</div><div><h1>${safe(i.instituteName||"Institute")}</h1><p>${safe(i.instituteCode||"")} ${i.ownerPhone?` · ${safe(i.ownerPhone)}`:""}</p>${i.address?`<p>${safe(i.address)}</p>`:""}</div></div></header><section class="report-head"><div class="eyebrow">HMOS Report</div><h2>${safe(title)}</h2><p>${safe(subtitle)}</p></section>${summaryHtml}<div class="table-wrap"><table><thead><tr><th>#</th>${columns.map(c=>`<th>${safe(c.label)}</th>`).join("")}</tr></thead><tbody>${tableRows}</tbody></table></div><div class="actions"><button class="print" onclick="window.print()">Print / Save PDF</button></div><footer class="footer"><span>Generated: ${safe(generated)}</span><span>Powered by HMOS – Hostel Management Operating System</span></footer></main></body></html>`);
  w.document.close();
  return w;
}

function renderPdfReports(){
  const i=state.instituteSession;if(!i){state.screen="institute";return render();}
  const reports=[
    ["all-residents","All Residents PDF"],
    ["pending-fees","Pending Fees PDF"],
    ["fees-next-week","Fees Due Next Week PDF"],
    ["breakfast","Breakfast Attendance PDF"],
    ["lunch","Lunch Attendance PDF"],
    ["dinner","Dinner Attendance PDF"],
    ["outside","Currently Outside PDF"],
    ["complaints","Complaints PDF"]
  ];
  app.innerHTML=shell(`<section class="card dashboard-card wide-card compact-page"><button id="pdf-back" class="back">← Institute Home</button><div class="compact-heading"><span class="step">Reports</span><h2>PDF’s</h2><p>Open a premium report, then use Print / Save PDF.</p></div><p id="pdf-message" class="form-message"></p><div class="compact-report-grid">${reports.map(([key,label])=>`<button class="secondary compact-report" data-report="${key}">${label}</button>`).join("")}</div></section>`,true);
  document.querySelector("#pdf-back").onclick=()=>{state.screen="admin-home";render();};

  const today=new Date().toISOString().slice(0,10);
  const studentMap=students=>new Map(students.map(s=>[String(s.studentId||""),s]));
  const roomBed=s=>[s.roomNumber?`Room ${s.roomNumber}`:"",s.bedNumber?`Bed ${s.bedNumber}`:""].filter(Boolean).join(" · ")||"—";

  document.querySelectorAll("[data-report]").forEach(button=>button.onclick=async()=>{
    const type=button.dataset.report;
    const msg=document.querySelector("#pdf-message");
    button.disabled=true;
    const old=button.textContent;
    button.textContent="Preparing…";
    msg.textContent="Preparing report…";msg.className="form-message show";
    try{
      if(type==="all-residents"){
        const students=(await listInstituteStudents(i.instituteCode)).filter(s=>(s.accountStatus||"active")==="active");
        openPremiumReportWindow({
          title:"All Residents",
          subtitle:`Active resident register · ${reportDateOnly(today)}`,
          summary:[{label:"Active Residents",value:students.length}],
          columns:[
            {label:"Student",value:r=>r.studentName||"—"},
            {label:"Student ID",value:"studentId"},
            {label:"Course / Class",value:r=>r.courseOrClass||"—"},
            {label:"Room / Bed",value:roomBed},
            {label:"Phone",value:r=>r.studentPhone||"—"},
            {label:"Parent Phone",value:r=>r.parentPhone||"—"}
          ],rows:students,emptyText:"No active residents."
        });
      }else if(type==="pending-fees"||type==="fees-next-week"){
        const [students,fees]=await Promise.all([listInstituteStudents(i.instituteCode),listInstituteFees(i.instituteCode)]);
        const sm=studentMap(students);
        let selected=fees.filter(f=>Number(f.balanceAmount||0)>0);
        if(type==="fees-next-week"){
          const start=new Date();start.setHours(0,0,0,0);
          const end=new Date(start);end.setDate(end.getDate()+7);end.setHours(23,59,59,999);
          selected=selected.filter(f=>{
            if(!f.dueDate)return false;
            const d=new Date(`${f.dueDate}T00:00:00`);
            return !Number.isNaN(d.getTime())&&d>=start&&d<=end;
          });
        }
        const balance=selected.reduce((sum,f)=>sum+Number(f.balanceAmount||0),0);
        openPremiumReportWindow({
          title:type==="pending-fees"?"Pending Fees":"Fees Due Next Week",
          subtitle:type==="pending-fees"?"Residents with outstanding fee balance.":"Outstanding balances due within the next 7 days.",
          summary:[{label:"Accounts",value:selected.length},{label:"Outstanding",value:`₹${balance.toLocaleString("en-IN")}`}],
          columns:[
            {label:"Student",value:r=>sm.get(String(r.studentId||""))?.studentName||r.studentId||"—"},
            {label:"Student ID",value:"studentId"},
            {label:"Total Fee",value:r=>`₹${Number(r.totalFee||0).toLocaleString("en-IN")}`},
            {label:"Paid",value:r=>`₹${Number(r.paidAmount||0).toLocaleString("en-IN")}`},
            {label:"Balance",value:r=>`₹${Number(r.balanceAmount||0).toLocaleString("en-IN")}`},
            {label:"Due Date",value:r=>r.dueDate||"—"}
          ],rows:selected,emptyText:type==="pending-fees"?"No pending fees.":"No fees due in the next 7 days."
        });
      }else if(["breakfast","lunch","dinner"].includes(type)){
        const [attendance,students]=await Promise.all([listInstituteMealAttendance(i.instituteCode,today),listInstituteStudents(i.instituteCode)]);
        const sm=studentMap(students);
        const selected=attendance.filter(a=>a.meal===type);
        openPremiumReportWindow({
          title:`${type[0].toUpperCase()+type.slice(1)} Attendance`,
          subtitle:`Attendance for ${reportDateOnly(today)}`,
          summary:[{label:"Present",value:selected.length}],
          columns:[
            {label:"Student",value:r=>r.studentName||sm.get(String(r.studentId||""))?.studentName||"—"},
            {label:"Student ID",value:"studentId"},
            {label:"Room / Bed",value:r=>roomBed(sm.get(String(r.studentId||""))||{})},
            {label:"Status",value:r=>r.status||"present"},
            {label:"Marked At",value:r=>reportDateTime(r.createdAt)}
          ],rows:selected,emptyText:`No ${type} attendance marked.`
        });
      }else if(type==="outside"){
        const movements=(await listInstituteMovements(i.instituteCode)).filter(m=>m.status==="outside");
        openPremiumReportWindow({
          title:"Currently Outside",
          subtitle:"Residents currently outside the institute.",
          summary:[{label:"Outside Now",value:movements.length}],
          columns:[
            {label:"Resident",value:r=>r.studentName||r.studentId||"—"},
            {label:"Student ID",value:"studentId"},
            {label:"Reason",value:r=>r.reason||"—"},
            {label:"Where",value:r=>r.location||"—"},
            {label:"Left",value:r=>`${r.leavingDate||""} ${r.leavingTime||""}`.trim()||"—"},
            {label:"Expected Return",value:r=>`${r.returnDate||""} ${r.returnTime||""}`.trim()||"—"}
          ],rows:movements,emptyText:"No residents are currently outside."
        });
      }else if(type==="complaints"){
        const complaints=await listInstituteComplaints(i.instituteCode);
        openPremiumReportWindow({
          title:"Complaints",
          subtitle:"Resident complaint register.",
          summary:[
            {label:"Total",value:complaints.length},
            {label:"Open",value:complaints.filter(c=>!["resolved","rejected"].includes(c.status)).length},
            {label:"Resolved",value:complaints.filter(c=>c.status==="resolved").length}
          ],
          columns:[
            {label:"Resident",value:r=>r.studentName||r.studentId||"—"},
            {label:"Category",value:r=>r.category||"Other"},
            {label:"Subject",value:r=>r.subject||"Complaint"},
            {label:"Complaint",value:r=>r.details||"—"},
            {label:"Status",value:r=>r.status||"submitted"},
            {label:"Submitted",value:r=>reportDateTime(r.createdAt)}
          ],rows:complaints,emptyText:"No complaints."
        });
      }
      msg.textContent="Report opened. Use Print / Save PDF in the report window.";msg.className="form-message show success-message";
    }catch(err){
      console.error("PDF report error",err);
      msg.textContent=humanError(err,"Could not prepare report.");msg.className="form-message show error";
    }finally{
      button.disabled=false;button.textContent=old;
    }
  });
}


function renderNewAdmission(message="") {
  const i=state.instituteSession;if(!i){state.screen="institute";return render();}
  const today=new Date().toISOString().slice(0,10), studentId=generateStudentId(i.instituteCode), payment=paymentDetails(), total=Math.max(0,Number(payment.defaultTotalFees||i.defaultTotalFees||state.branding?.defaultTotalFees||0));
  app.innerHTML=shell(`<section class="card admission-card wide-card"><button id="back-portal" class="back">← Institute Portal</button><div class="card-heading"><span class="step success-step">Student onboarding</span><h2>New Admission</h2><p>Payment verification and bed booking for <strong>${esc(i.instituteName)}</strong>.</p></div><form id="admission-form" class="form-grid" novalidate>${field("a-student-id","Student ID","text","Auto generated",studentId,"readonly")}${field("a-student-name","Student Full Name","text","Enter student name")}${field("a-dob","Date of Birth","date","","","max='${today}'")}<label class="field"><span>Gender</span><select id="a-gender"><option value="">Select gender</option><option>Male</option><option>Female</option><option>Other</option></select></label>${field("a-course","Course / Class","text","Example: B.Tech 1st Year")}${field("a-student-phone","Student Phone","tel","Required 10-digit number","","required inputmode='numeric'")}${field("a-parent-name","Parent / Guardian Name","text","Enter parent name")}<label class="field"><span>Relation</span><select id="a-parent-relation"><option>Father</option><option>Mother</option><option>Guardian</option></select></label>${field("a-parent-phone","Parent Phone","tel","Required 10-digit number")}${field("a-joining","Joining Date","date","",today)}<label class="field form-wide"><span>Permanent Address</span><textarea id="a-address"></textarea></label><div class="form-wide fee-box"><h3>Fee Details</h3>${field("a-total-fees","Total Fees","number","0",total,"readonly")}${field("a-paying-now","Amount Paying Now","number","Enter amount",total||"","min='1'")}${field("a-balance","Balance Amount","number","0",0,"readonly")}</div><div class="form-wide bed-booking-box"><h3>Bed Selection</h3><button id="select-admission-bed" type="button" class="secondary">Select Floor, Room & Bed</button><p id="selected-admission-bed">No bed selected</p></div>${paymentBoxHtml(total,true)}<p id="admission-message" class="form-message form-wide ${message?"show error":""}">${esc(message)}</p><button id="admission-submit" class="primary form-wide">Submit for Admin Approval <span>→</span></button></form>${admissionStatusSection()}</section>`,true);
  document.querySelector("#back-portal").onclick=()=>{state.screen="institute-portal";render();};
  const paying=document.querySelector("#a-paying-now"),balance=document.querySelector("#a-balance");const syncAdmissionPayment=()=>{const amount=Math.max(0,Number(paying.value||0));balance.value=Math.max(0,total-amount);const x=document.querySelector("#payment-display-amount");if(x)x.textContent=`₹${amount.toLocaleString("en-IN")}`;};paying.oninput=syncAdmissionPayment;syncAdmissionPayment();
  document.querySelector("#select-admission-bed").onclick=()=>openAdmissionBedSelector();
  bindPaymentActions(()=>Number(paying.value||0),studentId);
  document.querySelector("#admission-form").onsubmit=submitAdmission;
  bindAdmissionStatusForm();
}

function renderManualAdmission(){
  const i=state.instituteSession;if(!i){state.screen="institute";return render();}
  const today=new Date().toISOString().slice(0,10),studentId=generateStudentId(i.instituteCode);
  app.innerHTML=shell(`<section class="card admission-card wide-card"><button id="manual-back" class="back">← Admissions</button><div class="card-heading"><span class="step success-step">Admin admission</span><h2>Manual Admission</h2><p>Create the resident directly. No online payment or approval is required.</p></div><form id="manual-admission-form" class="form-grid" novalidate>${field("m-student-id","Student ID","text","Auto generated",studentId,"readonly")}${field("m-student-name","Student Full Name","text","Enter resident name")}${field("m-dob","Date of Birth","date","","","max='${today}'")}<label class="field"><span>Gender</span><select id="m-gender"><option value="">Select gender</option><option>Male</option><option>Female</option><option>Other</option></select></label>${field("m-course","Course / Class","text","Example: B.Tech 1st Year")}${field("m-student-phone","Student Phone","tel","Required 10-digit number","","required inputmode='numeric'")}${field("m-parent-name","Parent / Guardian Name","text","Enter parent name")}<label class="field"><span>Relation</span><select id="m-parent-relation"><option>Father</option><option>Mother</option><option>Guardian</option></select></label>${field("m-parent-phone","Parent Phone","tel","Required 10-digit number","","required inputmode='numeric'")}${field("m-joining","Joining Date","date","",today)}<label class="field form-wide"><span>Permanent Address</span><textarea id="m-address"></textarea></label><div class="form-wide bed-booking-box"><h3>Bed Selection</h3><button id="select-manual-bed" type="button" class="secondary">Select Floor, Room & Bed</button><p id="selected-admission-bed">No bed selected</p></div><div class="form-wide fee-box"><h3>Manual Fee Entry</h3>${field("m-total-fees","Total Fees","number","0",Number(i.defaultTotalFees||0),"min='0'")}${field("m-paid-now","Amount Received","number","0",0,"min='0'")}<label class="field"><span>Payment Mode</span><select id="m-payment-mode"><option>Cash</option><option>UPI</option><option>Bank Transfer</option><option>Free Admission</option></select></label>${field("m-payment-reference","Receipt / Reference","text","Optional")}</div><p id="manual-admission-message" class="form-message form-wide"></p><button id="manual-admission-submit" class="primary form-wide">Create Resident & Login</button></form></section>`,true);
  document.querySelector("#manual-back").onclick=()=>{state.selectedAdmissionBed=null;state.screen="admissions-home";render();};
  document.querySelector("#select-manual-bed").onclick=()=>openAdmissionBedSelector();
  document.querySelector("#manual-admission-form").onsubmit=async e=>{
    e.preventDefault();
    const v=id=>document.querySelector("#"+id).value.trim(),msg=document.querySelector("#manual-admission-message"),btn=document.querySelector("#manual-admission-submit");
    const studentPhone=v("m-student-phone").replace(/\D/g,""),parentPhone=v("m-parent-phone").replace(/\D/g,"");
    if(!v("m-student-name")||!v("m-gender")||!v("m-parent-name")||!/^\d{10}$/.test(studentPhone)||!/^\d{10}$/.test(parentPhone)){msg.textContent="Complete all required details and enter valid 10-digit phone numbers.";msg.className="form-message show error form-wide";return;}
    if(!state.selectedAdmissionBed){msg.textContent="Select a vacant bed.";msg.className="form-message show error form-wide";return;}
    const totalFee=Math.max(0,Number(v("m-total-fees")||0)),paid=Math.max(0,Number(v("m-paid-now")||0));
    if(paid>totalFee){msg.textContent="Amount Received cannot be greater than Total Fees.";msg.className="form-message show error form-wide";return;}
    btn.disabled=true;btn.textContent="Creating…";
    try{
      const created=await createStudentAdmission({studentId:v("m-student-id"),studentName:v("m-student-name"),dateOfBirth:v("m-dob"),gender:v("m-gender"),courseOrClass:v("m-course"),studentPhone,parentName:v("m-parent-name"),parentRelation:v("m-parent-relation"),parentPhone,emergencyPhone:"",aadhaarLast4:"",joiningDate:v("m-joining"),address:v("m-address"),notes:""},i);
      await allotStudentBed({studentIdValue:created.studentId,roomIdValue:state.selectedAdmissionBed.roomId,bedNumberValue:state.selectedAdmissionBed.bedNumber,instituteCodeValue:i.instituteCode});
      if(totalFee>0){await saveStudentFeePlan({studentId:created.studentId,instituteCode:i.instituteCode,totalFee,dueDate:""});if(paid>0)await recordStudentFeePayment({studentId:created.studentId,instituteCode:i.instituteCode,amount:paid,mode:v("m-payment-mode"),reference:v("m-payment-reference")});}
      state.latestAdmission={...created,...state.selectedAdmissionBed,totalFees:totalFee,amountPayingNow:paid,balanceAmount:Math.max(0,totalFee-paid)};
      state.selectedAdmissionBed=null;state.screen="admission-success";render();
    }catch(err){msg.textContent=`Could not create manual admission. ${humanError(err,err.code||"Unknown error")}`;msg.className="form-message show error form-wide";btn.disabled=false;btn.textContent="Create Resident & Login";}
  };
}

async function openAdmissionBedSelector(){
 const i=state.instituteSession; let rooms=state.rooms.length?state.rooms:await listInstituteRooms(i.instituteCode); state.rooms=rooms;
 const floors=[...new Set(rooms.map(floorKey))];
 openModal({title:"Select Bed",eyebrow:"Floor → Room → Bed",wide:true,content:`<div id="admission-bed-picker"><div class="floor-tabs">${floors.map(f=>`<button type="button" data-afloor="${esc(f)}" class="floor-tab">${esc(f)}</button>`).join("")}</div><div id="admission-room-picker"></div><div id="admission-bed-picker-grid"></div></div><p id="modal-message" class="form-message"></p>`,onReady(){document.querySelectorAll("[data-afloor]").forEach(b=>b.onclick=()=>{const fr=rooms.filter(r=>floorKey(r)===b.dataset.afloor);document.querySelector("#admission-room-picker").innerHTML=fr.map(r=>`<button type="button" class="secondary admission-room-btn" data-aroom="${esc(r.id||r.roomId)}">Room ${esc(r.roomNumber)}</button>`).join("");document.querySelectorAll("[data-aroom]").forEach(rb=>rb.onclick=()=>{const r=rooms.find(x=>(x.id||x.roomId)===rb.dataset.aroom);const beds=(r.beds||[]).filter(x=>bedStatusOf(x)==="vacant"&&x.isVisible!==false);document.querySelector("#admission-bed-picker-grid").innerHTML=`<div class="cinema-bed-grid">${beds.map(x=>`<button type="button" class="cinema-bed vacant" data-abed="${esc(x.bedNumber)}"><span>BED</span><strong>${esc(x.bedNumber)}</strong><small>Vacant</small></button>`).join("")}</div>`;document.querySelectorAll("[data-abed]").forEach(bb=>bb.onclick=()=>{state.selectedAdmissionBed={roomId:r.id||r.roomId,roomNumber:r.roomNumber,floor:r.floor,building:r.building,bedNumber:bb.dataset.abed};closeModal();const p=document.querySelector("#selected-admission-bed");if(p)p.textContent=`${r.floor} · Room ${r.roomNumber} · Bed ${bb.dataset.abed}`;});});});}});
}
async function submitAdmission(event){event.preventDefault();const i=state.instituteSession,m=document.querySelector("#admission-message"),b=document.querySelector("#admission-submit"),v=id=>document.querySelector(`#${id}`).value.trim();const studentPhone=v("a-student-phone").replace(/\D/g,""),parentPhone=v("a-parent-phone").replace(/\D/g,""),totalFees=Number(v("a-total-fees")||0),amountPayingNow=Number(v("a-paying-now")||0),transactionId=v("a-upi-transaction");if(!v("a-student-name")||!v("a-gender")||!v("a-parent-name")){m.textContent="Enter Student Name, Gender and Parent / Guardian Name.";m.className="form-message show error form-wide";return;}if(!/^\d{10}$/.test(studentPhone)||!/^\d{10}$/.test(parentPhone)){m.textContent="Student and Parent phone numbers must contain 10 digits.";m.className="form-message show error form-wide";return;}if(totalFees<=0){m.textContent="Default Total Fees is not configured. Ask the institute admin to save Admission Fees Settings.";m.className="form-message show error form-wide";return;}if(amountPayingNow<=0||amountPayingNow>totalFees){m.textContent="Amount Paying Now must be greater than ₹0 and cannot exceed Total Fees.";m.className="form-message show error form-wide";return;}if(transactionId.length<6){m.textContent="Complete the UPI payment and enter a valid Transaction ID.";m.className="form-message show error form-wide";return;}if(!state.selectedAdmissionBed){m.textContent="Select a vacant bed.";m.className="form-message show error form-wide";return;}const input={studentId:v("a-student-id"),studentName:v("a-student-name"),dateOfBirth:v("a-dob"),gender:v("a-gender"),courseOrClass:v("a-course"),studentPhone,parentName:v("a-parent-name"),parentRelation:v("a-parent-relation"),parentPhone,joiningDate:v("a-joining"),address:v("a-address"),notes:"",totalFees,amountPayingNow,upiTransactionId:transactionId,...state.selectedAdmissionBed};b.disabled=true;b.textContent="Submitting…";try{state.latestAdmission=await submitPendingAdmission(input,i);state.screen="admission-pending";render();}catch(err){m.textContent=`Could not submit admission. ${humanError(err,err.code||"Unknown error")}`;m.className="form-message show error form-wide";b.disabled=false;b.innerHTML="Submit for Admin Approval <span>→</span>";}}
function renderAdmissionPending(){const a=state.latestAdmission;if(!a){state.screen="new-admission";return render();}app.innerHTML=shell(`<section class="card admission-success-card wide-card"><div class="success-check">...</div><span class="step">Payment verification pending</span><h2>${esc(a.studentName)}</h2><p>Application <strong>${esc(a.applicationId)}</strong> was submitted. The selected bed is temporarily reserved.</p><div class="receipt-grid"><article><span>Selected Bed</span><strong>${esc(a.floor)} · Room ${esc(a.roomNumber)} · Bed ${esc(a.bedNumber)}</strong></article><article><span>Total Fees</span><strong>₹${Number(a.totalFees).toLocaleString("en-IN")}</strong></article><article><span>Amount Paying Now</span><strong>₹${Number(a.amountPayingNow).toLocaleString("en-IN")}</strong></article><article><span>Balance Amount</span><strong>₹${Number(a.balanceAmount).toLocaleString("en-IN")}</strong></article></div><button id="pending-portal" class="primary">Return to Institute Portal</button></section>`,true);document.querySelector("#pending-portal").onclick=()=>{state.screen="institute-portal";render();};}
function renderAdmissionSuccess(){
  const a=state.latestAdmission,i=state.instituteSession;
  if(!a){state.screen="new-admission";return render();}
  app.innerHTML=shell(`<section class="card admission-success-card wide-card">
    <div class="success-check">✓</div><span class="step success-step">Admission saved</span><h2>${esc(a.studentName)}</h2><p>Student admission record was created successfully.</p>
    <div class="receipt-grid"><article><span>Student ID</span><strong>${esc(a.studentId)}</strong></article><article><span>Admission ID</span><strong>${esc(a.admissionId)}</strong></article><article><span>Institute</span><strong>${esc(i.instituteName)}</strong></article><article><span>Joining Date</span><strong>${esc(a.joiningDate)}</strong></article><article><span>Parent</span><strong>${esc(a.parentName)}</strong><small>${esc(a.parentPhone)}</small></article><article><span>Status</span><strong>Active student</strong></article></div>
    <section class="student-login-card"><span class="step success-step">Student login created</span><div class="student-login-grid"><article><span>Student ID</span><code>${esc(a.studentId)}</code></article><article><span>Temporary Password</span><code>${esc(a.temporaryPassword)}</code></article></div><p>The student must change this temporary password on first login.</p><button id="copy-student-login" class="secondary" type="button">Copy Student Login</button></section>
    <div class="admission-actions"><button id="print-admission" class="secondary" type="button">Print / Save PDF</button><button id="another-admission" class="primary" type="button">New Admission</button></div>
    <button id="success-portal" class="text-link" type="button">Return to Institute Portal</button>
  </section>`,true);
  document.querySelector("#print-admission").onclick=()=>{const rows=[
    ["Student ID",a.studentId],["Admission ID",a.admissionId],["Student",a.studentName],["Joining Date",a.joiningDate],["Parent / Guardian",a.parentName],["Parent Phone",a.parentPhone],["Room / Bed",`${a.floor||""} · Room ${a.roomNumber||"—"} · Bed ${a.bedNumber||"—"}`],["Total Fees",`₹${Number(a.totalFees||0).toLocaleString("en-IN")}`],["Paid",`₹${Number(a.amountPayingNow||0).toLocaleString("en-IN")}`],["Balance",`₹${Number(a.balanceAmount||0).toLocaleString("en-IN")}`]
  ]; const content=`<div class="grid">${rows.map(r=>`<div class="field"><span>${esc(r[0])}</span><strong>${esc(r[1]||"—")}</strong></div>`).join("")}</div>`;openPremiumDocumentWindow({title:"Admission Confirmation",eyebrow:"ADMISSION DOCUMENT",subtitle:"Official resident admission confirmation",content,result:a,autoPrint:true});};
  document.querySelector("#copy-student-login").onclick=async e=>{const text=`HMOS Student Login\nInstitute: ${i.instituteName}\nStudent: ${a.studentName}\nStudent ID: ${a.studentId}\nTemporary Password: ${a.temporaryPassword}\nPortal: ${location.origin}${location.pathname}`;try{await copyText(text);e.currentTarget.textContent="Copied";}catch{e.currentTarget.textContent="Copy failed";}};
  document.querySelector("#another-admission").onclick=()=>{state.latestAdmission=null;state.screen="new-admission";render();};
  document.querySelector("#success-portal").onclick=()=>{state.latestAdmission=null;state.screen="institute-portal";render();};
}

function dashboardShell(content){return shell(`<section class="card dashboard-card wide-card"><div class="dashboard-head"><div><span class="step success-step">Authorized platform access</span><h2>Super Admin Dashboard</h2><p>${esc(state.authUser?.email||"")}</p></div><button id="logout" class="secondary">Logout</button></div>${content}</section>`,true);}

function filteredInstitutes(){const q=state.search.toLowerCase();return state.institutes.filter(i=>{const status=effectiveStatus(i);const matchesFilter=state.filter==="all"||status===state.filter;const hay=`${i.instituteName||""} ${i.instituteCode||""} ${i.ownerName||""} ${i.ownerPhone||""} ${i.city||""}`.toLowerCase();return matchesFilter&&(!q||hay.includes(q));});}
function metric(status){return state.institutes.filter(i=>effectiveStatus(i)===status).length;}
function instituteRows(){const items=filteredInstitutes();if(!items.length)return `<div class="empty-state"><strong>No matching institutes.</strong><p>Change search/filter or create a new institute.</p></div>`;return `<div class="institute-list">${items.map(i=>{const s=effectiveStatus(i);return `<article class="institute-row pro-row"><div class="avatar">${esc((i.instituteName||"H")[0].toUpperCase())}</div><div class="institute-main"><strong>${esc(i.instituteName)}</strong><span>${esc(i.instituteCode)} · ${esc(i.hostelType||"hostel")} · ${esc(i.city||"No city")}</span><small>${esc(i.ownerName||"")} · ${esc(i.ownerPhone||"")}</small></div><span class="pill ${s}-pill">${s}</span><div class="row-meta"><strong>${Number(i.currentStudents||0)}/${Number(i.studentLimit||0)}</strong><small>Students</small></div><button class="row-menu" data-action="view" data-id="${esc(i.id)}">Manage</button></article>`}).join("")}</div>`;}

function renderAdminDashboard(){const n=consumeNotice();app.innerHTML=dashboardShell(`<div class="metric-grid four"><article><span>Total Institutes</span><strong>${state.institutes.filter(i=>!i.isArchived).length}</strong><small>Registered on HMOS</small></article><article><span>Active</span><strong>${metric("active")}</strong><small>Operational accounts</small></article><article><span>Expired</span><strong>${metric("expired")}</strong><small>Need renewal</small></article><article><span>Archived</span><strong>${metric("archived")}</strong><small>Soft deleted</small></article></div><div class="section-title"><div><h3>Institute Management Pro</h3><p>Search, edit, control access and renew subscriptions.</p></div><button id="open-create" class="primary compact-primary">+ Create Institute</button></div>${n?`<p class="form-message show ${n.type}">${esc(n.message)}</p>`:""}${state.lastCredentials?credentialCard():""}<div class="toolbar"><input id="search" placeholder="Search name, code, owner, phone or city" value="${esc(state.search)}"/><select id="filter"><option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="expired">Expired</option><option value="archived">Archived</option></select></div>${instituteRows()}`);bindCommon();document.querySelector("#open-create").onclick=()=>{state.screen="create";render();};document.querySelector("#search").oninput=e=>{state.search=e.target.value;document.querySelector(".institute-list, .empty-state")?.remove();document.querySelector(".toolbar").insertAdjacentHTML("afterend",instituteRows());bindRowButtons();};document.querySelector("#filter").value=state.filter;document.querySelector("#filter").onchange=e=>{state.filter=e.target.value;renderAdminDashboard();};bindRowButtons();bindCredentialButtons();}
function credentialCard(){const c=state.lastCredentials;return `<div class="credentials-card"><div><span class="step success-step">Institute login generated</span><strong>${esc(c.instituteCode)}</strong><small>${esc(c.instituteName||"")} · ID ${esc(c.instituteId)}</small></div><div class="credential-value"><span>Temporary Password</span><code>${esc(c.temporaryPassword)}</code><small>Valid until ${esc(c.subscriptionEnd)}</small></div><div class="credential-actions"><button id="copy-credentials" class="secondary">Copy</button><button id="share-whatsapp" class="secondary">WhatsApp</button></div></div>`;}
function bindCredentialButtons(){if(!state.lastCredentials)return;const c=state.lastCredentials,text=`HMOS Institute Login\nInstitute: ${c.instituteName||""}\nCode: ${c.instituteCode}\nPassword: ${c.temporaryPassword}\nLogin: ${location.origin}${location.pathname}`;document.querySelector("#copy-credentials").onclick=async e=>{try{await navigator.clipboard.writeText(text);e.target.textContent="Copied";}catch{e.target.textContent="Copy failed";}};document.querySelector("#share-whatsapp").onclick=()=>window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,"_blank","noopener");}
function bindRowButtons(){document.querySelectorAll("[data-action='view']").forEach(b=>b.onclick=()=>{state.selectedId=b.dataset.id;state.screen="manage";render();});}
function bindCommon(){document.querySelector("#logout").onclick=async()=>{await logoutCurrentUser();state.screen="super-admin";state.institutes=[];render();};}

function renderCreate(){app.innerHTML=dashboardShell(`<button id="back-dashboard" class="back">← Dashboard</button><div class="card-heading"><span class="step">Institute onboarding</span><h2>Create Institute</h2><p>Create identity, limits, subscription and portal credentials.</p></div>${instituteForm()}`);bindCommon();document.querySelector("#back-dashboard").onclick=()=>{state.screen="dashboard";render();};bindInstituteForm();}
function instituteForm(i={}){return `<form id="institute-form-pro" class="form-grid"><label class="field"><span>Institute Code</span><div class="input-action"><input id="f-code" value="${esc(i.instituteCode||"")}" placeholder="Auto-generated or enter code" ${i.id?"readonly":""}/>${i.id?"":"<button id='gen-code' class='mini-button' type='button'>Generate</button>"}</div></label>${field("f-name","Institute Name","text","Enter hostel name",i.instituteName||"")}<label class="field"><span>Hostel Type</span><select id="f-type"><option value="boys">Boys Hostel</option><option value="girls">Girls Hostel</option><option value="mixed">Mixed Hostel</option></select></label>${field("f-owner","Owner Name","text","Enter owner name",i.ownerName||"")}${field("f-phone","Owner Phone","tel","10-digit mobile number",i.ownerPhone||"")}${field("f-email","Owner Email","email","Optional email",i.ownerEmail||"")}${field("f-city","City / Town","text","Enter city",i.city||"")}${field("f-limit","Student Limit","number","100",i.studentLimit||100,"min='1'")}${field("f-upi","UPI ID","text","example@upi",i.upiId||"")}${field("f-default-fees","Default Total Fees","number","30000",i.defaultTotalFees||0,"min='0'")}<label class="field form-wide"><span>Address</span><textarea id="f-address" placeholder="Complete address">${esc(i.address||"")}</textarea></label>${i.id?"":`<label class="field"><span>Subscription</span><select id="f-months"><option value="12">1 Year</option><option value="6">6 Months</option><option value="24">2 Years</option></select></label><label class="field"><span>Temporary Password</span><div class="input-action"><input id="f-password"/><button id="gen-password" class="mini-button" type="button">Generate</button></div></label>`}<p id="form-msg" class="form-message form-wide"></p><button id="save-institute" class="primary form-wide">${i.id?"Update Institute":"Save Institute"} <span>→</span></button></form>`;}
function collectForm(){return {instituteCode:document.querySelector("#f-code").value.trim(),instituteName:document.querySelector("#f-name").value.trim(),hostelType:document.querySelector("#f-type").value,ownerName:document.querySelector("#f-owner").value.trim(),ownerPhone:document.querySelector("#f-phone").value.trim(),ownerEmail:document.querySelector("#f-email").value.trim(),city:document.querySelector("#f-city").value.trim(),studentLimit:document.querySelector("#f-limit").value,upiId:document.querySelector("#f-upi").value.trim(),defaultTotalFees:document.querySelector("#f-default-fees").value,address:document.querySelector("#f-address").value.trim(),subscriptionMonths:document.querySelector("#f-months")?.value,temporaryPassword:document.querySelector("#f-password")?.value.trim()};}
function validateInput(x){return x.instituteName&&x.ownerName&&/^\d{10}$/.test(x.ownerPhone)&&Number(x.studentLimit)>0;}
function bindInstituteForm(existing=null){document.querySelector("#f-type").value=existing?.hostelType||"boys";if(!existing){document.querySelector("#f-password").value=generateTemporaryPassword();document.querySelector("#gen-password").onclick=()=>document.querySelector("#f-password").value=generateTemporaryPassword();document.querySelector("#gen-code").onclick=()=>document.querySelector("#f-code").value=generateInstituteCode(document.querySelector("#f-name").value||"HMOS");}document.querySelector("#institute-form-pro").onsubmit=e=>{e.preventDefault();const x=collectForm(),m=document.querySelector("#form-msg"),b=document.querySelector("#save-institute");if(!validateInput(x)||(!existing&&(!x.instituteCode||!x.temporaryPassword))){m.textContent="Complete required fields and enter a valid 10-digit phone number.";m.className="form-message show error form-wide";return;}if(existing){b.disabled=true;b.textContent="Saving…";m.textContent="Saving institute details securely…";m.className="form-message show info form-wide";updateInstitute(existing.id,x,state.authUser.uid,existing).then(updated=>{state.institutes=state.institutes.map(i=>i.id===existing.id?{...i,...updated}:i);writeCache(state.institutes);closeModal();state.screen="dashboard";renderAdminDashboard("Institute saved successfully.","success-message");}).catch(err=>{console.error("HMOS institute save error:",err);const code=err?.code||"unknown-error";m.textContent=`Could not save institute. Error: ${code}`;m.className="form-message show error form-wide";b.disabled=false;b.innerHTML="Update Institute <span>→</span>";});return;}b.disabled=true;b.textContent="Saving…";createInstitute(x,state.authUser.uid).then(created=>{state.institutes=[created,...state.institutes];state.lastCredentials={instituteId:created.instituteId,instituteCode:created.instituteCode,instituteName:created.instituteName,temporaryPassword:created.temporaryPassword,subscriptionEnd:formatDate(created.subscriptionEnd)};writeCache(state.institutes);state.screen="dashboard";render();notify("Institute created successfully.");}).catch(err=>{console.error("HMOS institute create error:",err);const code=err?.code||"unknown-error";m.textContent=`Could not create institute. Error: ${code}`;m.className="form-message show error form-wide";b.disabled=false;b.innerHTML="Save Institute <span>→</span>";});};}


async function copyText(value) {
  const text=String(value||"").trim();
  if(!text) throw new Error("Nothing to copy");
  if(navigator.clipboard && window.isSecureContext){
    try{await navigator.clipboard.writeText(text);return true;}catch(err){console.warn("Clipboard API failed, using fallback.",err);}
  }
  const area=document.createElement("textarea");
  area.value=text;
  area.setAttribute("readonly","");
  area.style.position="fixed";
  area.style.left="-9999px";
  area.style.top="0";
  document.body.appendChild(area);
  area.focus();
  area.select();
  area.setSelectionRange(0,area.value.length);
  const copied=document.execCommand("copy");
  area.remove();
  if(!copied) throw new Error("Copy failed");
  return true;
}
function futureDate(value, months) {
  const current = dateOf(value);
  const base = current && current > new Date() ? new Date(current) : new Date();
  base.setMonth(base.getMonth() + Number(months || 12));
  return base;
}
function closeModal() {
  document.querySelector("#hmos-modal")?.remove();
  document.body.classList.remove("modal-open");
}
function openModal({ title, eyebrow = "Institute action", content = "", tone = "default", wide = false, onReady }) {
  closeModal();
  document.body.insertAdjacentHTML("beforeend", `<div id="hmos-modal" class="modal-layer" role="presentation">
    <section class="modal-card ${tone === "danger" ? "danger-modal" : ""} ${wide ? "modal-wide" : ""}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-head"><div><span class="step">${esc(eyebrow)}</span><h3 id="modal-title">${esc(title)}</h3></div><button id="modal-close" class="modal-close" type="button" aria-label="Close">×</button></div>
      <div class="modal-body">${content}</div>
    </section></div>`);
  document.body.classList.add("modal-open");
  const layer = document.querySelector("#hmos-modal");
  layer.onclick = event => { if (event.target === layer) closeModal(); };
  document.querySelector("#modal-close").onclick = closeModal;
  document.addEventListener("keydown", function escapeOnce(event) { if (event.key === "Escape") { closeModal(); document.removeEventListener("keydown", escapeOnce); } });
  onReady?.(layer);
}
function modalMessage(text, type = "error") {
  const el = document.querySelector("#modal-message");
  if (!el) return;
  el.textContent = text;
  el.className = `form-message show ${type === "success" ? "success-message" : "error"}`;
}
function setActionBusy(button, busy, label = "Working…") {
  if (!button) return;
  if (busy) {
    button.dataset.original = button.innerHTML;
    button.disabled = true;
    button.textContent = label;
  } else {
    button.disabled = false;
    button.innerHTML = button.dataset.original || button.innerHTML;
  }
}
function loginText(i, password = "") {
  return `HMOS Institute Login\nInstitute: ${i.instituteName}\nCode: ${i.instituteCode}${password ? `\nTemporary Password: ${password}` : ""}\nPortal: ${location.origin}${location.pathname}`;
}
function showCredentialsModal(i, password) {
  openModal({ title: "New Login Credentials", eyebrow: "Password reset successful", content: `
    <div class="success-panel"><span>Institute</span><strong>${esc(i.instituteName)}</strong></div>
    <div class="credential-modal-grid"><article><span>Institute Code</span><code>${esc(i.instituteCode)}</code></article><article><span>Temporary Password</span><code>${esc(password)}</code></article></div>
    <p class="modal-note">This password is shown now for secure sharing. The institute must change it on first login.</p>
    <div class="modal-actions"><button id="copy-new-login" class="secondary" type="button">Copy Login</button><button id="share-new-login" class="primary" type="button">Share on WhatsApp</button></div>`,
    onReady() {
      document.querySelector("#copy-new-login").onclick = async () => { await copyText(loginText(i, password)); modalMessage("Login details copied.", "success"); };
      document.querySelector("#share-new-login").onclick = () => window.open(`https://wa.me/?text=${encodeURIComponent(loginText(i, password))}`, "_blank", "noopener");
      document.querySelector(".modal-body").insertAdjacentHTML("beforeend", '<p id="modal-message" class="form-message"></p>');
    }
  });
}

function selected(){return state.institutes.find(i=>i.id===state.selectedId);}
function renderManage(){
  const i=selected();
  if(!i){ state.screen="dashboard"; return render(); }
  const s=effectiveStatus(i);
  const ownerContact=[i.ownerPhone,i.ownerEmail].filter(Boolean).map(esc).join(" · ") || "No contact details";
  const locationTitle=i.city ? esc(i.city) : "—";
  const locationSub=i.address ? esc(i.address) : "No address";
  const subscriptionEnd=formatDate(i.subscriptionEnd);
  const subscriptionText=isExpired(i) ? "Expired — renewal required" : "Active plan";

  app.innerHTML=dashboardShell(`
    <div class="manage-page" data-institute-id="${esc(i.id)}">
      <button id="back-dashboard" class="back manage-back" type="button">← Dashboard</button>
      <section class="manage-head">
        <div class="avatar large">${esc((i.instituteName||"H")[0].toUpperCase())}</div>
        <div class="manage-title"><span class="step">Institute management</span><h2>${esc(i.instituteName)}</h2><p>${esc(i.instituteCode)} · ${esc(i.instituteId||i.id)}</p></div>
        <span class="pill ${s}-pill">${s}</span>
      </section>
      <section class="detail-grid" aria-label="Institute details">
        <article><span>Owner</span><strong>${esc(i.ownerName||"—")}</strong><small>${ownerContact}</small></article>
        <article><span>Location</span><strong>${locationTitle}</strong><small>${locationSub}</small></article>
        <article><span>Student Capacity</span><strong>${Number(i.currentStudents||0)} / ${Number(i.studentLimit||0)}</strong><small>Current / Limit</small></article>
        <article><span>Subscription End</span><strong>${subscriptionEnd}</strong><small>${subscriptionText}</small></article>
      </section>
      <section class="action-grid" aria-label="Institute actions">
        <button id="edit" class="action-button" type="button">✏️ <span>Edit Details</span></button>
        <button id="toggle" class="action-button" type="button">${i.status==="active"?"⏸":"▶"} <span>${i.status==="active"?"Deactivate":"Activate"}</span></button>
        <button id="reset" class="action-button" type="button">🔐 <span>Reset Password</span></button>
        <button id="renew" class="action-button" type="button">🔄 <span>Renew Plan</span></button>
        <button id="share" class="action-button" type="button">💬 <span>Share Login</span></button>
        <button id="archive" class="action-button danger-action" type="button">${i.isArchived?"↩":"🗄"} <span>${i.isArchived?"Restore":"Archive"}</span></button>
      </section>
      <p id="manage-msg" class="form-message"></p>
    </div>`);

  bindCommon();
  document.querySelector("#back-dashboard").onclick=()=>{state.screen="dashboard";render();};

  document.querySelector("#edit").onclick=()=>openModal({
    title:`Edit ${i.instituteName}`, eyebrow:"Institute details", wide:true,
    content:`<p class="modal-intro">Update owner, location, hostel type and student capacity.</p>${instituteForm(i)}`,
    onReady(){ bindInstituteForm(i); }
  });

  document.querySelector("#toggle").onclick=()=>{
    const next=i.status==="active"?"inactive":"active";
    openModal({title:`${next==="active"?"Activate":"Deactivate"} Institute`,eyebrow:"Portal access",tone:next==="inactive"?"danger":"default",content:`
      <div class="confirm-icon">${next==="active"?"▶":"⏸"}</div><p class="confirm-copy">${next==="active"?"Institute login access will be restored.":"Institute login will be blocked until you activate it again."}</p>
      <p id="modal-message" class="form-message"></p><div class="modal-actions"><button class="secondary" id="cancel-action" type="button">Cancel</button><button class="primary ${next==="inactive"?"danger-primary":""}" id="confirm-action" type="button">${next==="active"?"Activate":"Deactivate"}</button></div>`,
      onReady(){document.querySelector("#cancel-action").onclick=closeModal;document.querySelector("#confirm-action").onclick=async e=>{const b=e.currentTarget;setActionBusy(b,true,"Updating…");try{await setInstituteStatus(i.id,next,state.authUser.uid);i.status=next;writeCache(state.institutes);closeModal();notify(`Institute ${next}.`);state.screen="dashboard";render();}catch(err){modalMessage("Could not update portal access.");setActionBusy(b,false);}};}
    });
  };

  document.querySelector("#reset").onclick=()=>{
    let password=generateTemporaryPassword();
    openModal({title:"Reset Institute Password",eyebrow:"Security action",content:`
      <p class="modal-intro">Generate a temporary password for <strong>${esc(i.instituteName)}</strong>.</p>
      <label class="field"><span>New Temporary Password</span><div class="input-action"><input id="reset-password-value" value="${esc(password)}"/><button id="regenerate-password" class="mini-button" type="button">Generate</button></div></label>
      <label class="check confirm-check"><input id="password-confirm" type="checkbox"/><span>I understand the old password will stop working immediately.</span></label>
      <p id="modal-message" class="form-message"></p><div class="modal-actions"><button class="secondary" id="cancel-reset" type="button">Cancel</button><button class="primary" id="confirm-reset" type="button">Reset Password</button></div>`,
      onReady(){
        document.querySelector("#cancel-reset").onclick=closeModal;
        document.querySelector("#regenerate-password").onclick=()=>{password=generateTemporaryPassword();document.querySelector("#reset-password-value").value=password;};
        document.querySelector("#confirm-reset").onclick=async e=>{password=document.querySelector("#reset-password-value").value.trim();if(password.length<8)return modalMessage("Password must contain at least 8 characters.");if(!document.querySelector("#password-confirm").checked)return modalMessage("Confirm that the old password will stop working.");const b=e.currentTarget;setActionBusy(b,true,"Resetting…");try{const saved=await resetInstitutePassword(i.id,password,state.authUser.uid);state.lastCredentials={instituteId:i.instituteId,instituteCode:i.instituteCode,instituteName:i.instituteName,temporaryPassword:saved,subscriptionEnd:formatDate(i.subscriptionEnd)};closeModal();showCredentialsModal(i,saved);}catch(err){modalMessage("Could not reset the password.");setActionBusy(b,false);}};
      }
    });
  };

  document.querySelector("#renew").onclick=()=>openModal({title:"Renew Subscription",eyebrow:"Plan renewal",content:`
    <p class="modal-intro">Current end date: <strong>${formatDate(i.subscriptionEnd)}</strong></p>
    <div class="plan-options"><label><input type="radio" name="renew-months" value="6"><span><strong>6 Months</strong><small>Until ${futureDate(i.subscriptionEnd,6).toLocaleDateString("en-IN")}</small></span></label><label class="selected-plan"><input type="radio" name="renew-months" value="12" checked><span><strong>1 Year</strong><small>Until ${futureDate(i.subscriptionEnd,12).toLocaleDateString("en-IN")}</small></span></label><label><input type="radio" name="renew-months" value="24"><span><strong>2 Years</strong><small>Until ${futureDate(i.subscriptionEnd,24).toLocaleDateString("en-IN")}</small></span></label></div>
    <p id="modal-message" class="form-message"></p><div class="modal-actions"><button class="secondary" id="cancel-renew" type="button">Cancel</button><button class="primary" id="confirm-renew" type="button">Renew Subscription</button></div>`,
    onReady(){document.querySelector("#cancel-renew").onclick=closeModal;document.querySelectorAll('input[name="renew-months"]').forEach(r=>r.onchange=()=>{document.querySelectorAll(".plan-options label").forEach(x=>x.classList.remove("selected-plan"));r.closest("label").classList.add("selected-plan");});document.querySelector("#confirm-renew").onclick=async e=>{const months=Number(document.querySelector('input[name="renew-months"]:checked').value);const b=e.currentTarget;setActionBusy(b,true,"Renewing…");try{const end=await renewSubscription(i.id,months,state.authUser.uid);i.subscriptionEnd=end;i.status="active";i.subscriptionStatus="active";writeCache(state.institutes);closeModal();notify(`Subscription renewed until ${end.toLocaleDateString("en-IN")}.`);state.screen="dashboard";render();}catch(err){modalMessage("Could not renew subscription.");setActionBusy(b,false);}};}
  });

  document.querySelector("#share").onclick=()=>{
    const known=state.lastCredentials?.instituteCode===i.instituteCode?state.lastCredentials.temporaryPassword:"";
    const text=loginText(i,known);
    openModal({title:"Share Institute Login",eyebrow:"Login credentials",content:`<div class="credential-modal-grid"><article><span>Institute Code</span><code>${esc(i.instituteCode)}</code></article><article><span>Password</span><code>${known?esc(known):"Hidden for security"}</code></article></div>${known?"":'<p class="modal-note warning-note">The current password cannot be recovered. Reset it first to share a new password.</p>'}<p id="modal-message" class="form-message"></p><div class="modal-actions"><button id="copy-login-modal" class="secondary" type="button">Copy Details</button><button id="whatsapp-login-modal" class="primary" type="button">WhatsApp</button></div>`,onReady(){document.querySelector("#copy-login-modal").onclick=async()=>{await copyText(text);modalMessage("Login details copied.","success");};document.querySelector("#whatsapp-login-modal").onclick=()=>window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,"_blank","noopener");}});
  };

  document.querySelector("#archive").onclick=()=>{
    const restoring=Boolean(i.isArchived);
    openModal({title:restoring?"Restore Institute":"Archive Institute",eyebrow:"Institute lifecycle",tone:restoring?"default":"danger",content:`<div class="confirm-icon">${restoring?"↩":"🗄"}</div><p class="confirm-copy">${restoring?"The institute will return to active status and portal access will be restored.":"The institute will be hidden from active operations and its login will be blocked. Data will not be permanently deleted."}</p>${restoring?"":`<label class="field"><span>Type ARCHIVE to confirm</span><input id="archive-word" autocomplete="off" placeholder="ARCHIVE"/></label>`}<p id="modal-message" class="form-message"></p><div class="modal-actions"><button class="secondary" id="cancel-archive" type="button">Cancel</button><button class="primary ${restoring?"":"danger-primary"}" id="confirm-archive" type="button">${restoring?"Restore":"Archive"}</button></div>`,onReady(){document.querySelector("#cancel-archive").onclick=closeModal;document.querySelector("#confirm-archive").onclick=async e=>{if(!restoring&&document.querySelector("#archive-word").value.trim().toUpperCase()!=="ARCHIVE")return modalMessage("Type ARCHIVE to continue.");const b=e.currentTarget;setActionBusy(b,true,restoring?"Restoring…":"Archiving…");try{if(restoring){await restoreInstitute(i.id,state.authUser.uid);i.isArchived=false;i.status="active";}else{await archiveInstitute(i.id,state.authUser.uid);i.isArchived=true;i.status="inactive";}writeCache(state.institutes);closeModal();notify(i.isArchived?"Institute archived safely.":"Institute restored successfully.");state.screen="dashboard";render();}catch(err){modalMessage(restoring?"Could not restore institute.":"Could not archive institute.");setActionBusy(b,false);}};}});
  };
}
function renderEdit(){const i=selected();if(!i){state.screen="dashboard";return render();}app.innerHTML=dashboardShell(`<button id="back-manage" class="back">← Manage Institute</button><div class="card-heading"><span class="step">Edit institute</span><h2>${esc(i.instituteName)}</h2><p>Update owner, location and capacity details.</p></div>${instituteForm(i)}`);bindCommon();document.querySelector("#back-manage").onclick=()=>{state.screen="manage";render();};bindInstituteForm(i);}


const STUDENT_SESSION_KEY = "hmosStudentSessionV400";
function saveStudentSession(session){ try{ sessionStorage.setItem(STUDENT_SESSION_KEY, JSON.stringify(session)); }catch{} }
function clearStudentSession(){ try{sessionStorage.removeItem(STUDENT_SESSION_KEY);}catch{} state.studentSession=null; state.studentCurrentPassword=""; }

function renderStudentLogin(message=""){
  app.innerHTML=shell(`<section class="card login-card"><button id="back-institute-portal" class="back" type="button">← Institute Portal</button><div class="card-heading"><span class="step">Student access</span><h2>Student Login</h2><p>Use the Student ID and password issued during admission.</p></div><form id="student-login-form">${field("student-login-id","Student ID","text","Enter Student ID","","autocomplete='username'")}${field("student-login-password","Password","password","Enter password","","autocomplete='current-password'")}<p id="student-login-message" class="form-message ${message?"show error":""}">${esc(message)}</p><button id="student-login-submit" class="primary" type="submit">Login <span>→</span></button><p class="student-forgot-note">Forgot password? Contact your Institute Admin.</p></form></section>`,true);
  document.querySelector("#back-institute-portal").onclick=()=>{state.screen="institute-portal";render();};
  document.querySelector("#student-login-form").onsubmit=async e=>{e.preventDefault();const id=document.querySelector("#student-login-id").value,password=document.querySelector("#student-login-password").value,m=document.querySelector("#student-login-message"),b=document.querySelector("#student-login-submit");b.disabled=true;b.textContent="Checking…";try{state.studentSession=await loginStudent(id,password);state.studentCurrentPassword=password;if(state.studentSession.mustChangePassword)state.screen="student-password-change";else{saveStudentSession(state.studentSession);state.screen="student-dashboard";}render();}catch(err){const messages={"invalid-student-credential":"Incorrect Student ID or password.","student-inactive":"This student account is inactive.","student-profile-missing":"Student profile was not found.","student-login-timeout":"Network is slow. Try again."};m.textContent=messages[err.code]||`Student login failed. ${err.code||""}`;m.className="form-message show error";b.disabled=false;b.innerHTML="Login <span>→</span>";}};
}

function renderStudentPasswordChange(){const s=state.studentSession;if(!s){state.screen="student-login";return render();}app.innerHTML=shell(`<section class="card login-card"><span class="step">First login security</span><h2>Create New Password</h2><p class="blocked-copy">For <strong>${esc(s.studentName||s.studentId)}</strong>.</p><form id="student-password-form">${field("student-new-password","New Password","password","Minimum 10 characters","","autocomplete='new-password'")}${field("student-confirm-password","Confirm Password","password","Re-enter password","","autocomplete='new-password'")}<div class="password-rules"><span>✓ Uppercase</span><span>✓ Lowercase</span><span>✓ Number</span><span>✓ Special character</span></div><p id="student-password-message" class="form-message"></p><button id="student-password-submit" class="primary" type="submit">Save & Continue <span>→</span></button></form><button id="cancel-student-login" class="text-link" type="button">Cancel Student Login</button></section>`,true);document.querySelector("#cancel-student-login").onclick=()=>{clearStudentSession();state.screen="student-login";render();};document.querySelector("#student-password-form").onsubmit=async e=>{e.preventDefault();const n=document.querySelector("#student-new-password").value,c=document.querySelector("#student-confirm-password").value,m=document.querySelector("#student-password-message"),b=document.querySelector("#student-password-submit");if(n!==c){m.textContent="Passwords do not match.";m.className="form-message show error";return;}b.disabled=true;b.textContent="Saving…";try{await changeStudentPassword(s.studentId,state.studentCurrentPassword,n);state.studentCurrentPassword="";state.studentSession={...s,mustChangePassword:false};saveStudentSession(state.studentSession);state.screen="student-dashboard";render();}catch(err){const messages={"weak-student-password":"Use 10+ characters with uppercase, lowercase, number and special character.","permission-denied":"Password change is blocked by Firestore Rules.","invalid-student-credential":"Temporary password no longer matches.","student-password-timeout":"Network is slow. Try again."};m.textContent=messages[err.code]||`Could not change password. ${err.code||""}`;m.className="form-message show error";b.disabled=false;b.innerHTML="Save & Continue <span>→</span>";}};}

function studentPortalCard(id,icon,title,sub){return `<button id="${id}" class="student-home-card"><div><strong>${title}</strong><small>${sub}</small></div><b>›</b></button>`;}
function renderStudentDashboard(){const s=state.studentSession;if(!s){state.screen="student-login";return render();}app.innerHTML=shell(`<section class="card portal-card wide-card compact-page"><div class="compact-profile-head"><div class="portal-logo">${esc((s.studentName||"S")[0].toUpperCase())}</div><div><span class="step success-step">Student portal</span><h2>${esc(s.studentName||"Student")}</h2><p>${esc(s.studentId)} · ${esc(s.courseOrClass||"")}</p></div><button id="student-logout" class="secondary compact-button">Logout</button></div><div class="student-home-grid">${studentPortalCard("student-profile-card","","Profile","Admission details & PDF")}${studentPortalCard("student-fees-card","","Fees","Payments, balance & due date")}${studentPortalCard("student-attendance-card","","Attendance","Breakfast, lunch & dinner")}${studentPortalCard("student-entry-card","","Entry / Exit","Submit movement details")}${studentPortalCard("student-complaints-card","","Complaints","Send and track complaints")}${studentPortalCard("student-menu-card","","Today Menu","Breakfast, lunch & dinner")}${studentPortalCard("student-notifications-card","","Notifications","Approvals, fees and reminders")}</div></section>`,true);document.querySelector("#student-logout").onclick=()=>{clearStudentSession();state.screen="institute-portal";render();};document.querySelector("#student-profile-card").onclick=()=>{state.screen="student-profile";render();};document.querySelector("#student-fees-card").onclick=()=>{state.screen="student-fees";render();};document.querySelector("#student-attendance-card").onclick=()=>{state.screen="student-attendance";render();};document.querySelector("#student-entry-card").onclick=()=>{state.screen="student-entry-exit";render();};document.querySelector("#student-complaints-card").onclick=()=>{state.screen="student-complaints";render();};document.querySelector("#student-menu-card").onclick=()=>{state.screen="student-menu";render();};document.querySelector("#student-notifications-card").onclick=()=>{state.screen="student-notifications";render();};}
function studentBack(title="Student Home"){return `<button id="student-page-back" class="back">← ${title}</button>`;}
function bindStudentBack(){document.querySelector("#student-page-back").onclick=()=>{state.screen="student-dashboard";render();};}
function renderStudentProfile(){const s=state.studentSession;if(!s)return renderStudentLogin();const rows=[["Student ID",s.studentId],["Full Name",s.studentName],["Date of Birth",s.dateOfBirth],["Gender",s.gender],["Course / Class",s.courseOrClass],["Phone",s.studentPhone],["Parent / Guardian",s.parentName],["Parent Phone",s.parentPhone],["Address",s.address],["Joining Date",s.joiningDate],["Room",s.roomNumber?`Room ${s.roomNumber}`:"Not allotted"],["Bed",s.bedNumber?`Bed ${s.bedNumber}`:"No bed"]];app.innerHTML=shell(`<section class="card dashboard-card wide-card compact-page">${studentBack()}<div class="compact-heading"><h2>Profile</h2><p>Complete admission information.</p></div><div class="profile-detail-list">${rows.map(r=>`<article><span>${r[0]}</span><strong>${esc(r[1]||"—")}</strong></article>`).join("")}</div><button id="profile-pdf" class="primary">Print / Save Admission PDF</button></section>`,true);bindStudentBack();document.querySelector("#profile-pdf").onclick=()=>{const content=`<div class="grid">${rows.map(r=>`<div class="field"><span>${esc(r[0])}</span><strong>${esc(r[1]||"—")}</strong></div>`).join("")}</div>`;openPremiumDocumentWindow({title:"Admission Profile",eyebrow:"STUDENT RECORD",subtitle:"Resident admission and profile information",content,result:s,autoPrint:true});};}
async function renderStudentFees(){const s=state.studentSession;if(!s)return renderStudentLogin();const b=await getInstituteBranding(s.instituteCode).catch(()=>null);if(b)state.branding=b;app.innerHTML=shell(`<section class="card dashboard-card wide-card compact-page">${studentBack()}<div class="compact-heading"><h2>Fees</h2><p>View payment history and pay the outstanding balance.</p></div><div class="mini-stat-grid"><article><span>Total</span><strong>₹${Number(s.feeTotal||0).toLocaleString("en-IN")}</strong></article><article><span>Paid</span><strong>₹${Number(s.feePaid||0).toLocaleString("en-IN")}</strong></article><article><span>Balance</span><strong>₹${Number(s.feeBalance||0).toLocaleString("en-IN")}</strong></article></div>${paymentBoxHtml(Number(s.feeBalance||0),false)}<div id="student-payment-history" class="compact-section"></div><form id="student-fee-pay-form" class="compact-form">${field("student-pay-amount","Amount to Pay","number","Enter amount",Number(s.feeBalance||0)>0?s.feeBalance:"","min='1'")}${field("student-pay-reference","UPI Transaction ID","text","Enter after payment")}<p class="form-message form-wide" id="student-pay-message"></p><button class="primary form-wide">Submit Payment for Approval</button></form></section>`,true);bindStudentBack();const amountInput=document.querySelector('#student-pay-amount');bindPaymentActions(()=>Number(amountInput.value||0),`${s.studentId} Fee Payment`);amountInput.oninput=()=>{const x=document.querySelector('#payment-display-amount');if(x)x.textContent=`₹${Number(amountInput.value||0).toLocaleString('en-IN')}`;};try{const p=await listStudentPayments(s.studentId);document.querySelector("#student-payment-history").innerHTML=`<h3>Payment History</h3>${p.map(x=>`<article class="compact-list-row"><div><strong>₹${Number(x.amount||0).toLocaleString("en-IN")}</strong><span>${esc(x.mode||"UPI")} · ${esc(x.receiptNo||x.reference||"")}</span><small>${esc(x.status||"approved")}</small></div></article>`).join("")||'<p>No payments yet.</p>'}`;}catch{}
 document.querySelector("#student-fee-pay-form").onsubmit=async e=>{e.preventDefault();const amount=Number(amountInput.value||0),reference=document.querySelector("#student-pay-reference").value.trim(),m=document.querySelector("#student-pay-message"),btn=e.submitter;if(amount<=0||!reference){m.textContent="Enter payment amount and UPI Transaction ID.";m.className="form-message show error form-wide";return;}if(Number(s.feeBalance||0)>0&&amount>Number(s.feeBalance||0)){m.textContent="Amount cannot be greater than the outstanding balance.";m.className="form-message show error form-wide";return;}btn.disabled=true;btn.textContent="Submitting…";try{await submitStudentFeePaymentRequest({studentId:s.studentId,studentName:s.studentName,instituteCode:s.instituteCode,amount,reference});m.textContent="Payment submitted for Admin verification.";m.className="form-message show success-message form-wide";e.target.reset();}catch(err){m.textContent=`Could not submit payment. ${humanError(err,err.code||'Unknown error')}`;m.className="form-message show error form-wide";}finally{btn.disabled=false;btn.textContent="Submit Payment for Approval";}};}


function mealWindow(meal){
  const now=new Date();
  const date=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  const minutes=now.getHours()*60+now.getMinutes();
  const windows={
    breakfast:{start:5*60,end:10*60+30,label:"05:00 – 10:30"},
    lunch:{start:11*60,end:15*60+30,label:"11:00 – 15:30"},
    dinner:{start:18*60,end:22*60+30,label:"18:00 – 22:30"},
    night:{start:20*60,end:23*60+59,label:"20:00 – 23:59"}
  };
  const w=windows[String(meal||"").toLowerCase()]||{start:0,end:0,label:"Unavailable"};
  return {date,label:w.label,open:minutes>=w.start&&minutes<=w.end};
}

async function renderStudentAttendance(){
  const s=state.studentSession;if(!s)return renderStudentLogin();
  const meals=["breakfast","lunch","dinner","night"];
  const labels={breakfast:"Breakfast",lunch:"Lunch",dinner:"Dinner",night:"Night Present"};
  const windows=Object.fromEntries(meals.map(meal=>[meal,mealWindow(meal)]));

  app.innerHTML=shell(`<section class="card dashboard-card wide-card compact-page">${studentBack()}<div class="compact-heading"><span class="step">Daily attendance</span><h2>Attendance</h2><p>Mark today’s meal or night attendance during the available time window.</p></div><div class="meal-card-grid">${meals.map(meal=>{const w=windows[meal];return `<article class="meal-card"><div><strong>${labels[meal]}</strong><small>Today · ${w.label}</small></div><button type="button" class="${w.open?"primary":"secondary"} compact-button" data-meal="${meal}" ${w.open?"":"disabled"}>${w.open?"Mark Attendance":"Closed"}</button><p id="meal-status-${meal}" class="meal-inline-status">${w.open?"Available now":"Outside attendance time"}</p></article>`}).join("")}</div><p id="attendance-page-message" class="form-message"></p></section>`,true);
  bindStudentBack();

  for(const meal of meals){
    const w=windows[meal];
    const button=document.querySelector(`[data-meal="${meal}"]`);
    const status=document.querySelector(`#meal-status-${meal}`);
    if(!button)continue;

    try{
      const existing=await getStudentMealAttendance(s.studentId,w.date,meal);
      if(existing){
        button.disabled=true;
        button.textContent="Attendance Marked";
        status.textContent="Marked for today";
        status.classList.add("marked");
      }
    }catch(err){
      console.warn("Attendance read failed:",meal,err);
    }

    if(button.disabled)continue;
    button.onclick=async()=>{
      button.disabled=true;
      button.textContent="Saving…";
      status.textContent="Saving attendance…";
      try{
        await submitMealAttendance({
          studentId:s.studentId,studentName:s.studentName,
          instituteCode:s.instituteCode,date:w.date,meal
        });
        button.textContent="Attendance Marked";
        status.textContent="Marked for today";
        status.classList.add("marked");
      }catch(err){
        button.disabled=false;
        button.textContent="Try Again";
        status.textContent=humanError(err,"Could not mark attendance.");
        status.classList.add("error");
      }
    };
  }
}
async function renderStudentEntryExit(){
  const s=state.studentSession;if(!s)return renderStudentLogin();
  const now=new Date();
  const today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  const nowTime=`${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
  app.innerHTML=shell(`<section class="card dashboard-card wide-card compact-page">${studentBack()}<div class="compact-heading"><span class="step">Movement request</span><h2>Entry / Exit</h2><p>Fill the trip details. Your current GPS location is shared only when you submit.</p></div><form id="student-exit-form" class="compact-form">${field("exit-reason","Reason","text","Reason for going out")}${field("exit-location","Where","text","Where are you going?")}${field("exit-date","Leaving Date","date","",today)}${field("exit-time","Leaving Time","time","",nowTime)}${field("return-date","Expected Return Date","date","",today)}${field("return-time","Expected Return Time","time")}<div class="form-wide movement-location-note"><strong>📍 Location sharing</strong><span id="movement-location-status">Tap the button below to share your current location and submit.</span></div><p id="exit-message" class="form-message form-wide"></p><button id="share-location-submit" class="primary form-wide" type="submit">Share Location + Submit</button></form><div id="movement-history" class="compact-section"></div></section>`,true);
  bindStudentBack();

  try{
    const rows=await getStudentMovements(s.studentId);
    document.querySelector("#movement-history").innerHTML=`<h3>History</h3>${rows.slice(0,10).map(x=>`<article class="compact-list-row"><div><strong>${esc(x.status||"outside")}</strong><span>${esc(x.reason||"")} · ${esc(x.location||"")}</span><small>${esc(x.leavingDate||"")} ${esc(x.leavingTime||"")} → ${esc(x.returnDate||"")} ${esc(x.returnTime||"")}${x.actualReturnAt?` · Returned`:""}</small></div></article>`).join("")||'<div class="empty-state compact-empty"><strong>No movement history.</strong></div>'}`;
  }catch{}

  document.querySelector("#student-exit-form").onsubmit=async e=>{
    e.preventDefault();
    const v=id=>document.querySelector(`#${id}`).value.trim();
    const msg=document.querySelector("#exit-message"),status=document.querySelector("#movement-location-status"),btn=document.querySelector("#share-location-submit");
    if(["exit-reason","exit-location","exit-date","exit-time","return-date","return-time"].some(id=>!v(id))){
      msg.textContent="Complete all fields first.";msg.className="form-message show error form-wide";return;
    }
    const leave=new Date(`${v("exit-date")}T${v("exit-time")}`);
    const expected=new Date(`${v("return-date")}T${v("return-time")}`);
    if(Number.isNaN(leave.getTime())||Number.isNaN(expected.getTime())||expected<=leave){
      msg.textContent="Expected return must be after leaving time.";msg.className="form-message show error form-wide";return;
    }
    if(!navigator.geolocation){
      msg.textContent="Location sharing is not supported on this device.";msg.className="form-message show error form-wide";return;
    }

    btn.disabled=true;btn.textContent="Getting Location…";status.textContent="Requesting current GPS location…";
    navigator.geolocation.getCurrentPosition(async pos=>{
      try{
        status.textContent=`Location shared · accuracy about ${Math.round(pos.coords.accuracy||0)} m`;
        btn.textContent="Submitting…";
        await submitMovementRequest({
          studentId:s.studentId,studentName:s.studentName,instituteCode:s.instituteCode,
          reason:v("exit-reason"),location:v("exit-location"),
          leavingDate:v("exit-date"),leavingTime:v("exit-time"),
          returnDate:v("return-date"),returnTime:v("return-time"),
          latitude:pos.coords.latitude,longitude:pos.coords.longitude,
          locationAccuracy:Math.round(pos.coords.accuracy||0)
        });
        msg.textContent="Exit submitted successfully with location.";msg.className="form-message show success-message form-wide";
        btn.textContent="Submitted";
        setTimeout(()=>renderStudentEntryExit(),700);
      }catch(err){
        msg.textContent=humanError(err,"Could not submit exit.");msg.className="form-message show error form-wide";
        btn.disabled=false;btn.textContent="Share Location + Submit";
      }
    },err=>{
      status.textContent="Location was not shared.";
      msg.textContent=err.code===1?"Location permission denied. Allow location access and try again.":"Could not get current location. Turn on GPS and try again.";
      msg.className="form-message show error form-wide";
      btn.disabled=false;btn.textContent="Share Location + Submit";
    },{enableHighAccuracy:true,timeout:15000,maximumAge:15000});
  };
}
async function renderStudentComplaints(){const s=state.studentSession;if(!s)return renderStudentLogin();app.innerHTML=shell(`<section class="card dashboard-card wide-card compact-page">${studentBack()}<div class="compact-heading"><h2>Complaints</h2><p>Send a complaint to the institute admin.</p></div><form id="complaint-form" class="compact-form"><label class="field"><span>Category</span><select id="complaint-category"><option>Room</option><option>Food</option><option>Water</option><option>Electricity</option><option>Cleaning</option><option>Fees</option><option>Staff</option><option>Other</option></select></label>${field("complaint-subject","Subject","text","Short subject")}<label class="field form-wide"><span>Complaint Details</span><textarea id="complaint-details" placeholder="Write your complaint"></textarea></label><p id="complaint-message" class="form-message form-wide"></p><button class="primary form-wide">Submit Complaint</button></form><div id="complaint-history" class="compact-section"></div></section>`,true);bindStudentBack();try{const rows=await listStudentComplaints(s.studentId);document.querySelector("#complaint-history").innerHTML=`<h3>Complaint History</h3>${rows.map(c=>`<article class="compact-list-row"><div><strong>${esc(c.subject)}</strong><span>${esc(c.category)} · ${esc(c.status)}</span><small>${esc(c.details)}</small></div></article>`).join("")||'<p>No complaints yet.</p>'}`;}catch{}
 document.querySelector("#complaint-form").onsubmit=async e=>{e.preventDefault();const msg=document.querySelector("#complaint-message"),details=document.querySelector("#complaint-details").value.trim();if(!details){msg.textContent="Write complaint details.";msg.className="form-message show error form-wide";return;}try{await submitComplaint({studentId:s.studentId,studentName:s.studentName,instituteCode:s.instituteCode,category:document.querySelector("#complaint-category").value,subject:document.querySelector("#complaint-subject").value,details});msg.textContent="Complaint submitted.";msg.className="form-message show success-message form-wide";}catch(err){msg.textContent=`Could not submit. ${err.code||""}`;msg.className="form-message show error form-wide";}};}
async function renderStudentMenu(){const s=state.studentSession;if(!s)return renderStudentLogin();const today=new Date().toISOString().slice(0,10);app.innerHTML=shell(`<section class="card dashboard-card wide-card compact-page">${studentBack()}<div class="compact-heading"><h2>Today Menu</h2><p>${formatDate(today)}</p></div><div id="today-menu" class="menu-detail-grid"><div class="loading-card"><div class="loader"></div></div></div></section>`,true);bindStudentBack();try{const m=await getDailyMenu(s.instituteCode,today);document.querySelector("#today-menu").innerHTML=m?`<article><span>Breakfast</span><strong>${esc(m.breakfast||"Not updated")}</strong></article><article><span>Lunch</span><strong>${esc(m.lunch||"Not updated")}</strong></article><article><span>Dinner</span><strong>${esc(m.dinner||"Not updated")}</strong></article><article><span>Snacks / Special</span><strong>${esc(m.snacks||"—")}</strong></article>`:'<div class="empty-state compact-empty"><strong>Menu not updated yet.</strong></div>';}catch(err){document.querySelector("#today-menu").innerHTML='<p class="form-message show error">Could not load menu.</p>';}}


function studentAdminRows(){
  const q=state.adminStudentSearch.trim().toLowerCase();
  const items=state.adminStudents.filter(s=>!q||`${s.studentName||""} ${s.studentId||""} ${s.parentName||""} ${s.parentPhone||""} ${s.courseOrClass||""}`.toLowerCase().includes(q));
  if(!items.length)return `<div class="empty-state"><strong>No students found.</strong><p>Create an admission or change the search.</p></div>`;
  return `<div class="student-admin-list">${items.map(s=>`<article class="student-admin-row"><div class="avatar">${esc((s.studentName||"S")[0].toUpperCase())}</div><div class="student-admin-main"><strong>${esc(s.studentName||"Student")}</strong><span>${esc(s.studentId)} · ${esc(s.courseOrClass||"Course not set")}</span><small>${esc(s.parentName||"No parent")} · ${esc(s.parentPhone||"No phone")}</small></div><span class="pill ${(s.accountStatus||"active")}-pill">${esc(s.accountStatus||"active")}</span><button class="row-menu" data-student-manage="${esc(s.studentId)}">Manage</button></article>`).join("")}</div>`;
}

async function renderInstituteAdmin(){
  const i=state.instituteSession;if(!i){state.screen="institute";return render();}
  app.innerHTML=shell(`<section class="card dashboard-card wide-card"><div class="dashboard-head"><div><span class="step success-step">Resident records</span><h2>Residents</h2><p>${esc(i.instituteName)} · ${esc(i.instituteCode)}</p></div><button id="admin-back-portal" class="secondary">Institute Portal</button></div><div class="metric-grid"><article><span>Total Students</span><strong id="admin-student-total">—</strong><small>Registered students</small></article><article><span>Active</span><strong id="admin-student-active">—</strong><small>Login enabled</small></article><article><span>Capacity</span><strong>${esc(i.currentStudents||"—")}</strong><small>Institute count</small></article></div><div class="section-title"><div><h3>Residents</h3><p>Search and manage resident details.</p></div><button id="admin-new-admission" class="primary compact-primary">New Admission</button></div><input id="admin-student-search" class="admin-search" placeholder="Search student, ID, parent, phone or course" value="${esc(state.adminStudentSearch)}"/><p id="admin-student-message" class="form-message"></p><div id="admin-student-results"><div class="loading-card"><div class="loader"></div><p>Loading students…</p></div></div></section>`,true);
  document.querySelector("#admin-back-portal").onclick=()=>{state.screen="admin-home";render();};
  document.querySelector("#admin-new-admission").onclick=()=>{state.screen="new-admission";render();};
  document.querySelector("#admin-student-search").oninput=e=>{state.adminStudentSearch=e.target.value;document.querySelector("#admin-student-results").innerHTML=studentAdminRows();bindStudentAdminRows();};
  try{state.adminStudents=await listInstituteStudents(i.instituteCode);document.querySelector("#admin-student-total").textContent=state.adminStudents.length;document.querySelector("#admin-student-active").textContent=state.adminStudents.filter(s=>(s.accountStatus||"active")==="active").length;document.querySelector("#admin-student-results").innerHTML=studentAdminRows();bindStudentAdminRows();}
  catch(err){const m=document.querySelector("#admin-student-message");m.textContent=`Could not load students. Error: ${err.code||"unknown"}`;m.className="form-message show error";document.querySelector("#admin-student-results").innerHTML="";}
}
function bindStudentAdminRows(){document.querySelectorAll("[data-student-manage]").forEach(b=>b.onclick=()=>{state.selectedStudentId=b.dataset.studentManage;state.screen="student-manage";render();});}
function renderStudentManage(){
  const i=state.instituteSession,s=state.adminStudents.find(x=>x.studentId===state.selectedStudentId);if(!i||!s){state.screen="institute-admin";return render();}
  const isActive=(s.accountStatus||"active")==="active";
  app.innerHTML=shell(`<section class="card dashboard-card wide-card"><button id="student-manage-back" class="back">← Student Management</button><div class="manage-head"><div class="avatar large">${esc((s.studentName||"S")[0].toUpperCase())}</div><div class="manage-title"><span class="step">Student profile</span><h2>${esc(s.studentName)}</h2><p>${esc(s.studentId)} · ${esc(s.courseOrClass||"Course not set")}</p></div><span class="pill ${(s.accountStatus||"active")}-pill">${esc(s.accountStatus||"active")}</span></div><form id="student-edit-form" class="form-grid">${field("se-name","Student Full Name","text","Student name",s.studentName||"")}${field("se-course","Course / Class","text","Course",s.courseOrClass||"")}${field("se-phone","Student Phone","tel","Optional",s.studentPhone||"")}${field("se-parent","Parent / Guardian","text","Parent name",s.parentName||"")}${field("se-relation","Relation","text","Relation",s.parentRelation||"")}${field("se-parent-phone","Parent Phone","tel","10-digit phone",s.parentPhone||"")}<label class="field form-wide"><span>Permanent Address</span><textarea id="se-address">${esc(s.address||"")}</textarea></label><label class="field form-wide"><span>Notes</span><textarea id="se-notes">${esc(s.notes||"")}</textarea></label><p id="student-edit-message" class="form-message form-wide"></p><button id="student-edit-save" class="primary form-wide">Save Student <span>→</span></button></form><section class="student-action-panel"><div><span class="step">Student actions</span><h3>Login & Profile Controls</h3><p>Reset password, share login, print ID card or control access.</p></div><div class="student-action-grid"><button id="student-reset-password" class="action-button" type="button">🔐 <span>Reset Password</span></button><button id="student-copy-login" class="action-button" type="button">📋 <span>Copy Login</span></button><button id="student-share-login" class="action-button" type="button">💬 <span>Share Login</span></button><button id="student-print-id" class="action-button" type="button">🪪 <span>Print ID Card</span></button><button id="student-status-toggle" class="action-button" type="button">${isActive?"⏸":"▶"} <span>${isActive?"Deactivate":"Activate"}</span></button><button id="student-archive" class="action-button danger-action" type="button">🗄 <span>Archive Student</span></button></div><p id="student-action-message" class="form-message"></p></section></section>`,true);
  document.querySelector("#student-manage-back").onclick=()=>{state.screen="institute-admin";render();};
  document.querySelector("#student-edit-form").onsubmit=async e=>{e.preventDefault();const b=document.querySelector("#student-edit-save"),m=document.querySelector("#student-edit-message");b.disabled=true;b.textContent="Saving…";try{const updated=await updateStudentProfile(s.studentId,{studentName:document.querySelector("#se-name").value,courseOrClass:document.querySelector("#se-course").value,studentPhone:document.querySelector("#se-phone").value,parentName:document.querySelector("#se-parent").value,parentRelation:document.querySelector("#se-relation").value,parentPhone:document.querySelector("#se-parent-phone").value,address:document.querySelector("#se-address").value,notes:document.querySelector("#se-notes").value},i.instituteCode);Object.assign(s,updated);m.textContent="Student details saved successfully.";m.className="form-message show success-message";}catch(err){m.textContent=`Could not save student. ${err.code||""}`;m.className="form-message show error";}finally{b.disabled=false;b.innerHTML="Save Student <span>→</span>";}};
  let latestPassword="";
  const loginText=()=>`HMOS Student Login\nStudent: ${s.studentName}\nStudent ID: ${s.studentId}${latestPassword?`\nTemporary Password: ${latestPassword}`:""}\nPortal: ${location.origin}${location.pathname}`;
  document.querySelector("#student-reset-password").onclick=()=>openModal({title:"Reset Student Password",eyebrow:"Student security",content:`<p class="modal-intro">A new 6-digit numeric temporary password will be generated for <strong>${esc(s.studentName)}</strong>.</p><label class="check confirm-check"><input id="student-reset-confirm" type="checkbox"/><span>I understand the old password will stop working immediately.</span></label><p id="modal-message" class="form-message"></p><div class="modal-actions"><button id="cancel-student-reset" class="secondary" type="button">Cancel</button><button id="confirm-student-reset" class="primary" type="button">Generate 6-Digit Password</button></div>`,onReady(){document.querySelector("#cancel-student-reset").onclick=closeModal;document.querySelector("#confirm-student-reset").onclick=async e=>{if(!document.querySelector("#student-reset-confirm").checked)return modalMessage("Please confirm before resetting.");const b=e.currentTarget;setActionBusy(b,true,"Resetting…");try{latestPassword=await resetStudentPassword(s.studentId,i.instituteCode);closeModal();openModal({title:"Student Login Reset",eyebrow:"Password reset successful",content:`<div class="credential-modal-grid"><article><span>Student ID</span><code>${esc(s.studentId)}</code></article><article><span>Temporary Password</span><code>${esc(latestPassword)}</code></article></div><p class="modal-note">The student must change this password on next login.</p><p id="modal-message" class="form-message"></p><div class="modal-actions"><button id="copy-reset-login" class="secondary" type="button">Copy Login</button><button id="share-reset-login" class="primary" type="button">WhatsApp</button></div>`,onReady(){document.querySelector("#copy-reset-login").onclick=async()=>{await copyText(loginText());modalMessage("Student login copied.","success");};document.querySelector("#share-reset-login").onclick=()=>window.open(`https://wa.me/?text=${encodeURIComponent(loginText())}`,"_blank","noopener");}});}catch(err){modalMessage(`Could not reset password. ${err.code||""}`);setActionBusy(b,false);}};}});
  document.querySelector("#student-copy-login").onclick=async()=>{await copyText(loginText());const m=document.querySelector("#student-action-message");m.textContent=latestPassword?"Student login copied.":"Student ID copied. Reset password first to include a temporary password.";m.className="form-message show info";};
  document.querySelector("#student-share-login").onclick=()=>window.open(`https://wa.me/?text=${encodeURIComponent(loginText())}`,"_blank","noopener");
  document.querySelector("#student-print-id").onclick=()=>{const content=`<div class="highlight"><span>Student Name</span><strong>${esc(s.studentName)}</strong></div><div class="grid"><div class="field"><span>Student ID</span><strong>${esc(s.studentId)}</strong></div><div class="field"><span>Course / Class</span><strong>${esc(s.courseOrClass||"—")}</strong></div><div class="field"><span>Parent / Guardian</span><strong>${esc(s.parentName||"—")}</strong></div><div class="field"><span>Phone</span><strong>${esc(s.studentPhone||s.parentPhone||"—")}</strong></div><div class="field"><span>Room / Bed</span><strong>${esc([s.roomNumber?`Room ${s.roomNumber}`:"",s.bedNumber?`Bed ${s.bedNumber}`:""].filter(Boolean).join(" · ")||"—")}</strong></div><div class="field"><span>Status</span><strong>${esc(s.accountStatus||"active")}</strong></div></div>`;openPremiumDocumentWindow({title:"Student ID Card",eyebrow:"RESIDENT IDENTITY",subtitle:"HMOS resident identification document",content,result:i,autoPrint:true,compact:true});};
  document.querySelector("#student-status-toggle").onclick=async e=>{const b=e.currentTarget,next=(s.accountStatus||"active")==="active"?"inactive":"active";b.disabled=true;b.textContent="Updating…";try{await setStudentAccountStatus(s.studentId,next,i.instituteCode);s.accountStatus=next;s.status=next;state.screen="institute-admin";render();}catch(err){alert(`Could not update student access. ${err.code||""}`);b.disabled=false;b.innerHTML=`${next==="inactive"?"⏸":"▶"} <span>${next==="inactive"?"Deactivate":"Activate"}</span>`;}};
  document.querySelector("#student-archive").onclick=()=>openModal({title:"Archive Student",eyebrow:"Student lifecycle",tone:"danger",content:`<p class="confirm-copy">This blocks student login and marks the profile as archived. Data will not be permanently deleted.</p><label class="field"><span>Type ARCHIVE to confirm</span><input id="student-archive-word" autocomplete="off" placeholder="ARCHIVE"/></label><p id="modal-message" class="form-message"></p><div class="modal-actions"><button id="cancel-student-archive" class="secondary" type="button">Cancel</button><button id="confirm-student-archive" class="primary danger-primary" type="button">Archive Student</button></div>`,onReady(){document.querySelector("#cancel-student-archive").onclick=closeModal;document.querySelector("#confirm-student-archive").onclick=async e=>{if(document.querySelector("#student-archive-word").value.trim().toUpperCase()!=="ARCHIVE")return modalMessage("Type ARCHIVE to continue.");const b=e.currentTarget;setActionBusy(b,true,"Archiving…");try{await archiveStudentProfile(s.studentId,i.instituteCode);s.accountStatus="archived";s.status="archived";closeModal();state.screen="institute-admin";render();}catch(err){modalMessage(`Could not archive student. ${err.code||""}`);setActionBusy(b,false);}};}});
}



function bedStatusOf(b){
  if(b.status==="occupied") return "occupied";
  if(b.status==="maintenance") return "maintenance";
  if(b.status==="reserved") return "reserved";
  if(b.isVisible===false || b.status==="hidden") return "hidden";
  return "vacant";
}
function floorKey(r){return (r.floor||"Unassigned Floor").trim()||"Unassigned Floor";}
function availableBedsCount(room){return (room.beds||[]).filter(b=>bedStatusOf(b)==="vacant").length;}
function visibleBedsCount(room){return (room.beds||[]).filter(b=>!['hidden','maintenance'].includes(bedStatusOf(b))).length;}
function roomCards(rooms=state.rooms){
  if(!rooms.length)return `<div class="empty-state"><strong>No rooms on this floor.</strong><p>Create a room or select another floor.</p></div>`;
  return `<div class="cinema-room-grid">${rooms.map(r=>{const hidden=(r.beds||[]).filter(b=>bedStatusOf(b)==="hidden").length;const maintenance=(r.beds||[]).filter(b=>bedStatusOf(b)==="maintenance").length;return `<button class="cinema-room-card" data-room-manage="${esc(r.id||r.roomId)}" type="button"><span class="room-number">${esc(r.roomNumber)}</span><small>${esc(r.roomType||"Room")}</small><div><b>${availableBedsCount(r)}</b> vacant · <b>${Number(r.occupiedBeds||0)}</b> occupied</div><em>${hidden} hidden · ${maintenance} maintenance</em></button>`}).join("")}</div>`;
}
async function renderRoomManagement(){
  const i=state.instituteSession;if(!i){state.screen="institute";return render();}
  app.innerHTML=shell(`<section class="card dashboard-card wide-card"><div class="dashboard-head"><div><span class="step success-step">Hostel operations</span><h2>Beds</h2><p>${esc(i.instituteName)} · ${esc(i.instituteCode)}</p></div><button id="room-back-portal" class="secondary">Institute Portal</button></div><div class="metric-grid"><article><span>Total Rooms</span><strong id="room-total">—</strong><small>Active rooms</small></article><article><span>Visible Beds</span><strong id="bed-total">—</strong><small>Shown for allotment</small></article><article><span>Vacant Beds</span><strong id="bed-vacant">—</strong><small>Ready to allot</small></article></div><div class="section-title"><div><h3>Select Floor</h3><p>Select a floor, room and bed.</p></div><button id="open-create-room" class="primary compact-primary">+ Create Room</button></div><div id="floor-tabs" class="floor-tabs"></div><p id="room-message" class="form-message"></p><div id="room-results"><div class="loading-card"><div class="loader"></div><p>Loading rooms…</p></div></div></section>`,true);
  document.querySelector("#room-back-portal").onclick=()=>{state.screen="admin-home";render();};
  document.querySelector("#open-create-room").onclick=()=>openModal({title:"Create Room",eyebrow:"Room setup",content:`<form id="create-room-form" class="form-grid">${field("room-building","Building","text","Main Building")}${field("room-floor","Floor","text","Ground Floor")}${field("room-number","Room Number","text","Example: 101")}<label class="field"><span>Room Type</span><select id="room-type"><option>Non-AC</option><option>AC</option><option>Dormitory</option></select></label>${field("room-capacity","Bed Capacity","number","4","4","min='1' max='50'")}<p id="modal-message" class="form-message form-wide"></p><button id="create-room-save" class="primary form-wide">Create Room</button></form>`,onReady(){document.querySelector("#create-room-form").onsubmit=async e=>{e.preventDefault();const b=document.querySelector("#create-room-save");setActionBusy(b,true,"Creating…");try{await createRoom({building:document.querySelector("#room-building").value,floor:document.querySelector("#room-floor").value,roomNumber:document.querySelector("#room-number").value,roomType:document.querySelector("#room-type").value,capacity:document.querySelector("#room-capacity").value},i);closeModal();return renderRoomManagement();}catch(err){modalMessage(err.code==="room-exists"?"This room number already exists.":`Could not create room. ${err.code||""}`);setActionBusy(b,false);}};}});
  try{
    const bedSync = await reconcileResidentBedAssignments(i.instituteCode).catch(err => {
      console.warn("Bed reconciliation skipped:", err);
      return { repairedBeds: 0, conflicts: [] };
    });
    [state.rooms,state.adminStudents,state.fees]=await Promise.all([listInstituteRooms(i.instituteCode),listInstituteStudents(i.instituteCode),listInstituteFees(i.instituteCode)]);
    if (bedSync.repairedBeds > 0) {
      const m=document.querySelector("#room-message");
      m.textContent=`Bed records repaired: ${bedSync.repairedBeds}.`;
      m.className="form-message show success-message";
    }
    const floors=[...new Set(state.rooms.map(floorKey))];
    if(!state.selectedFloor||!floors.includes(state.selectedFloor))state.selectedFloor=floors[0]||"";
    const visibleTotal=state.rooms.reduce((n,r)=>n+visibleBedsCount(r),0),vacant=state.rooms.reduce((n,r)=>n+availableBedsCount(r),0);
    document.querySelector("#room-total").textContent=state.rooms.length;document.querySelector("#bed-total").textContent=visibleTotal;document.querySelector("#bed-vacant").textContent=vacant;
    const tabs=document.querySelector("#floor-tabs");tabs.innerHTML=floors.map(f=>`<button type="button" data-floor="${esc(f)}" class="floor-tab ${f===state.selectedFloor?'active':''}">${esc(f)}</button>`).join("")||'<span class="muted">No floors yet</span>';
    const paintRooms=()=>{document.querySelector("#room-results").innerHTML=roomCards(state.rooms.filter(r=>floorKey(r)===state.selectedFloor));document.querySelectorAll("[data-room-manage]").forEach(b=>b.onclick=()=>{state.selectedRoomId=b.dataset.roomManage;state.selectedBedNumber="";state.screen="room-manage";render();});};
    tabs.querySelectorAll("[data-floor]").forEach(b=>b.onclick=()=>{state.selectedFloor=b.dataset.floor;tabs.querySelectorAll(".floor-tab").forEach(x=>x.classList.toggle("active",x===b));paintRooms();});paintRooms();
  }catch(err){const m=document.querySelector("#room-message");m.textContent=`Could not load rooms. ${err.code||""}`;m.className="form-message show error";}
}
function bedLegend(){return `<div class="bed-legend"><span><i class="vacant-dot"></i>Vacant</span><span><i class="selected-dot"></i>Selected</span><span><i class="occupied-dot"></i>Occupied</span><span><i class="hidden-dot"></i>Hidden</span><span><i class="maintenance-dot"></i>Maintenance</span><span><i class="reserved-dot"></i>Reserved</span></div>`;}
function renderRoomManage(){
  const i=state.instituteSession,r=state.rooms.find(x=>(x.id||x.roomId)===state.selectedRoomId);if(!i||!r){state.screen="room-management";return render();}
  const vacant=(r.beds||[]).filter(b=>bedStatusOf(b)==="vacant"),unallotted=state.adminStudents.filter(s=>!s.roomId && s.accountStatus!=="archived");
  const bedButtons=(r.beds||[]).map(b=>{const status=bedStatusOf(b),selected=String(b.bedNumber)===state.selectedBedNumber;const fee=state.fees.find(f=>normalizeCodeLocal(f.studentId)===normalizeCodeLocal(b.studentId));const overdue=status==='occupied'&&Number(fee?.balanceAmount||0)>0&&fee?.dueDate&&new Date(fee.dueDate+'T23:59:59')<new Date();return `<button type="button" class="cinema-bed ${status} ${overdue?'fee-overdue':''} ${selected?'selected':''}" data-bed-number="${esc(b.bedNumber)}" data-bed-status="${status}" data-student-id="${esc(b.studentId||'')}"><span>BED</span><strong>${esc(b.bedNumber)}</strong><small>${status==='occupied'?esc(b.studentName||b.studentId):status}</small></button>`}).join("");
  app.innerHTML=shell(`<section class="card dashboard-card wide-card"><button id="room-manage-back" class="back">← Room Management</button><div class="manage-head"><div class="avatar large">${esc(r.roomNumber)}</div><div class="manage-title"><span class="step">${esc(r.building)} · ${esc(r.floor)}</span><h2>Room ${esc(r.roomNumber)}</h2><p>${esc(r.roomType)} · ${Number(r.occupiedBeds||0)}/${Number(r.capacity||0)} occupied</p></div></div><div class="cinema-screen">ROOM ${esc(r.roomNumber)} — BED LAYOUT</div>${bedLegend()}<div class="cinema-bed-grid">${bedButtons}</div><p class="bed-help">Tap a vacant bed to select. Long-press is replaced with the Admin Controls below for reliable mobile use.</p><div id="selected-bed-panel" class="selected-bed-panel"><strong>Selected Bed: <span id="selected-bed-label">${esc(state.selectedBedNumber||"None")}</span></strong><div class="bed-admin-actions"><button id="bed-hide" class="secondary" type="button">Hide</button><button id="bed-show" class="secondary" type="button">Show</button><button id="bed-maintenance" class="secondary" type="button">Maintenance</button><button id="bed-reserve" class="secondary" type="button">Reserve</button><button id="bed-vacant" class="secondary" type="button">Make Vacant</button></div><p id="bed-control-message" class="form-message"></p></div><div class="section-title"><div><h3>Allot Selected Bed</h3><p>Select a student, tap a vacant bed and confirm.</p></div></div><form id="bed-allot-form" class="form-grid"><label class="field"><span>Student</span><select id="allot-student"><option value="">Select student</option>${unallotted.map(s=>`<option value="${esc(s.studentId)}">${esc(s.studentName)} · ${esc(s.studentId)}</option>`).join("")}</select></label><label class="field"><span>Selected Bed</span><input id="allot-bed" value="${esc(state.selectedBedNumber)}" readonly placeholder="Tap a vacant bed above"></label><p id="allot-message" class="form-message form-wide"></p><button id="allot-save" class="primary form-wide">Confirm Bed Allotment</button></form></section>`,true);
  document.querySelector("#room-manage-back").onclick=()=>{state.screen="room-management";render();};
  document.querySelectorAll(".cinema-bed").forEach(btn=>btn.onclick=()=>{const status=btn.dataset.bedStatus;if(status==='occupied'){const resident=state.adminStudents.find(x=>normalizeCodeLocal(x.studentId)===normalizeCodeLocal(btn.dataset.studentId));const fee=state.fees.find(x=>normalizeCodeLocal(x.studentId)===normalizeCodeLocal(btn.dataset.studentId))||{};if(resident){openModal({title:`Bed ${btn.dataset.bedNumber} · ${resident.studentName}`,eyebrow:'Resident details',content:`<div class="resident-call-card"><strong>${esc(resident.studentName)}</strong><span>${esc(resident.studentId)} · Room ${esc(r.roomNumber)} · Bed ${esc(btn.dataset.bedNumber)}</span><p>Fee balance: <b>₹${Number(fee.balanceAmount||0).toLocaleString('en-IN')}</b>${fee.dueDate?` · Due ${esc(fee.dueDate)}`:''}</p></div><div class="modal-actions"><a class="secondary button-link" href="tel:${esc(resident.studentPhone||'')}">Call Resident</a><a class="secondary button-link" href="tel:${esc(resident.parentPhone||'')}">Call Parent</a><button id="open-resident-profile" class="primary">Resident Details</button></div>`,onReady(){document.querySelector('#open-resident-profile').onclick=()=>{closeModal();state.selectedStudentId=resident.studentId;state.screen='student-manage';render();};}});}return;}if(status==='vacant'){state.selectedBedNumber=btn.dataset.bedNumber;document.querySelectorAll('.cinema-bed').forEach(x=>x.classList.remove('selected'));btn.classList.add('selected');document.querySelector('#selected-bed-label').textContent=state.selectedBedNumber;document.querySelector('#allot-bed').value=state.selectedBedNumber;}else{state.selectedBedNumber=btn.dataset.bedNumber;document.querySelectorAll('.cinema-bed').forEach(x=>x.classList.remove('selected'));btn.classList.add('selected');document.querySelector('#selected-bed-label').textContent=state.selectedBedNumber;document.querySelector('#allot-bed').value='';}});
  const control=async action=>{const m=document.querySelector('#bed-control-message');if(!state.selectedBedNumber){m.textContent='Select a bed first.';m.className='form-message show error';return;}try{await setBedDisplayStatus({roomIdValue:r.id||r.roomId,bedNumberValue:state.selectedBedNumber,action,instituteCodeValue:i.instituteCode});state.rooms=await listInstituteRooms(i.instituteCode);state.selectedBedNumber='';renderRoomManage();}catch(err){m.textContent=`Could not update bed. ${err.code||''}`;m.className='form-message show error';}};
  document.querySelector('#bed-hide').onclick=()=>control('hidden');document.querySelector('#bed-show').onclick=()=>control('vacant');document.querySelector('#bed-maintenance').onclick=()=>control('maintenance');document.querySelector('#bed-reserve').onclick=()=>control('reserved');document.querySelector('#bed-vacant').onclick=()=>control('vacant');
  document.querySelector("#bed-allot-form").onsubmit=async e=>{e.preventDefault();const b=document.querySelector("#allot-save"),m=document.querySelector("#allot-message"),studentId=document.querySelector("#allot-student").value,bed=state.selectedBedNumber;if(!studentId||!bed){m.textContent="Select student and a vacant bed.";m.className="form-message show error";return;}b.disabled=true;b.textContent="Allotting…";try{await allotStudentBed({studentIdValue:studentId,roomIdValue:r.id||r.roomId,bedNumberValue:bed,instituteCodeValue:i.instituteCode});state.adminStudents=await listInstituteStudents(i.instituteCode);state.rooms=await listInstituteRooms(i.instituteCode);state.selectedBedNumber="";renderRoomManage();}catch(err){m.textContent=`Could not allot bed. ${err.code||""}`;m.className="form-message show error";b.disabled=false;b.textContent="Confirm Bed Allotment";}};
  document.querySelectorAll('.cinema-bed.occupied').forEach(btn=>btn.ondblclick=async()=>{const bed=(r.beds||[]).find(x=>String(x.bedNumber)===btn.dataset.bedNumber);if(!bed?.studentId||!confirm(`Vacate Bed ${bed.bedNumber} occupied by ${bed.studentName||bed.studentId}?`))return;try{await vacateStudentBed(bed.studentId,i.instituteCode);state.adminStudents=await listInstituteStudents(i.instituteCode);state.rooms=await listInstituteRooms(i.instituteCode);renderRoomManage();}catch(err){alert(`Could not vacate bed. ${err.code||""}`);}});
}
async function renderFeesManagement(){
  const i=state.instituteSession;if(!i){state.screen="institute";return render();}
  app.innerHTML=shell(`<section class="card dashboard-card wide-card"><button id="fees-back" class="back">← Institute Portal</button><div class="card-heading"><span class="step">Finance operations</span><h2>Fees</h2><p>${esc(i.instituteName)} · Set student fees, collect payments and issue receipts.</p></div><div class="loading-card"><div class="loader"></div><p>Loading fee records…</p></div></section>`,true);
  try{const [students,fees]=await Promise.all([listInstituteStudents(i.instituteCode),listInstituteFees(i.instituteCode)]);state.adminStudents=students;state.fees=fees;renderFeesManagementReady();}catch(err){app.innerHTML=shell(`<section class="card login-card"><button id="fees-back" class="back">← Institute Portal</button><h2>Fees could not load</h2><p class="form-message show error">${esc(err.code||"fee-load-error")}</p></section>`,true);document.querySelector("#fees-back").onclick=()=>{state.screen="admin-home";render();};}
}
function feeFor(studentId){return state.fees.find(f=>f.studentId===studentId)||null;}
function renderFeesManagementReady(){
  const i=state.instituteSession, total=state.fees.reduce((n,f)=>n+Number(f.totalFee||0),0),paid=state.fees.reduce((n,f)=>n+Number(f.paidAmount||0),0),balance=Math.max(0,total-paid);
  app.innerHTML=shell(`<section class="card dashboard-card wide-card"><button id="fees-back" class="back">← Institute Portal</button><div class="card-heading"><span class="step">Finance operations</span><h2>Fees</h2><p>${esc(i.instituteName)} · Student fee ledger</p></div><div class="metric-grid"><article><span>Total Fees</span><strong>₹${total.toLocaleString("en-IN")}</strong><small>Assigned</small></article><article><span>Collected</span><strong>₹${paid.toLocaleString("en-IN")}</strong><small>Payments received</small></article><article><span>Balance</span><strong>₹${balance.toLocaleString("en-IN")}</strong><small>Outstanding</small></article></div><div class="section-title"><div><h3>Resident Fee Accounts</h3><p>Set fee plan or record a payment.</p></div></div><div class="fee-student-list">${state.adminStudents.map(s=>{const f=feeFor(s.studentId),b=Number(f?.balanceAmount||0);return `<article class="fee-student-card"><div><strong>${esc(s.studentName)}</strong><span>${esc(s.studentId)} · ${esc(s.courseOrClass||"")}</span></div><div class="fee-amounts"><small>Total</small><strong>₹${Number(f?.totalFee||0).toLocaleString("en-IN")}</strong><small>Balance</small><strong class="${b>0?'due-text':'health-text'}">₹${b.toLocaleString("en-IN")}</strong></div><button class="secondary" data-fee-manage="${esc(s.studentId)}">Manage Fees</button></article>`}).join("")||'<div class="empty-state"><strong>No students found.</strong></div>'}</div></section>`,true);
  document.querySelector("#fees-back").onclick=()=>{state.screen="admin-home";render();};document.querySelectorAll("[data-fee-manage]").forEach(b=>b.onclick=()=>openStudentFeeModal(b.dataset.feeManage));
}
function openStudentFeeModal(studentId){
  const i=state.instituteSession;
  const s=state.adminStudents.find(x=>x.studentId===studentId),f=feeFor(studentId)||{};
  if(!i||!s)return;
  openModal({title:`Fees · ${s.studentName}`,eyebrow:"Student fee account",wide:true,content:`<div class="fee-summary"><article><span>Total Fee</span><strong>₹${Number(f.totalFee||0).toLocaleString("en-IN")}</strong></article><article><span>Paid</span><strong>₹${Number(f.paidAmount||0).toLocaleString("en-IN")}</strong></article><article><span>Balance</span><strong>₹${Number(f.balanceAmount||0).toLocaleString("en-IN")}</strong></article></div><form id="fee-plan-form" class="form-grid">${field("fee-total","Total Fee","number","Example: 30000",f.totalFee||"","min='0'")}${field("fee-due-date","Due Date","date","",f.dueDate||"")}<button id="fee-plan-save" class="secondary form-wide" type="submit">Save Fee Plan</button></form><hr class="modal-divider"><form id="fee-payment-form" class="form-grid">${field("fee-payment","Payment Amount","number","Enter amount","","min='1'")}<label class="field"><span>Payment Mode</span><select id="fee-mode"><option>Cash</option><option>UPI</option><option>Bank Transfer</option><option>Card</option></select></label>${field("fee-reference","Reference / Note","text","Optional transaction reference")}<p id="modal-message" class="form-message form-wide"></p><button id="fee-payment-save" class="primary form-wide" type="submit">Record Payment & Receipt</button></form>`,onReady(){
    document.querySelector("#fee-plan-form").onsubmit=async e=>{e.preventDefault();const b=document.querySelector("#fee-plan-save");setActionBusy(b,true,"Saving…");try{await saveStudentFeePlan({studentId,instituteCode:i.instituteCode,totalFee:document.querySelector("#fee-total").value,dueDate:document.querySelector("#fee-due-date").value});state.fees=await listInstituteFees(i.instituteCode);closeModal();renderFeesManagementReady();}catch(err){modalMessage(`Could not save fee plan. ${err.code||""}`);setActionBusy(b,false);}};
    document.querySelector("#fee-payment-form").onsubmit=async e=>{e.preventDefault();const b=document.querySelector("#fee-payment-save");setActionBusy(b,true,"Recording…");try{const receipt=await recordStudentFeePayment({studentId,instituteCode:i.instituteCode,amount:document.querySelector("#fee-payment").value,mode:document.querySelector("#fee-mode").value,reference:document.querySelector("#fee-reference").value});state.fees=await listInstituteFees(i.instituteCode);closeModal();showFeeReceipt(s,receipt);}catch(err){modalMessage(err.code==="payment-exceeds-balance"?"Payment is greater than the outstanding balance.":`Could not record payment. ${err.code||""}`);setActionBusy(b,false);}};
  }});
}
function showFeeReceipt(student,receipt){openModal({title:"Payment Receipt",eyebrow:"Payment recorded successfully",content:`<div class="success-panel"><span>Receipt Number</span><strong>${esc(receipt.receiptNo)}</strong></div><div class="receipt-grid"><article><span>Student</span><strong>${esc(student.studentName)}</strong><small>${esc(student.studentId)}</small></article><article><span>Amount Paid</span><strong>₹${Number(receipt.amount).toLocaleString("en-IN")}</strong><small>${esc(receipt.mode)}</small></article><article><span>Remaining Balance</span><strong>₹${Number(receipt.balanceAmount).toLocaleString("en-IN")}</strong></article></div><div class="modal-actions"><button id="copy-fee-receipt" class="secondary">Copy Receipt</button><button id="print-fee-receipt" class="primary">Print / Save PDF</button></div>`,onReady(){const text=`HMOS Fee Receipt\nReceipt: ${receipt.receiptNo}\nStudent: ${student.studentName} (${student.studentId})\nPaid: ₹${receipt.amount}\nBalance: ₹${receipt.balanceAmount}\nMode: ${receipt.mode}`;document.querySelector("#copy-fee-receipt").onclick=()=>copyText(text);document.querySelector("#print-fee-receipt").onclick=()=>{const i=state.instituteSession||{};const content=`<div class="highlight"><span>Receipt Number</span><strong>${esc(receipt.receiptNo)}</strong></div><div class="grid"><div class="field"><span>Student</span><strong>${esc(student.studentName)}</strong><small>${esc(student.studentId)}</small></div><div class="field"><span>Amount Paid</span><strong>₹${Number(receipt.amount).toLocaleString("en-IN")}</strong></div><div class="field"><span>Payment Mode</span><strong>${esc(receipt.mode||"—")}</strong></div><div class="field"><span>Reference / Note</span><strong>${esc(receipt.reference||"—")}</strong></div><div class="field"><span>Remaining Balance</span><strong>₹${Number(receipt.balanceAmount).toLocaleString("en-IN")}</strong></div><div class="field"><span>Payment Status</span><strong>Received</strong></div></div><p class="note">This receipt was generated by HMOS for the payment recorded in the institute fee ledger.</p>`;openPremiumDocumentWindow({title:"Fee Payment Receipt",eyebrow:"FINANCE OPERATIONS",subtitle:"Official fee payment acknowledgement",content,result:i,autoPrint:true});};}});}

async function renderPendingAdmissions(){
  const i=state.instituteSession;if(!i){state.screen="institute";return render();}
  app.innerHTML=shell(`<section class="card dashboard-card wide-card"><button id="pending-back" class="back">← Institute Portal</button><div class="card-heading"><span class="step">Payment verification</span><h2>Pending Admissions</h2><p>Verify UPI reference, fee amount, contact details and reserved bed before approval.</p></div><div id="pending-list"><div class="loading-card"><div class="loader"></div></div></div></section>`,true);
  document.querySelector("#pending-back").onclick=()=>{state.screen="admin-home";render();};
  try{
    state.pendingAdmissions=await listPendingAdmissions(i.instituteCode);
    // The user may navigate while the Firestore request is in flight. Do not write into a stale screen.
    const pendingList=document.querySelector("#pending-list");
    if(state.screen!=="pending-admissions" || !pendingList) return;
    const rows=[...state.pendingAdmissions].sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
    pendingList.innerHTML=rows.map(a=>`<article class="fee-student-card pending-admission-card"><div><span class="pill expired-pill">Payment verification</span><strong>${esc(a.studentName)}</strong><span>${esc(a.applicationId)}</span><small>${esc(a.course||"Course not entered")} · ${esc(a.studentPhone||"")}</small><small>${esc(a.floor)} · Room ${esc(a.roomNumber)} · Bed ${esc(a.bedNumber)}</small></div><div class="fee-amounts"><small>Total Fee</small><strong>₹${Number(a.totalFees||0).toLocaleString("en-IN")}</strong><small>Paid Now</small><strong>₹${Number(a.amountPayingNow||0).toLocaleString("en-IN")}</strong><small>Balance</small><strong>₹${Number(a.balanceAmount||0).toLocaleString("en-IN")}</strong></div><div class="transaction-box"><small>UPI Transaction ID</small><code>${esc(a.upiTransactionId||"")}</code><button class="secondary compact-button" type="button" data-copy-txn="${esc(a.upiTransactionId||"")}">Copy Txn ID</button></div><div class="credential-actions"><button class="primary" data-approve-admission="${esc(a.applicationId)}">Approve & Create Resident</button><button class="secondary" data-reject-admission="${esc(a.applicationId)}">Reject</button></div></article>`).join("")||`<div class="empty-state"><strong>No pending admissions.</strong></div>`;
    document.querySelectorAll("[data-copy-txn]").forEach(b=>b.onclick=async()=>{await copyText(b.dataset.copyTxn);b.textContent="Copied";setTimeout(()=>b.textContent="Copy Txn ID",1200);});
    document.querySelectorAll("[data-approve-admission]").forEach(b=>b.onclick=async()=>{if(!confirm("Payment verified? Approve admission and create resident account?"))return;b.disabled=true;b.textContent="Creating resident…";try{state.latestAdmission=await approvePendingAdmission(b.dataset.approveAdmission,i);state.screen="admission-success";render();}catch(err){alert(`Approval failed: ${humanError(err,err.code||err.message)}`);b.disabled=false;b.textContent="Approve & Create Resident";}});
    document.querySelectorAll("[data-reject-admission]").forEach(b=>b.onclick=async()=>{const reason=prompt("Reason for rejection","Payment could not be verified");if(reason===null)return;b.disabled=true;b.textContent="Rejecting…";try{await rejectPendingAdmission(b.dataset.rejectAdmission,reason.trim()||"Payment could not be verified");renderPendingAdmissions();}catch(err){alert(`Rejection failed: ${humanError(err,err.code||err.message)}`);b.disabled=false;b.textContent="Reject";}});
  }catch(err){const pendingList=document.querySelector("#pending-list");if(state.screen==="pending-admissions"&&pendingList)pendingList.innerHTML=`<p class="form-message show error">${esc(humanError(err,err.code||"Could not load"))}</p>`;}
}

async function refreshAdminBadges(){const i=state.instituteSession;if(!i)return;try{const [approvals,notes]=await Promise.all([listApprovalRequests(i.instituteCode,"pending"),listNotifications({instituteCode:i.instituteCode,recipientType:"admin"})]);state.approvals=approvals.filter(x=>x.requestType!=='exit_request');state.notifications=notes;const ab=document.querySelector('#approvals-badge'),nb=document.querySelector('#notifications-badge');if(ab)ab.textContent=state.approvals.length;if(nb)nb.textContent=notes.filter(n=>!n.isRead).length;}catch(err){console.warn('badge load',err);}}
function approvalTypeLabel(v){return ({new_admission:'New Admission',fee_payment:'Fee Payment',bed_change:'Bed Change',complaint_resolution:'Complaint Resolution'})[v]||String(v||'Request').replaceAll('_',' ');}
async function renderApprovals(){const i=state.instituteSession;if(!i){state.screen='institute';return render();}app.innerHTML=shell(`<section class="card dashboard-card wide-card compact-page"><button id="approvals-back" class="back">← Institute Home</button><div class="compact-heading"><span class="step">Pending workflow</span><h2>Approvals</h2><p>Review admission, fee, bed and complaint actions.</p></div><div id="approval-summary" class="approval-summary"></div><div id="approval-list"><div class="loading-card"><div class="loader"></div></div></div></section>`,true);document.querySelector('#approvals-back').onclick=()=>{state.screen='admin-home';render();};try{const allItems=await listApprovalRequests(i.instituteCode,'pending');const items=allItems.filter(x=>x.requestType!=='exit_request');state.approvals=items;const types=['new_admission','fee_payment','bed_change','complaint_resolution'];document.querySelector('#approval-summary').innerHTML=types.map(t=>`<article><span>${approvalTypeLabel(t)}</span><strong>${items.filter(x=>x.requestType===t).length}</strong></article>`).join('');document.querySelector('#approval-list').innerHTML=items.map(x=>`<article class="approval-row"><div><span class="step">${esc(approvalTypeLabel(x.requestType))}</span><strong>${esc(x.title||approvalTypeLabel(x.requestType))}</strong><small>${esc(x.requestedByName||x.requestedById||'Resident')}</small></div><div class="approval-actions"><button class="primary compact-button" data-approval-ok="${esc(x.id)}">Approve</button><button class="secondary compact-button" data-approval-no="${esc(x.id)}">Reject</button></div></article>`).join('')||'<div class="empty-state"><strong>No pending approvals.</strong></div>';document.querySelectorAll('[data-approval-ok]').forEach(b=>b.onclick=()=>decision(b.dataset.approvalOk,'approved'));document.querySelectorAll('[data-approval-no]').forEach(b=>b.onclick=()=>decision(b.dataset.approvalNo,'rejected'));async function decision(id,status){const note=prompt(status==='approved'?'Approval note (optional)':'Reason for rejection')||'';await decideApprovalRequest(id,status,note);renderApprovals();}}catch(err){document.querySelector('#approval-list').innerHTML=`<p class="form-message show error">${esc(err.code||err.message)}</p>`;}}
async function renderAdminNotifications(){const i=state.instituteSession;if(!i)return;app.innerHTML=shell(`<section class="card dashboard-card wide-card compact-page"><button id="notes-back" class="back">← Institute Home</button><div class="compact-heading"><span class="step">Alerts</span><h2>Notifications</h2><p>Fee dues, late returns, complaints, admissions and meal alerts.</p></div><div id="notes-list"><div class="loading-card"><div class="loader"></div></div></div></section>`,true);document.querySelector('#notes-back').onclick=()=>{state.screen='admin-home';render();};const notes=await listNotifications({instituteCode:i.instituteCode,recipientType:'admin'});document.querySelector('#notes-list').innerHTML=notes.map(n=>`<button class="notification-row ${n.isRead?'':'unread'}" data-note-id="${esc(n.id)}"><strong>${esc(n.title)}</strong><span>${esc(n.message)}</span><small>${n.isRead?'Read':'New'}</small></button>`).join('')||'<div class="empty-state"><strong>No notifications.</strong></div>';document.querySelectorAll('[data-note-id]').forEach(b=>b.onclick=async()=>{await markNotificationRead(b.dataset.noteId);b.classList.remove('unread');b.querySelector('small').textContent='Read';});}
async function renderStudentNotifications(){const s=state.studentSession;if(!s)return;app.innerHTML=shell(`<section class="card dashboard-card wide-card compact-page"><button id="student-notes-back" class="back">← Student Home</button><div class="compact-heading"><span class="step">Resident alerts</span><h2>Notifications</h2><p>Fee, payment, exit, complaint, menu and attendance updates.</p></div><div id="student-notes-list"><div class="loading-card"><div class="loader"></div></div></div></section>`,true);document.querySelector('#student-notes-back').onclick=()=>{state.screen='student-dashboard';render();};const notes=await listNotifications({instituteCode:s.instituteCode,recipientType:'resident',recipientId:s.studentId});document.querySelector('#student-notes-list').innerHTML=notes.map(n=>`<button class="notification-row ${n.isRead?'':'unread'}" data-note-id="${esc(n.id)}"><strong>${esc(n.title)}</strong><span>${esc(n.message)}</span><small>${n.isRead?'Read':'New'}</small></button>`).join('')||'<div class="empty-state"><strong>No notifications.</strong></div>';document.querySelectorAll('[data-note-id]').forEach(b=>b.onclick=async()=>{await markNotificationRead(b.dataset.noteId);b.classList.remove('unread');b.querySelector('small').textContent='Read';});}
async function renderAuditLogs(){const i=state.instituteSession;if(!i)return;app.innerHTML=shell(`<section class="card dashboard-card wide-card compact-page"><button id="audit-back" class="back">← Institute Home</button><div class="compact-heading"><span class="step">Data safety</span><h2>Audit Logs</h2><p>Important user and system actions.</p></div><div id="audit-list"><div class="loading-card"><div class="loader"></div></div></div></section>`,true);document.querySelector('#audit-back').onclick=()=>{state.screen='admin-home';render();};const rows=await listAuditLogs(i.instituteCode);document.querySelector('#audit-list').innerHTML=rows.slice(0,200).map(x=>`<article class="audit-row"><div><strong>${esc(String(x.action||'').replaceAll('_',' '))}</strong><span>${esc(x.summary||'')}</span></div><small>${esc(x.actorType||'system')} · ${formatDateTime(x.createdAt)}</small></article>`).join('')||'<div class="empty-state"><strong>No audit history yet.</strong></div>';}
async function renderRecycleBin(){const i=state.instituteSession;if(!i)return;app.innerHTML=shell(`<section class="card dashboard-card wide-card compact-page"><button id="recycle-back" class="back">← Institute Home</button><div class="compact-heading"><span class="step">Data safety</span><h2>Recycle Bin</h2><p>Deleted records remain restorable.</p></div><div id="recycle-list"><div class="loading-card"><div class="loader"></div></div></div></section>`,true);document.querySelector('#recycle-back').onclick=()=>{state.screen='admin-home';render();};const rows=await listRecycleBin(i.instituteCode);document.querySelector('#recycle-list').innerHTML=rows.map(x=>`<article class="approval-row"><div><strong>${esc(x.displayName||x.recordId)}</strong><span>${esc(x.collectionName)} · ${esc(x.deleteReason||'No reason')}</span></div><button class="primary compact-button" data-restore="${esc(x.id)}">Restore</button></article>`).join('')||'<div class="empty-state"><strong>Recycle bin is empty.</strong></div>';document.querySelectorAll('[data-restore]').forEach(b=>b.onclick=async()=>{const item=rows.find(x=>x.id===b.dataset.restore);await restoreDeletedRecord(item);renderRecycleBin();});}
async function renderBackupRestore(){
  const i=state.instituteSession;if(!i)return;
  let verifiedBackup=null;
  app.innerHTML=shell(`<section class="card dashboard-card wide-card compact-page"><button id="backup-back" class="back">← Institute Home</button>
    <div class="compact-heading"><span class="step">Data safety</span><h2>Backup & Recovery V2</h2><p>Download a full institute backup, create daily snapshots, verify backup files and safely recover saved records.</p></div>
    <div class="backup-actions-stack">
      <button id="download-full-backup" class="primary" type="button">Download Full JSON Backup</button>
      <button id="create-backup" class="secondary" type="button">Create Today Snapshot</button>
    </div>
    <p id="backup-message" class="form-message"></p>
    <section class="recovery-check-card">
      <div><span class="step">Recovery readiness</span><h3>Check a Backup File</h3><p>Select a HMOS JSON backup. The file is verified first and no live data is changed during this check.</p></div>
      <label class="backup-file-picker"><input id="backup-file-check" type="file" accept="application/json,.json"/></label>
      <div id="backup-check-result"></div>
      <div id="restore-controls" class="restore-controls" hidden>
        <div class="restore-warning"><strong>Safe Recovery Mode</strong><p>HMOS will first download a fresh safety backup and create a snapshot. Then records from the selected backup are written back using their original document IDs. Records created after the backup are not deleted.</p></div>
        <label class="field"><span>Type RESTORE to confirm</span><input id="restore-confirm-word" autocomplete="off" placeholder="RESTORE"/></label>
        <button id="restore-backup" class="primary danger-primary" type="button" disabled>Restore Verified Backup</button>
        <p id="restore-message" class="form-message"></p>
      </div>
    </section>
    <p class="modal-note"><strong>Important:</strong> V2 uses a safer merge-style recovery. It can restore backed-up records without deleting newer live records. A destructive full-database replacement and automatic scheduled Firestore exports still require a secure backend / Google Cloud setup.</p>
    <div class="compact-section"><h3>Snapshot History</h3><div id="backup-list"><div class="loading-card"><div class="loader"></div></div></div></div>
  </section>`,true);
  document.querySelector('#backup-back').onclick=()=>{state.screen='admin-home';render();};
  const msg=document.querySelector('#backup-message');
  const downloadPayload=(payload,prefix='HMOS')=>{const stamp=new Date().toISOString().replace(/[:.]/g,'-');const filename=`${prefix}-${i.instituteCode}-BACKUP-${stamp}.json`;const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);return filename;};
  document.querySelector('#create-backup').onclick=async e=>{const b=e.currentTarget;b.disabled=true;b.textContent='Creating…';try{await createBackupSnapshot(i.instituteCode);msg.textContent='Today snapshot created successfully.';msg.className='form-message show success-message';await paintHistory();}catch(err){msg.textContent=humanError(err,'Could not create snapshot.');msg.className='form-message show error';}finally{b.disabled=false;b.textContent='Create Today Snapshot';}};
  document.querySelector('#download-full-backup').onclick=async e=>{const b=e.currentTarget;b.disabled=true;b.textContent='Preparing backup…';msg.textContent='Reading institute records from Firestore…';msg.className='form-message show info';try{const payload=await exportInstituteBackup(i.instituteCode);const filename=downloadPayload(payload,'HMOS');msg.textContent=`Full backup downloaded: ${payload.totalRecords} records · ${filename}`;msg.className='form-message show success-message';}catch(err){msg.textContent=humanError(err,'Could not download full backup.');msg.className='form-message show error';}finally{b.disabled=false;b.textContent='Download Full JSON Backup';}};
  const fileInput=document.querySelector('#backup-file-check'),out=document.querySelector('#backup-check-result'),controls=document.querySelector('#restore-controls'),confirmWord=document.querySelector('#restore-confirm-word'),restoreButton=document.querySelector('#restore-backup'),restoreMsg=document.querySelector('#restore-message');
  confirmWord.oninput=()=>{restoreButton.disabled=confirmWord.value.trim().toUpperCase()!=='RESTORE'||!verifiedBackup;};
  fileInput.onchange=async e=>{verifiedBackup=null;controls.hidden=true;confirmWord.value='';restoreButton.disabled=true;restoreMsg.textContent='';restoreMsg.className='form-message';const file=e.target.files?.[0];if(!file){out.innerHTML='';return;}try{const text=await file.text(),data=JSON.parse(text);if(data?.format!=="HMOS_INSTITUTE_BACKUP_V1"||!data?.instituteCode||!data?.collections)throw new Error('This is not a valid HMOS backup file.');const names=Object.keys(data.collections),count=names.reduce((n,k)=>n+(Array.isArray(data.collections[k])?data.collections[k].length:0),0),match=normalizeCodeLocal(data.instituteCode)===normalizeCodeLocal(i.instituteCode);out.innerHTML=`<div class="status-result ${match?'approved':'pending'}"><span class="pill ${match?'active-pill':'expired-pill'}">${match?'Valid Backup':'Different Institute'}</span><h3>${esc(data.instituteCode)}</h3><p>${count} records across ${names.length} collections.</p><small>Created: ${esc(data.generatedAt||'Unknown')} · App version: ${esc(data.appVersion||'Unknown')}</small>${match?'':'<p><strong>Recovery is blocked because this file belongs to another institute.</strong></p>'}</div>`;if(match){verifiedBackup=data;controls.hidden=false;}}catch(err){out.innerHTML=`<p class="form-message show error">Backup check failed: ${esc(err.message||'Invalid file')}</p>`;}};
  restoreButton.onclick=async()=>{if(!verifiedBackup||confirmWord.value.trim().toUpperCase()!=='RESTORE')return;restoreButton.disabled=true;restoreButton.textContent='Creating safety backup…';restoreMsg.textContent='Do not close this page. Preparing a pre-restore safety copy.';restoreMsg.className='form-message show info';try{const safety=await exportInstituteBackup(i.instituteCode);downloadPayload(safety,'HMOS-PRE-RESTORE');await createBackupSnapshot(i.instituteCode);restoreButton.textContent='Restoring records…';const result=await restoreInstituteBackup(verifiedBackup,i.instituteCode);restoreMsg.textContent=`Recovery completed safely. ${result.restoredRecords} records restored across ${result.restoredCollections} collections. Newer records were not deleted.`;restoreMsg.className='form-message show success-message';confirmWord.value='';verifiedBackup=null;controls.hidden=true;fileInput.value='';out.innerHTML='';await paintHistory();}catch(err){restoreMsg.textContent=`Recovery stopped: ${humanError(err,err.code||err.message||'Unknown error')}`;restoreMsg.className='form-message show error';restoreButton.disabled=false;restoreButton.textContent='Restore Verified Backup';}};
  async function paintHistory(){const rows=await listBackupSnapshots(i.instituteCode);document.querySelector('#backup-list').innerHTML=rows.map(x=>`<article class="audit-row"><div><strong>${esc(x.backupDate)}</strong><span>${esc(x.status)}</span></div><small>${Object.values(x.recordCounts||{}).reduce((a,b)=>a+Number(b||0),0)} records</small></article>`).join('')||'<div class="empty-state"><strong>No snapshots yet.</strong><p>Create the first snapshot or download a full JSON backup.</p></div>';}
  paintHistory().catch(err=>{document.querySelector('#backup-list').innerHTML=`<p class="form-message show error">${esc(humanError(err,'Could not load backup history.'))}</p>`;});
}

async function renderSystemHealth(){
  const i=state.instituteSession;if(!i){state.screen="institute";return render();}
  app.innerHTML=shell(`<section class="card dashboard-card wide-card compact-page"><button id="health-back" class="back">← Institute Home</button><div class="compact-heading"><span class="step">Performance & stability</span><h2>System Health</h2><p>Check connection, Firebase response and backup readiness.</p></div><div id="health-summary" class="health-grid"><article><span>Network</span><strong>Checking…</strong><small>Please wait</small></article><article><span>Firebase</span><strong>Checking…</strong><small>Connection test</small></article><article><span>App Version</span><strong>${esc(HMOS_VERSION)}</strong><small>Performance Core</small></article><article><span>Latest Backup</span><strong>Checking…</strong><small>Snapshot history</small></article></div><div class="health-actions"><button id="health-refresh" class="primary compact-primary">Run Health Check</button><button id="health-backup" class="secondary compact-primary">Create Snapshot</button></div><p id="health-message" class="form-message"></p></section>`,true);
  document.querySelector('#health-back').onclick=()=>{state.screen='admin-home';render();};
  const run=async()=>{const msg=document.querySelector('#health-message'),box=document.querySelector('#health-summary');msg.textContent='Running checks…';msg.className='form-message show info';try{const [health,backups]=await Promise.all([getSystemHealth(),listBackupSnapshots(i.instituteCode)]);const latest=backups[0];const latency=Number(health.latencyMs||0);const speed=latency<500?'Excellent':latency<1500?'Good':latency<3000?'Slow':'Very slow';box.innerHTML=`<article class="${health.online?'health-ok':'health-bad'}"><span>Network</span><strong>${health.online?'Online':'Offline'}</strong><small>${health.online?'Internet available':'Reconnect to continue'}</small></article><article class="${health.ok?'health-ok':'health-bad'}"><span>Firebase</span><strong>${health.ok?'Connected':'Unavailable'}</strong><small>${health.ok?`${latency} ms · ${speed}`:esc(health.code||'Connection failed')}</small></article><article class="health-ok"><span>App Version</span><strong>${esc(HMOS_VERSION)}</strong><small>Clean single-file runtime</small></article><article class="${latest?'health-ok':'health-warn'}"><span>Latest Backup</span><strong>${latest?esc(latest.backupDate):'Not created'}</strong><small>${latest?esc(latest.status||'snapshot_complete'):'Create the first snapshot'}</small></article>`;msg.textContent=health.ok?'System check completed successfully.':'Some services need attention.';msg.className=`form-message show ${health.ok?'success-message':'error'}`;}catch(err){msg.textContent=humanError(err,'Health check failed.');msg.className='form-message show error';}};
  document.querySelector('#health-refresh').onclick=run;
  document.querySelector('#health-backup').onclick=async e=>{const b=e.currentTarget;b.disabled=true;b.textContent='Creating…';try{await createBackupSnapshot(i.instituteCode);await run();}catch(err){const m=document.querySelector('#health-message');m.textContent=humanError(err,'Could not create snapshot.');m.className='form-message show error';}finally{b.disabled=false;b.textContent='Create Snapshot';}};
  run();
}

function render(){if(state.screen==="system-health")return renderSystemHealth();if(state.screen==="approvals")return renderApprovals();if(state.screen==="admin-notifications")return renderAdminNotifications();if(state.screen==="student-notifications")return renderStudentNotifications();if(state.screen==="audit-logs")return renderAuditLogs();if(state.screen==="recycle-bin")return renderRecycleBin();if(state.screen==="backup-restore")return renderBackupRestore();if(state.screen==="super-admin")return renderSuperAdmin();if(state.screen==="institute-password-change")return renderInstitutePasswordChange();if(state.screen==="dashboard")return renderAdminDashboard();if(state.screen==="create")return renderCreate();if(state.screen==="manage")return renderManage();if(state.screen==="institute-portal")return renderInstitutePortal();if(state.screen==="admin-home")return renderInstituteAdminHome();if(state.screen==="settings")return renderSettingsHome();if(state.screen==="institute-admin-login")return renderInstituteAdminLogin();if(state.screen==="admin-login-settings")return renderAdminLoginSettings();if(state.screen==="dashboard-settings")return renderDashboardSettings();if(state.screen==="admission-fee-settings")return renderAdmissionFeeSettings();if(state.screen==="new-admission")return renderNewAdmission();if(state.screen==="manual-admission")return renderManualAdmission();if(state.screen==="admission-success")return renderAdmissionSuccess();if(state.screen==="admission-pending")return renderAdmissionPending();if(state.screen==="student-login")return renderStudentLogin();if(state.screen==="student-password-change")return renderStudentPasswordChange();if(state.screen==="student-dashboard")return renderStudentDashboard();if(state.screen==="student-profile")return renderStudentProfile();if(state.screen==="student-fees")return renderStudentFees();if(state.screen==="student-attendance")return renderStudentAttendance();if(state.screen==="student-entry-exit")return renderStudentEntryExit();if(state.screen==="student-complaints")return renderStudentComplaints();if(state.screen==="student-menu")return renderStudentMenu();if(state.screen==="institute-admin")return renderInstituteAdmin();if(state.screen==="student-manage")return renderStudentManage();if(state.screen==="room-management")return renderRoomManagement();if(state.screen==="room-manage")return renderRoomManage();if(state.screen==="fees-management")return renderFeesManagement();if(state.screen==="pending-admissions")return renderPendingAdmissions();if(state.screen==="admissions-home")return renderAdmissionsHome();if(state.screen==="kitchen")return renderKitchen();if(state.screen==="entry-exit")return renderEntryExit();if(state.screen==="complaints-admin")return renderComplaintsAdmin();if(state.screen==="pdf-reports")return renderPdfReports();return renderInstituteLogin();}

watchAuth(async user=>{state.authUser=user;if(!user){if(["dashboard","create","manage"].includes(state.screen))state.screen="super-admin";render();return;}if(user.email?.toLowerCase()!==SUPER_ADMIN_EMAIL){await logoutCurrentUser();return renderSuperAdmin("This email is not authorized as HMOS Super Admin.");}state.institutes=readCache();state.screen="dashboard";render();try{state.institutes=await listInstitutes();writeCache(state.institutes);if(state.screen==="dashboard")renderAdminDashboard();}catch(err){console.error(err);}});
try{state.adminAuthenticated=Boolean(sessionStorage.getItem(ADMIN_SESSION_KEY));}catch{}
const restoredInstitute=restoreInstituteSession();
if(restoredInstitute){
  state.instituteSession=restoredInstitute;
  state.screen="institute-portal";
  validateInstituteSession(restoredInstitute.instituteCode).then(async fresh=>{state.instituteSession=fresh;state.branding=await getInstituteBranding(fresh.instituteCode).catch(()=>restoredInstitute.branding||null);saveInstituteSession({...fresh,branding:state.branding},true);if(state.screen==="institute-portal")renderInstitutePortal();}).catch(err=>{clearInstituteSession();state.instituteSession=null;if(state.screen==="institute-portal"){state.screen="institute";renderInstituteLogin(err.code==="subscription-expired"?"Subscription expired. Contact HMOS support.":"Saved institute session expired. Please login again.");}});
}
history.replaceState({hmos:true},'',location.href);history.pushState({hmos:true},'',location.href);window.addEventListener('popstate',()=>{if(window.__HMOS_ALLOW_EXIT__)return;showExitDialog();});
let deferredInstallPrompt = null;
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
function ensureInstallButton() {
  let button = document.querySelector("#pwa-install-button");
  if (!button) {
    button = document.createElement("button");
    button.id = "pwa-install-button";
    button.className = "pwa-install-button";
    button.type = "button";
    button.innerHTML = "⬇ Install HMOS";
    document.body.appendChild(button);
  }
  button.hidden = isStandalone();
  button.onclick = async () => {
    if (isStandalone()) {
      button.hidden = true;
      return;
    }
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice.catch(() => null);
      if (choice?.outcome === "accepted") button.hidden = true;
      deferredInstallPrompt = null;
      return;
    }
    alert("Chrome menu (⋮) open చేసి ‘Install app’ నొక్కండి. ‘Create shortcut’ మాత్రమే కనిపిస్తే pageని పూర్తిగా close చేసి మళ్లీ open చేయండి; కొత్త PWA files deploy అయిన తర్వాత ‘Install app’ కనిపిస్తుంది.");
  };
  return button;
}
window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  ensureInstallButton().hidden = false;
});
window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  const button = document.querySelector("#pwa-install-button");
  if (button) button.hidden = true;
});
window.matchMedia("(display-mode: standalone)").addEventListener?.("change", () => ensureInstallButton());
ensureInstallButton();
if("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js", { scope: "./", updateViaCache: "none" })
      .catch(error => console.warn("HMOS service worker registration failed", error));
  });
}

window.addEventListener("error", event => {
  const message=String(event?.error?.message||event?.message||"");
  console.error("HMOS runtime error:", event.error || event.message);
  // Route changes can finish while an older async render is still unwinding. Those stale-DOM
  // null-reference errors are harmless and should not alarm the user when the current page works.
  const staleDomRace=/Cannot (read|set) properties of null|Cannot read property .* of null/i.test(message);
  const benignBrowserNoise=/ResizeObserver loop|Script error\.?$/i.test(message);
  if(!staleDomRace && !benignBrowserNoise){
    showConnectionBanner("A page error occurred. Reload if the screen does not recover.", "error");
  }
});
window.addEventListener("unhandledrejection", event => {
  console.error("HMOS promise error:", event.reason);
  if (event.reason?.code === "unavailable" || event.reason?.code === "deadline-exceeded") showConnectionBanner(humanError(event.reason), "error");
});
