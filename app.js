
/* Thawee Koon: Logic App (M.4) — Pure JS + localStorage
 * Works on GitHub Pages (no backend). Demo-grade authentication.
 */

const $ = (q, ctx=document)=>ctx.querySelector(q);
const $$ = (q, ctx=document)=>Array.from(ctx.querySelectorAll(q));

const DB = {
  read(key, fallback){
    try{ return JSON.parse(localStorage.getItem(key) ?? JSON.stringify(fallback)); }
    catch(_){ return fallback; }
  },
  write(key, val){ localStorage.setItem(key, JSON.stringify(val)); },
};

// Database keys
const K = {
  users: "tk_users",
  classes: "tk_classes",
  enrolls: "tk_enrollments",
  sess: "tk_session",
  puzzles: "tk_puzzles",
  attempts: "tk_attempts",
};

function uid(prefix="id"){
  return `${prefix}_${Math.random().toString(36).slice(2,10)}`;
}

// Simple hash (NOT secure, for demo only)
function hash(s){ return btoa(unescape(encodeURIComponent(s))); }

// Seed initial content if empty
function seed(){
  const users = DB.read(K.users, []);
  if(users.length === 0){
    const teacherId = uid("u");
    const studentId = uid("u");
    users.push(
      {id:teacherId, name:"ครูตัวอย่าง", username:"teacher", pass:hash("123456"), role:"teacher"},
      {id:studentId, name:"นักเรียนตัวอย่าง", username:"student", pass:hash("123456"), role:"student"},
    );
    DB.write(K.users, users);

    const c1 = {id: uid("c"), name:"ห้อง ม.4/1", code:"M41", teacherId};
    const c2 = {id: uid("c"), name:"ห้อง ม.4/2", code:"M42", teacherId};
    DB.write(K.classes, [c1, c2]);
    DB.write(K.enrolls, [{classId:c1.id, studentId}]);
  }

  const puzzles = DB.read(K.puzzles, []);
  if(puzzles.length === 0){
    const seedPuzzles = [
      {
        id: uid("p"), level:"เริ่มต้น", type:"boolean",
        title:"ลอจิกเกตพื้นฐาน",
        stem:"ให้ A=true, B=false. ผลลัพธ์ของนิพจน์ (A AND B) OR (NOT B) คืออะไร?",
        options:["true","false"],
        answer:"true",
        explain:"A AND B = false. NOT B = true. false OR true = true."
      },
      {
        id: uid("p"), level:"เริ่มต้น", type:"pattern",
        title:"ลำดับตัวเลขง่ายๆ",
        stem:"2, 4, 8, 16, ... ควรถัดไปเป็นเท่าไร?",
        options:["18","24","32","36"],
        answer:"32",
        explain:"คูณ 2 ต่อเนื่อง"
      },
      {
        id: uid("p"), level:"สนุกคิด", type:"knight",
        title:"อัศวินกับคนโกหก",
        stem:"เกาะหนึ่งมีคน 2 แบบ: อัศวินพูดความจริงเสมอ กับคนโกหกพูดเท็จเสมอ ชายคนนึงพูดว่า 'พวกเราทั้งสองเป็นคนโกหก' ชายคนนั้นเป็นอะไร?",
        options:["อัศวิน","คนโกหก","บอกไม่ได้"],
        answer:"คนโกหก",
        explain:"ถ้าเป็นอัศวินจะพูดความจริงไม่ได้ เพราะประโยคขัดแย้งในตัวเอง จึงต้องเป็นคนโกหก"
      }
    ];
    DB.write(K.puzzles, seedPuzzles);
  }

  DB.write(K.attempts, DB.read(K.attempts, []));
}

function currentSession(){
  return DB.read(K.sess, null);
}

function signOut(){
  localStorage.removeItem(K.sess);
  location.href = "index.html";
}

// Guard pages
function requireAuth(role=null){
  const sess = currentSession();
  if(!sess){ location.href="index.html"; return; }
  if(role && sess.role !== role){
    // redirect to proper page
    location.href = (sess.role === "teacher") ? "admin.html" : "student.html";
  }
  return sess;
}

function login(username, password){
  const users = DB.read(K.users, []);
  const user = users.find(u => u.username.trim().toLowerCase() === username.trim().toLowerCase());
  if(!user) return {ok:false, msg:"ไม่พบบัญชีผู้ใช้"};
  if(user.pass !== hash(password)) return {ok:false, msg:"รหัสผ่านไม่ถูกต้อง"};
  DB.write(K.sess, {id:user.id, name:user.name, role:user.role, username:user.username});
  return {ok:true, user};
}

function register(name, username, password, role){
  const users = DB.read(K.users, []);
  if(users.some(u => u.username.trim().toLowerCase() === username.trim().toLowerCase())){
    return {ok:false, msg:"ชื่อผู้ใช้นี้ถูกใช้แล้ว"};
  }
  const id = uid("u");
  users.push({id, name, username, pass:hash(password), role});
  DB.write(K.users, users);
  DB.write(K.sess, {id, name, role, username});
  return {ok:true};
}

function classesByTeacher(teacherId){
  const classes = DB.read(K.classes, []);
  return classes.filter(c => c.teacherId === teacherId);
}
function enroll(studentId, classId){
  const enrolls = DB.read(K.enrolls, []);
  if(!enrolls.some(e => e.studentId===studentId && e.classId===classId)){
    enrolls.push({classId, studentId});
    DB.write(K.enrolls, enrolls);
  }
}
function myClasses(studentId){
  const enrolls = DB.read(K.enrolls, []);
  const classes = DB.read(K.classes, []);
  const ids = enrolls.filter(e=>e.studentId===studentId).map(e=>e.classId);
  return classes.filter(c => ids.includes(c.id));
}

// Quiz engine
function getPuzzles(){ return DB.read(K.puzzles, []); }
function saveAttempt({userId, puzzleId, correct}){
  const attempts = DB.read(K.attempts, []);
  attempts.push({id:uid("a"), userId, puzzleId, correct, ts:Date.now()});
  DB.write(K.attempts, attempts);
}

function percent(n, d){ return d===0 ? 0 : Math.round((n/d)*100); }

// Page initializers
function initIndex(){
  seed();
  const tabLogin = $("#tab-login"), tabReg = $("#tab-register");
  const cardLogin = $("#card-login"), cardRegister = $("#card-register");

  tabLogin.addEventListener("click", ()=>{
    tabLogin.classList.add("active"); tabReg.classList.remove("active");
    cardLogin.classList.remove("hidden"); cardRegister.classList.add("hidden");
  });
  tabReg.addEventListener("click", ()=>{
    tabReg.classList.add("active"); tabLogin.classList.remove("active");
    cardRegister.classList.remove("hidden"); cardLogin.classList.add("hidden");
  });

  $("#loginForm").addEventListener("submit", e=>{
    e.preventDefault();
    const u = $("#login_user").value, p = $("#login_pass").value;
    const {ok, msg, user} = login(u,p);
    const el = $("#login_msg");
    if(!ok){ el.textContent = msg; el.style.color="var(--danger)"; return; }
    el.textContent = "เข้าสู่ระบบสำเร็จ ✓"; el.style.color="var(--success)";
    setTimeout(()=>{
      location.href = (user.role==="teacher") ? "admin.html" : "student.html";
    }, 400);
  });

  $("#regForm").addEventListener("submit", e=>{
    e.preventDefault();
    const name = $("#reg_name").value.trim();
    const user = $("#reg_user").value.trim();
    const pass = $("#reg_pass").value;
    const role = $("#reg_role").value;
    const el = $("#reg_msg");
    if(name.length<2 || user.length<3 || pass.length<6){
      el.textContent = "กรอกข้อมูลให้ครบ: ชื่อ ≥2, ผู้ใช้ ≥3, รหัสผ่าน ≥6"; el.style.color="var(--danger)"; return;
    }
    const {ok, msg} = register(name,user,pass,role);
    if(!ok){ el.textContent = msg; el.style.color="var(--danger)"; return; }
    el.textContent = "สมัครสำเร็จ ✓ กำลังพาไปยังหน้าหลัก..."; el.style.color="var(--success)";
    setTimeout(()=>{
      location.href = (role==="teacher") ? "admin.html" : "student.html";
    }, 400);
  });
}

function initStudent(){
  const sess = requireAuth("student"); if(!sess) return;
  $("#userName").textContent = sess.name;

  // Load classes
  const list = $("#classList");
  const classes = DB.read(K.classes, []);
  list.innerHTML = "";
  classes.forEach(c=>{
    const li = document.createElement("div");
    li.className = "card";
    li.innerHTML = `
      <div class="grid cols-2">
        <div>
          <div class="section-title">🧩 ${c.name}</div>
          <div class="small">รหัสห้อง: <span class="kbd">${c.code}</span></div>
        </div>
        <div style="display:flex; gap:8px; align-items:center; justify-content:flex-end">
          <button class="btn accent" data-join="${c.id}">เข้าร่วมห้อง</button>
          <button class="btn" data-play="${c.id}">เริ่มทำแบบฝึก</button>
        </div>
      </div>
    `;
    list.appendChild(li);
  });

  list.addEventListener("click", (e)=>{
    const joinId = e.target.getAttribute("data-join");
    const playId = e.target.getAttribute("data-play");
    if(joinId){ enroll(sess.id, joinId); toast("เข้าร่วมห้องเรียนแล้ว ✓"); renderMyClasses(); }
    if(playId){ openQuizModal(playId); }
  });

  renderMyClasses();
  renderStats();

  $("#logoutBtn").addEventListener("click", signOut);
}

function renderMyClasses(){
  const sess = currentSession();
  const wrap = $("#myClasses");
  const my = myClasses(sess.id);
  wrap.innerHTML = my.map(c=>`<span class="badge">🏫 ${c.name}</span>`).join(" ") || `<span class="small">ยังไม่ได้เข้าร่วมห้อง</span>`;
}

function renderStats(){
  const sess = currentSession();
  const attempts = DB.read(K.attempts, []).filter(a=>a.userId===sess.id);
  const puzzles = DB.read(K.puzzles, []);
  const correct = attempts.filter(a=>a.correct).length;
  $("#statAll").textContent = `${attempts.length}`;
  $("#statCorrect").textContent = `${correct}`;
  $("#statRate").textContent = `${percent(correct, attempts.length)}%`;
  $("#recentList").innerHTML = attempts.slice(-5).reverse().map(a=>{
    const p = puzzles.find(x=>x.id===a.puzzleId);
    const icon = a.correct ? "✅" : "❌";
    const when = new Date(a.ts).toLocaleString();
    return `<div class="card"><b>${icon} ${p?.title ?? "ข้อไม่ทราบชื่อ"}</b><div class="small">${when}</div></div>`;
  }).join("");
}

function openQuizModal(classId){
  const puzzles = getPuzzles();
  const modal = $("#quizModal");
  const content = $("#quizContent");
  let idx = 0, score = 0;

  function render(){
    const p = puzzles[idx];
    if(!p){ // end
      content.innerHTML = `
        <div class="card">
          <div class="section-title">สรุปผล</div>
          <p>ทำได้ <b>${score}</b> / ${puzzles.length} ข้อ</p>
          <button class="btn" id="qClose">ปิด</button>
        </div>`;
      $("#qClose").onclick = ()=>{ modal.classList.add("hidden"); renderStats(); };
      return;
    }
    content.innerHTML = `
      <div class="card">
        <div class="section-title">ข้อที่ ${idx+1}: ${p.title}</div>
        <p style="margin-top:-6px">${p.stem}</p>
        <div class="grid cols-2" id="opts"></div>
        <div class="small">ประเภท: ${p.type} • ระดับ: ${p.level}</div>
      </div>`;
    const opts = $("#opts");
    p.options.forEach(opt=>{
      const b = document.createElement("button");
      b.className = "btn ghost";
      b.textContent = opt;
      b.onclick = ()=>{
        const correct = (opt===p.answer);
        saveAttempt({userId: currentSession().id, puzzleId: p.id, correct});
        if(correct){ toast("ถูกต้อง! ✓"); score++; }
        else { toast("ยังไม่ถูก ลองใหม่ในข้อถัดไป"); }
        idx++; render();
      };
      opts.appendChild(b);
    });
  }

  modal.classList.remove("hidden");
  render();
}

// Toast
let toastTimer=null;
function toast(msg){
  const t = $("#toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> t.classList.add("hidden"), 1400);
}

// -------- Admin page ----------
function initAdmin(){
  const sess = requireAuth("teacher"); if(!sess) return;
  $("#userName").textContent = sess.name;
  $("#logoutBtn").addEventListener("click", signOut);

  const cList = $("#classTableBody");
  function renderClasses(){
    const my = classesByTeacher(sess.id);
    cList.innerHTML = my.map(c=>`
      <tr>
        <td>${c.name}</td>
        <td><span class="kbd">${c.code}</span></td>
        <td>
          <button class="btn ghost" data-view="${c.id}">ดูสมาชิก</button>
          <button class="btn" data-assign="${c.id}">มอบหมายแบบฝึก</button>
          <button class="btn danger" data-del="${c.id}">ลบ</button>
        </td>
      </tr>
    `).join("");
  }
  renderClasses();

  $("#newClassForm").addEventListener("submit", e=>{
    e.preventDefault();
    const name = $("#cls_name").value.trim();
    const code = $("#cls_code").value.trim() || Math.random().toString(36).slice(2,6).toUpperCase();
    if(name.length<2){ toast("ตั้งชื่อห้องให้ชัดเจน"); return; }
    const cls = DB.read(K.classes, []);
    cls.push({id:uid("c"), name, code, teacherId:sess.id});
    DB.write(K.classes, cls);
    e.target.reset(); toast("สร้างห้องแล้ว ✓"); renderClasses();
  });

  $("#classTable").addEventListener("click", e=>{
    const id = e.target.getAttribute("data-del");
    const vid = e.target.getAttribute("data-view");
    const aid = e.target.getAttribute("data-assign");
    if(id){
      const cls = DB.read(K.classes, []).filter(c=>c.id!==id);
      DB.write(K.classes, cls);
      const enrolls = DB.read(K.enrolls, []).filter(x=>x.classId!==id);
      DB.write(K.enrolls, enrolls);
      toast("ลบห้องเรียนแล้ว"); renderClasses();
    }
    if(vid){ openMembers(vid); }
    if(aid){ openAssign(vid || aid); }
  });

  function openMembers(classId){
    const users = DB.read(K.users, []);
    const enrolls = DB.read(K.enrolls, []).filter(e=>e.classId===classId);
    const studs = enrolls.map(e=>users.find(u=>u.id===e.studentId)).filter(Boolean);
    const modal = $("#adminModal");
    const body = $("#adminModalBody");
    modal.classList.remove("hidden");
    body.innerHTML = `
      <div class="section-title">สมาชิกห้อง</div>
      <table class="table">
        <thead><tr><th>ชื่อ</th><th>ผู้ใช้</th><th>บทบาท</th></tr></thead>
        <tbody>
          ${studs.map(s=>`<tr><td>${s.name}</td><td>${s.username}</td><td>${s.role}</td></tr>`).join("") || `<tr><td colspan="3">ยังไม่มีนักเรียนเข้าร่วม</td></tr>`}
        </tbody>
      </table>
      <div style="text-align:right"><button class="btn" id="amClose">ปิด</button></div>
    `;
    $("#amClose").onclick = ()=> modal.classList.add("hidden");
  }

  function openAssign(classId){
    const puzzles = getPuzzles();
    const modal = $("#adminModal");
    const body = $("#adminModalBody");
    modal.classList.remove("hidden");
    body.innerHTML = `
      <div class="section-title">มอบหมายแบบฝึก</div>
      <p class="small">ชุดแบบฝึกที่มีอยู่ (${puzzles.length} ข้อ). *ระบบนี้เป็นเดโม นักเรียนจะเห็นเหมือนกันทุกห้อง*</p>
      <div style="text-align:right"><button class="btn" id="amOk">ตกลง</button></div>
    `;
    $("#amOk").onclick = ()=>{ modal.classList.add("hidden"); toast("มอบหมายแล้ว (เดโม)"); };
  }

  // Puzzle management (basic create)
  $("#pzForm").addEventListener("submit", e=>{
    e.preventDefault();
    const title = $("#pz_title").value.trim();
    const stem = $("#pz_stem").value.trim();
    const opts = $("#pz_opts").value.split("|").map(s=>s.trim()).filter(Boolean);
    const ans = $("#pz_ans").value.trim();
    const lvl = $("#pz_level").value;
    if(!title || !stem || opts.length<2 || !ans){ toast("กรอกข้อมูลให้ครบ และตัวเลือกคั่นด้วย | "); return; }
    const puzzles = getPuzzles();
    puzzles.push({id:uid("p"), level:lvl, type:"custom", title, stem, options:opts, answer:ans, explain:""});
    DB.write(K.puzzles, puzzles);
    e.target.reset();
    toast("เพิ่มข้อใหม่แล้ว ✓");
  });
}

// Expose init functions
window.TK = { initIndex, initStudent, initAdmin, signOut };
