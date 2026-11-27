/* AI 教科書平台：前端程式（學生版／教師版共用，由 tools/build.py 注入內容）
 * 介面按鈕與提示是平台用語；教材文字全部來自 units/ 內容檔（已逐字比對原始檔）。 */
(function () {
  "use strict";
  const TB = window.TB;
  const T = TB.mode === "teacher";
  const $app = document.getElementById("app");
  const PENDING = "待補";

  // ---------- 小工具 ----------
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "html") el.innerHTML = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const c of kids.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }
  const pre = (s, cls) => h("div", { class: "pre " + (cls || "") }, s);
  const now = () => new Date().toISOString();
  const teacherBox = (label, ...kids) => T ? h("div", { class: "teacher" }, h("div", { class: "tl" }, "教師版　" + label), ...kids) : null;
  const pendingBox = (what, extra) => h("div", { class: "pending-box" }, h("b", null, PENDING + "　"), what, extra ? h("div", { class: "small muted pre" }, extra) : null);
  function kvTable(rows) {
    return h("div", { class: "tablewrap" }, h("table", { class: "kv" }, rows.map(r => h("tr", null, h("th", null, r.label), h("td", null, r.value)))));
  }
  function table(header, rows) {
    return h("div", { class: "tablewrap" }, h("table", null,
      header ? h("thead", null, h("tr", null, header.map(x => h("th", null, x)))) : null,
      h("tbody", null, rows.map(r => h("tr", null, r.map(c => h("td", null, c)))))));
  }
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || "null"); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  function storeDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function storeKeys(prefix) { const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(prefix)) out.push(k); } } catch (e) {} return out; }
  function download(name, text, type) {
    const blob = new Blob([text], { type: type || "application/json" });
    const a = h("a", { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  // 兩段式確認（不用瀏覽器確認對話框，嵌入框架中也能運作）
  function confirmBtn(label, ask, action, cls) {
    let armed = false, timer = 0;
    const b = h("button", { class: cls || "", onclick: () => {
      if (!armed) { armed = true; b.textContent = ask; b.classList.add("primary"); timer = setTimeout(() => { armed = false; b.textContent = label; if (!cls) b.classList.remove("primary"); }, 4000); return; }
      clearTimeout(timer); action();
    } }, label);
    return b;
  }
  const unitById = id => TB.units.find(u => u.meta.id === id);

  // ---------- 學生代碼與作答紀錄 ----------
  const SID_KEY = "tb:sid";
  function sid() { return store(SID_KEY) || ""; }
  function recKey(u, n) { return `tb:rec:${u.meta.id}:${sid()}:L${n}`; }
  function getRec(u, n) {
    let r = store(recKey(u, n));
    if (!r) r = { schema: "tb-record/1", student_code: sid(), unit: u.meta.id, unit_title: u.meta.title, lesson: n,
      material_version: u.meta.material_version, site_build: TB.built_at, started_at: now(), updated_at: now(),
      items: {}, ops: [], hints: [], handoff: [] };
    return r;
  }
  function saveRec(u, n, r) { r.updated_at = now(); store(recKey(u, n), r); }
  function logOp(u, n, type, detail) { if (T) return; const r = getRec(u, n); r.ops.push({ at: now(), type, detail }); saveRec(u, n, r); }
  function recFileName(u, n) { return `${sid() || "未填代碼"}_${u.meta.title}_第${n}節.json`; }

  function askSid(force) {
    if (T) return;
    if (sid() && !force) return;
    const inp = h("input", { type: "text", placeholder: "例如：10512", value: sid() });
    const bg = h("div", { class: "modal-bg" }, h("div", { class: "modal" },
      h("h3", null, "輸入學生代碼"),
      h("p", { class: "small muted" }, "作答會用這個代碼暫存在這台裝置的瀏覽器，下載的紀錄檔也以它命名。不需要帳號。"),
      inp,
      h("div", { class: "toolbar" }, h("button", { class: "primary", onclick: () => {
        const v = inp.value.trim().replace(/[\\/:*?"<>|\s]/g, "");
        if (!v) { inp.focus(); return; }
        store(SID_KEY, v); bg.remove(); route();
      } }, "開始"))));
    document.body.append(bg); inp.focus();
  }
  function clearLocal() {
    storeKeys("tb:").forEach(storeDel);
    location.hash = "#/"; route();
  }

  // ---------- 外框 ----------
  function shell(u, active, content) {
    $app.innerHTML = "";
    const top = h("div", { class: "topbar" },
      h("a", { href: "#/", class: "brand", style: "text-decoration:none;color:inherit" }, "AI 教科書"),
      h("span", { class: "mode " + (T ? "t" : "") }, T ? "教師版" : "學生版"),
      h("span", { class: "spacer" }),
      !T ? h("span", { class: "sid" }, "學生代碼：", sid() || "（未填）", " ", h("button", { class: "link", onclick: () => askSid(true) }, "變更")) : null,
      !T ? confirmBtn("清除本機紀錄", "確定清除？紀錄無法復原（再按一次）", clearLocal) : null);
    const side = u ? sideNav(u, active) : null;
    const main = h("main", null, content);
    $app.append(top, u ? h("div", { class: "layout" }, side, main) : h("div", { class: "layout", style: "grid-template-columns:1fr;max-width:1000px" }, main));
    window.scrollTo(0, 0);
  }
  function sideNav(u, active) {
    const id = u.meta.id; const L = (href, label, key, cls) => h("a", { href: `#/u/${id}${href}`, class: (active === key ? "on " : "") + (cls || "") }, label);
    return h("nav", { class: "side" },
      h("div", { class: "sec" }, u.meta.title),
      L("", "單元首頁", "home"),
      L("/test/pretest", "前測", "pretest"),
      u.meta.lessons.map(l => L(`/lesson/${l.n}`, l.title, "L" + l.n)),
      L("/test/posttest", "後測", "posttest"),
      L("/extension", "延伸學習", "ext"),
      L("/assets", "素材庫", "assets"),
      L("/print", "列印中心", "print"),
      T ? [h("div", { class: "sec" }, "教師版"),
        L("/design", "單元教學設計", "design", "t"),
        L("/blueprint", "雙向細目表", "blueprint", "t"),
        L("/misconceptions", "學習困難速查", "mis", "t"),
        L("/grade", "匯入作答與批改", "grade", "t")] : null);
  }

  // ---------- 平台首頁 ----------
  function pageHome() {
    const fields = [...new Set(TB.units.map(u => u.meta.field))], grades = [...new Set(TB.units.map(u => u.meta.grade))];
    let ff = "", gf = "";
    const list = h("div", { class: "grid" });
    function draw() {
      list.innerHTML = "";
      TB.units.filter(u => (!ff || u.meta.field === ff) && (!gf || u.meta.grade === gf)).forEach(u => list.append(
        h("a", { href: `#/u/${u.meta.id}`, class: "card", style: "text-decoration:none;color:inherit;display:block" },
          h("div", { class: "small muted" }, u.meta.field, "｜", u.meta.grade),
          h("h3", { style: "margin:.2rem 0" }, u.meta.title),
          h("div", { class: "small" }, u.meta.lessons.map(l => l.title).join("\n")))));
    }
    const sel = (opts, set) => h("select", { style: "width:auto", onchange: e => { set(e.target.value); draw(); } }, h("option", { value: "" }, "全部"), opts.map(o => h("option", { value: o }, o)));
    shell(null, null, [h("h1", null, "單元清單"),
      h("div", { class: "toolbar" }, "領域：", sel(fields, v => ff = v), "　年級：", sel(grades, v => gf = v)),
      list]);
    draw();
  }

  // ---------- 單元首頁 ----------
  function pageUnit(u) {
    const tx = u.text, pl = u.plan;
    shell(u, "home", [
      h("div", { class: "crumb" }, "單元首頁"),
      h("h1", null, u.meta.title),
      h("h2", null, "單元總覽"),
      kvTable(tx.overview),
      h("div", { class: "small muted" }, "來源：", tx.source),
      h("h3", null, "核心問題與核心理解"),
      kvTable(pl.design.filter(d => d.student || T)),
      h("h3", null, "學習路徑"),
      h("p", null, pl.path),
      h("h3", null, "知識節點順序"),
      table(["順序", "知識節點名稱", "核心知識", "銜接依據"], tx.node_order.map(n => [n.no, n.name, n.core, n.link])),
      h("h3", null, "學習目標"),
      T ? table(["序", "學習目標", "可觀察證據", "達成規準"], pl.objectives.map(o => [o.no, o.goal, o.teacher.evidence, o.teacher.criteria]))
        : table(["序", "學習目標"], pl.objectives.map(o => [o.no, o.goal])),
      h("h2", null, "節次"),
      h("div", { class: "grid" }, u.meta.lessons.map((l, i) => {
        const ov = pl.overview_rows[i];
        return h("a", { href: `#/u/${u.meta.id}/lesson/${l.n}`, class: "card", style: "text-decoration:none;color:inherit;display:block" },
          h("h3", { style: "margin:0 0 .3rem" }, l.title),
          h("div", { class: "small" }, "本節功能：", ov.function), h("div", { class: "small" }, "核心問題／重點：", ov.question),
          h("div", { class: "small" }, "教材／活動：", ov.material), h("div", { class: "small" }, "學生主要產出：", ov.output),
          h("div", { class: "small muted" }, ov.time));
      })),
      h("h2", null, "課綱依據（國中先備）"),
      h("div", { class: "small muted" }, "來源：", tx.curriculum.source),
      h("ul", null, tx.curriculum.items.map(x => h("li", null, x))),
      T && tx.curriculum.teacher ? teacherBox("提醒", tx.curriculum.teacher.reminder) : null,
      !T ? [h("h2", null, "我的作答紀錄"),
        h("div", { class: "toolbar" }, u.meta.lessons.map(l => h("button", { onclick: () => download(recFileName(u, l.n), JSON.stringify(getRec(u, l.n), null, 2)) }, `下載第${l.n}節紀錄`)),
          h("button", { class: "primary", onclick: () => download(`${sid() || "未填代碼"}_${u.meta.title}_完整紀錄.json`, JSON.stringify(u.meta.lessons.map(l => getRec(u, l.n)), null, 2)) }, "下載完整紀錄")),
        h("p", { class: "small muted" }, "把下載的檔案交到 Google Classroom 或老師指定的雲端資料夾。")] : null,
    ]);
  }

  // ---------- 內容元件：教材文本 ----------
  function textBlock(u, node, paras) {
    const nd = u.text.nodes[node];
    const first = paras.includes(0);
    return h("div", { class: "text-block" },
      first ? h("div", { class: "small muted" }, "知識節點 ", nd.title) : null,
      first ? h("div", { class: "understand" }, h("b", null, "核心理解　"), nd.understanding) : null,
      paras.map(i => h("p", null, nd.body[i])),
      h("div", { class: "src" }, "來源：", u.text.source),
      T && nd.teacher ? teacherBox("查核",
        nd.teacher.curriculum_note ? h("div", null, nd.teacher.curriculum_note) : null,
        h("div", null, h("b", null, nd.teacher.check_label, "："), nd.teacher.check.join("　")),
        h("div", null, h("b", null, nd.teacher.self_check_label, "："), pre(nd.teacher.self_check.join("\n"))),
        h("div", { class: "small" }, u.text.formal_note)) : null);
  }
  function condBlock(u, node) {
    const nd = u.text.nodes[node];
    return h("details", { class: "cond" }, h("summary", null, "成立條件與易混淆處（", nd.title, "）"), h("p", null, nd.conditions));
  }

  // ---------- 內容元件：素材 ----------
  function commonsUrl(a, w) { return `https://commons.wikimedia.org/wiki/Special:FilePath/${a.commons}?width=${w || 900}`; }
  function assetCard(u, a, ctx) {
    const lesson = ctx && ctx.lesson;
    const badge = h("span", { class: "badge k-" + a.kind }, a.kind);
    let media;
    if (a.id === "SIM-superpose-07B") return h("div", { class: "asset wide" }, superposeSim(u, lesson), h("div", { class: "meta" }, badge, " ", a.file, "　", h("span", { class: "lic" }, a.license), assetTeacher(a)));
    if (a.commons) {
      const ph = h("div", { class: "ph", style: "display:none" }, "圖片無法載入（離線或連線受限）", h("br"), a.file);
      const img = h("img", { src: commonsUrl(a, 700), alt: a.file, loading: "lazy",
        onerror: () => { img.style.display = "none"; ph.style.display = "flex"; },
        onclick: () => { lightbox(a); if (lesson) logOp(u, lesson, "放大照片", a.id); } });
      media = [img, ph];
    } else {
      media = h("div", { class: "ph" }, h("div", null, h("span", { class: "badge pending" }, "素材檔" + PENDING), h("br"), a.file));
    }
    return h("div", { class: "asset" }, media,
      h("div", { class: "meta" }, badge, h("span", { class: "small muted" }, a.type), h("div", { class: "fn" }, a.file),
        h("div", { class: "lic" }, "來源／授權：", a.license, a.source_url ? [" ", h("a", { href: a.source_url, target: "_blank", rel: "noopener" }, "來源頁")] : null),
        assetTeacher(a)));
  }
  function assetTeacher(a) {
    if (!T || !a.teacher) return null;
    return h("div", { class: "teacher small" }, h("div", { class: "tl" }, "教師版　用途"), a.teacher.use, a.teacher.needs ? h("div", null, h("b", null, "使用需求："), a.teacher.needs) : null);
  }
  function lightbox(a) {
    const lb = h("div", { class: "lightbox", onclick: () => lb.remove() },
      h("img", { src: commonsUrl(a, 1600), alt: a.file }),
      h("div", { class: "small" }, a.file, "　", a.license), h("button", null, "關閉"));
    document.body.append(lb);
  }

  // ---------- 07B 疊加模擬（依 07B 需求腳本） ----------
  function superposeSim(u, lesson) {
    const W = 900, H = 360;
    const cv = h("canvas", { width: W, height: H });
    const ctx = cv.getContext("2d");
    let hA = 1, hB = 1, t = 0, playing = false, last = 0, raf = 0;
    const width = 0.2, speed = 0.05; // 全寬 20%；每秒 5% 畫面寬度
    const pulse = (x, c, a) => Math.abs(x - c) < width / 2 ? a * (1 + Math.cos(Math.PI * (x - c) / (width / 2))) / 2 : 0;
    const yA = x => pulse(x, 0.25 + speed * t, hA), yB = x => pulse(x, 0.75 - speed * t, hB);
    const fmt = v => (v > 0.0001 ? "＋" : v < -0.0001 ? "－" : "") + Math.abs(v).toFixed(2);
    const readout = h("div", { class: "readout" });
    function plot(y0, hh, fn, style) {
      ctx.save(); ctx.strokeStyle = "#111"; ctx.lineWidth = style.w; ctx.setLineDash(style.dash || []);
      ctx.beginPath();
      for (let i = 0; i <= 600; i++) { const x = i / 600, px = 40 + x * (W - 60), py = y0 - fn(x) / 3 * (hh / 2); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.stroke(); ctx.restore();
    }
    function frame() {
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
      ctx.font = "14px sans-serif"; ctx.fillStyle = "#333";
      const regions = [{ y: 90, hh: 150, label: "分波 A、B" }, { y: 270, hh: 150, label: "合成繩形" }];
      regions.forEach(r => {
        ctx.strokeStyle = "#bbb"; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(40, r.y); ctx.lineTo(W - 20, r.y); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillText(r.label, 44, r.y - r.hh / 2 + 14); ctx.fillStyle = "#888"; ctx.fillText("平衡位置", W - 80, r.y - 4);
        [-3, 3].forEach(v => ctx.fillText((v > 0 ? "＋" : "－") + "3", 6, r.y - v / 3 * (r.hh / 2) + 5)); ctx.fillStyle = "#333";
      });
      const px = 40 + 0.5 * (W - 60);
      ctx.strokeStyle = "#c33"; ctx.beginPath(); ctx.moveTo(px, 10); ctx.lineTo(px, H - 10); ctx.stroke(); ctx.fillStyle = "#c33"; ctx.fillText("P", px + 4, 24); ctx.fillStyle = "#333";
      plot(90, 150, yA, { w: 1.5 }); plot(90, 150, yB, { w: 1.5, dash: [7, 5] });
      ctx.fillText("A（細實線）", 0.25 * (W - 60) + 20 + speed * t * (W - 60), 40);
      ctx.fillText("B（虛線）", 0.75 * (W - 60) + 10 - speed * t * (W - 60), 40);
      plot(270, 150, x => yA(x) + yB(x), { w: 3.5 });
      ctx.fillStyle = "#666"; ctx.fillText("理想線性介質中的模型示意", 44, H - 8);
      const a = yA(0.5), b = yB(0.5);
      readout.textContent = `P點：A ${fmt(a)}　B ${fmt(b)}　合成 ${fmt(a + b)}　（t = ${t.toFixed(1)} 秒）`;
    }
    function tick(ts) { if (!playing) return; if (last) t += (ts - last) / 1000; last = ts; if (t > 18) { t = 18; playing = false; playBtn.textContent = "播放"; } frame(); if (playing) raf = requestAnimationFrame(tick); }
    function reset(keepH) { playing = false; cancelAnimationFrame(raf); t = 0; last = 0; if (!keepH) { hA = 1; hB = 1; sA.value = 1; sB.value = 1; } lab(); playBtn.textContent = "播放"; frame(); }
    const playBtn = h("button", { class: "primary", onclick: () => {
      playing = !playing; playBtn.textContent = playing ? "暫停" : "播放"; last = 0;
      if (lesson) logOp(u, lesson, playing ? "模擬播放" : "模擬暫停", `A=${hA},B=${hB},t=${t.toFixed(1)}`);
      if (playing) raf = requestAnimationFrame(tick);
    } }, "播放");
    const mk = () => h("input", { type: "range", min: -1.5, max: 1.5, step: 0.1, value: 1, style: "width:100%" });
    const sA = mk(), sB = mk(), lA = h("span"), lB = h("span");
    const lab = () => { lA.textContent = fmt(hA).replace(".00", ""); lB.textContent = fmt(hB).replace(".00", ""); };
    sA.oninput = () => { hA = +sA.value; reset(true); }; sB.oninput = () => { hB = +sB.value; reset(true); };
    sA.onchange = sB.onchange = () => lesson && logOp(u, lesson, "調整脈衝高度", `A=${hA},B=${hB}`);
    const kase = (a, b, name) => h("button", { onclick: () => { hA = a; hB = b; sA.value = a; sB.value = b; reset(true); lesson && logOp(u, lesson, "切換案例", name); } }, name);
    lab(); frame();
    return h("div", { class: "sim" }, cv,
      h("div", { class: "ctl" },
        h("label", null, "脈衝高度 A（含正負號）：", lA, sA),
        h("label", null, "脈衝高度 B（含正負號）：", lB, sB)),
      h("div", { class: "toolbar" }, playBtn, kase(1, 1, "同向"), kase(1, -1, "反向"), h("button", { onclick: () => { reset(false); lesson && logOp(u, lesson, "模擬重設", ""); } }, "重設")),
      readout);
  }

  // ---------- 內容元件：畫板 ----------
  function drawPad(value, onSave, disabled) {
    const cv = h("canvas", { class: "pad", width: 640, height: 200 });
    const ctx = cv.getContext("2d");
    function paintBg() { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height); ctx.strokeStyle = "#ddd"; ctx.beginPath(); ctx.moveTo(cv.width / 2, 0); ctx.lineTo(cv.width / 2, cv.height); ctx.stroke(); ctx.fillStyle = "#aaa"; ctx.font = "12px sans-serif"; ctx.fillText("中央", cv.width / 2 + 4, 14); ctx.fillText("左側", 6, 14); ctx.fillText("右側", cv.width - 34, 14); }
    paintBg();
    if (value) { const im = new Image(); im.onload = () => ctx.drawImage(im, 0, 0); im.src = value; }
    let down = false, eraser = false, lx = 0, ly = 0;
    const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
    if (!disabled) {
      cv.addEventListener("pointerdown", e => { down = true; [lx, ly] = pos(e); cv.setPointerCapture(e.pointerId); });
      cv.addEventListener("pointermove", e => { if (!down) return; const [x, y] = pos(e); ctx.strokeStyle = eraser ? "#fff" : "#111"; ctx.lineWidth = eraser ? 22 : 6; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(x, y); ctx.stroke(); lx = x; ly = y; });
      const up = () => { if (down) { down = false; onSave(cv.toDataURL("image/png")); } };
      cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
    }
    const penB = h("button", { onclick: () => { eraser = false; penB.className = "primary"; erB.className = ""; } , class: "primary" }, "畫筆（深色＝暗）");
    const erB = h("button", { onclick: () => { eraser = true; erB.className = "primary"; penB.className = ""; } }, "橡皮擦");
    return h("div", null, disabled ? null : h("div", { class: "padbar" }, penB, erB, h("button", { onclick: () => { paintBg(); onSave(""); } }, "全部清除")), cv);
  }

  // ---------- 學習單題目 ----------
  function partsFilled(q, parts) {
    if (!q.parts) return !!(parts && parts.x && parts.x.trim());
    return q.parts.every(p => {
      const v = parts && parts[p.id];
      if (p.type === "draw") return true; // 作圖不強制
      if (p.type === "choice") return !!v;
      return !!(v && String(v).trim());
    });
  }
  function anyFilled(parts) { return parts && Object.values(parts).some(v => v && String(v).trim()); }
  function renderParts(q, parts, onChange, ro) {
    const out = [];
    let lastGroup = null, grid = null;
    (q.parts || [{ id: "x", type: "text", lines: 4 }]).forEach(p => {
      const val = parts[p.id] || "";
      if (p.type === "choice") {
        const name = "c" + Math.random().toString(36).slice(2);
        const opts = h("div", { class: "opts" }, p.options.map(o => h("label", null,
          h("input", { type: "radio", name, value: o, checked: val === o, disabled: ro, onchange: () => onChange(p.id, o) }), o,
          o === "其他：" ? h("input", { type: "text", style: "width:10rem", value: parts[p.id + "_other"] || "", disabled: ro, oninput: e => onChange(p.id + "_other", e.target.value) }) : null)));
        if (p.group) {
          if (p.group !== lastGroup) { grid = h("div", { class: "choice-grid" }); out.push(h("div", { class: "part" }, grid)); lastGroup = p.group; grid.append(h("b", null, p.group)); } else grid.append(h("span"));
          grid.append(h("span", null, p.label), opts);
        } else out.push(h("div", { class: "part" }, p.label ? h("label", { class: "pl" }, p.label) : null, opts));
      } else if (p.type === "draw") {
        out.push(h("div", { class: "part" }, p.label ? h("label", { class: "pl" }, p.label) : h("label", { class: "pl" }, "作圖區"), drawPad(val, d => onChange(p.id, d), ro)));
      } else {
        const ta = h("textarea", { rows: Math.max(1, p.lines || 3), disabled: ro, oninput: e => onChange(p.id, e.target.value) }); ta.value = val;
        out.push(h("div", { class: "part" }, p.label ? h("label", { class: "pl" }, p.label) : null, ta));
      }
    });
    return out;
  }
  function partsSummary(q, parts) {
    if (!parts) return "（未作答）";
    return (q.parts || [{ id: "x", type: "text" }]).map(p => {
      const v = parts[p.id];
      if (p.type === "draw") return v ? "［作圖］" : "";
      const lab = (p.group || "") + (p.label || "");
      return v ? (lab ? lab + " " : "") + v + (parts[p.id + "_other"] ? " " + parts[p.id + "_other"] : "") : "";
    }).filter(Boolean).join("\n") || "（未作答）";
  }

  function questionCard(u, lesson, q, ctx) {
    const ws = u.worksheets[lesson];
    const box = h("div", { class: "q" });
    const rec = () => getRec(u, lesson);
    function item() { const r = rec(); return r.items[q.id] || { parts: {} }; }
    function setItem(it) { const r = rec(); r.items[q.id] = it; saveRec(u, lesson, r); }
    function draw() {
      box.innerHTML = "";
      const it = item();
      const locked = q.lock && it.submitted_at;
      box.className = "q" + (locked ? " locked" : "");
      box.append(h("div", { class: "qh" }, q.label, q.lock ? h("span", { class: "badge", style: "margin-left:.5rem" }, "預測") : null));
      if (q.prompt) box.append(h("div", { class: "prompt" }, q.prompt));
      else box.append(pendingBox("題目文字" + PENDING, q.plan_ref ? "02 教案：" + q.plan_ref : ""));
      if (q.revise_of) {
        const src = getRec(u, q.revise_of.lesson).items[q.revise_of.q];
        const sq = u.worksheets[q.revise_of.lesson].questions.find(x => x.id === q.revise_of.q);
        box.append(h("div", { class: "draft" }, h("b", null, `第${q.revise_of.lesson}節${sq.label} 原稿：`), pre(T ? "（學生作答）" : partsSummary(sq, src && (src.draft ? src.draft.parts : src.parts)))));
      }
      if (T) {
        box.append(...renderParts(q, {}, () => {}, true));
        const tch = q.teacher;
        if (tch) box.append(teacherBox("參考答案與判讀", tch.answer.map(x => h("p", null, x)), tch.errors ? [h("div", { class: "tl" }, "常見錯誤與引導"), tch.errors.map(x => h("p", null, x))] : null));
        else box.append(teacherBox("參考答案與判讀", pendingBox("參考答案與判讀" + PENDING)));
        return;
      }
      if (it.draft && !q.lock) box.append(h("details", { class: "draft" }, h("summary", null, "初稿（已保存 ", new Date(it.draft.at).toLocaleString("zh-TW"), "）"), pre(partsSummary(q, it.draft.parts))));
      box.append(...renderParts(q, it.parts, (pid, v) => {
        const cur = item(); cur.parts[pid] = v; cur.edited_at = now(); setItem(cur); stateEl.textContent = "已自動暫存 " + new Date().toLocaleTimeString("zh-TW");
        updButtons();
      }, locked));
      let reasonTa = null;
      if (it.draft && !q.lock) {
        reasonTa = h("textarea", { rows: 2, oninput: e => { const cur = item(); cur.revision_reason = e.target.value; setItem(cur); } }); reasonTa.value = it.revision_reason || "";
        box.append(h("div", { class: "part" }, h("label", { class: "pl" }, "修訂理由（依哪項觀察或提示修改？）"), reasonTa));
      }
      const stateEl = h("span", { class: "state" }, locked ? "預測已送出（" + new Date(it.submitted_at).toLocaleString("zh-TW") + "），保留初稿，觀察後再比較。" : it.draft ? "初稿已保存；可以直接修改成修訂稿。" : "");
      const btn = q.lock
        ? confirmBtn("送出預測", "送出後不能再修改，確定送出（再按一次）", () => { const cur = item(); cur.submitted_at = now(); cur.draft = { parts: JSON.parse(JSON.stringify(cur.parts)), at: now() }; setItem(cur); logOp(u, lesson, "送出預測", q.id); route(); }, "primary")
        : h("button", { class: "primary", onclick: () => { const cur = item(); cur.draft = { parts: JSON.parse(JSON.stringify(cur.parts)), at: now() }; setItem(cur); logOp(u, lesson, "儲存初稿", q.id); draw(); } }, "儲存初稿");
      function updButtons() { btn.disabled = !anyFilled(item().parts); }
      updButtons();
      if (!locked && !(it.draft && !q.lock)) box.append(h("div", { class: "actions" }, btn, stateEl)); else box.append(h("div", { class: "actions" }, stateEl));
    }
    draw();
    return box;
  }

  // ---------- 分層提示（10）＋ AI 追問接口（08） ----------
  function hintBlock(u, lesson, mid, qids, withAI) {
    const m = u.misconceptions.items.find(x => x.id === mid);
    if (!m) return null;
    const wrap = h("div", { class: "hint" });
    const tq = T && m.teacher ? teacherBox("學習困難速查（" + m.quick_name + "）",
      table(["學生表現", "引導方式", "改善判準"], [[m.teacher.quick.performance, m.teacher.quick.guidance, m.teacher.quick.criterion]]),
      m.teacher.performance ? kvTable([{ label: "學生表現", value: m.teacher.performance }, { label: "學習重點", value: m.teacher.focus }]) : null,
      m.teacher.materials ? table(["提示層次", "對照材料"], Object.entries(m.teacher.materials).map(([k, v]) => [u.misconceptions.levels[k], v])) : null) : null;
    if (m.hints_pending || !m.hints) {
      return h("div", null, h("div", { class: "pending-box" }, h("b", null, "分層提示 L1–L3 " + PENDING), "　", m.name), tq);
    }
    const levels = ["L1", "L2", "L3"];
    function used() { if (T) return 3; return getRec(u, lesson).hints.filter(x => x.misconception === mid && x.source === "fixed").map(x => x.level); }
    function ready() { if (T) return true; const r = getRec(u, lesson); return qids.some(id => r.items[id] && anyFilled(r.items[id].parts)); }
    function draw() {
      wrap.innerHTML = "";
      const u_ = T ? levels : levels.filter(l => used().includes(l));
      wrap.append(h("div", null, h("b", null, "提示"), h("span", { class: "small muted" }, "　一次給一層提示，先想想再看下一層。")));
      u_.forEach(l => wrap.append(h("div", { class: "row" }, h("span", { class: "lv" }, u.misconceptions.levels[l]), pre(m.hints[l]))));
      if (!T) {
        const next = levels.find(l => !u_.includes(l));
        const r = getRec(u, lesson);
        const flagged = r.handoff.some(x => x.misconception === mid);
        const tb = h("div", { class: "toolbar" });
        if (next) tb.append(h("button", { disabled: !ready(), onclick: () => {
          const rr = getRec(u, lesson); rr.hints.push({ at: now(), source: "fixed", misconception: mid, level: next, questions: qids, text: m.hints[next] }); saveRec(u, lesson, rr); draw();
        } }, u_.length ? "下一層提示" : "給我提示"));
        if (u_.length >= 2) tb.append(h("button", { disabled: flagged, onclick: () => {
          const rr = getRec(u, lesson); rr.handoff.push({ at: now(), misconception: mid, questions: qids, after_level: u_[u_.length - 1] }); saveRec(u, lesson, rr); draw();
        } }, flagged ? "已請老師協助" : "還是卡住，請老師協助"));
        if (!ready()) tb.append(h("span", { class: "small muted" }, "請先作答，再使用提示。"));
        wrap.append(tb);
      }
      if (withAI) wrap.append(aiBlock(u, lesson, qids));
    }
    draw();
    // 作答後重新評估按鈕狀態
    if (!T) document.addEventListener("input", () => { if (wrap.isConnected) { const b = wrap.querySelector("button"); if (b && b.textContent === "給我提示") b.disabled = !ready(); } });
    return h("div", null, wrap, tq);
  }
  function aiBlock(u, lesson, qids) {
    const ai = window.TextbookAI; // 預留：日後接上 AI 服務時，提供 { ask(context) => Promise<string> }
    const box = h("div", { class: "ai" });
    const out = h("div");
    const r = T ? null : getRec(u, lesson);
    const ok = !T && qids.every(id => { const q = u.worksheets[lesson].questions.find(x => x.id === id); return r.items[id] && partsFilled(q, r.items[id].parts); });
    const btn = h("button", { disabled: !ai || !ok, onclick: async () => {
      const q = u.worksheets[lesson].questions.find(x => x.id === qids[0]);
      const ctx = { unit: u.meta.id, lesson, question: q, answer: getRec(u, lesson).items[q.id], ops: getRec(u, lesson).ops };
      btn.disabled = true; out.textContent = "…";
      try { const reply = await ai.ask(ctx); out.textContent = reply; const rr = getRec(u, lesson); rr.hints.push({ at: now(), source: "ai", questions: qids, text: reply }); saveRec(u, lesson, rr); }
      catch (e) { out.append(h("div", null, "AI 沒有回應。", h("button", { onclick: () => btn.click() }, "重試"), " 或略過，繼續完成活動。")); }
      btn.disabled = false;
    } }, "請AI追問");
    box.append(h("div", { class: "toolbar" }, btn, h("span", { class: "small" }, !ai ? "AI未啟用時由教師追問" : !ok ? "請先完成選項與解釋" : "可略過")), out);
    return box;
  }

  // ---------- 核心題（05） ----------
  function coreBlock(u, lesson, no) {
    const c = u.core.items.find(x => x.no === no);
    const q = { id: "C" + no, label: "核心題 " + no, prompt: c.question, parts: [{ id: "x", type: "text", lines: 4 }] };
    const card = h("div", { class: "core" },
      h("div", { class: "ct" }, "核心教學題目 ", no, "　", c.stage.replace("\n", "／")),
      h("div", { class: "small" }, h("b", null, "學習目標："), c.goal));
    const qc = questionCard(u, lesson, q);
    card.append(qc);
    if (T) {
      const t = c.teacher;
      card.append(teacherBox("答案要素、常見迷思、成功規準",
        kvTable([{ label: "主要功能", value: t.function }, { label: "知識節點與核心概念", value: t.concepts }, { label: "預期證據", value: t.evidence.join("\n") }, { label: "答案要素", value: t.answer.join("\n") }, { label: "常見迷思與錯誤", value: t.misconceptions }]),
        rubricView(t.rubric), t.check ? h("div", { class: "small" }, t.check) : null));
    }
    return card;
  }
  function rubricView(r) { return h("div", { class: "rub" }, Object.entries(r).map(([k, v]) => [h("b", null, k), h("span", null, v)])); }

  // ---------- 節次頁 ----------
  function pageLesson(u, n) {
    const L = u.plan.lessons.find(x => x.n === n);
    const ws = u.worksheets[n];
    const qById = id => ws.questions.find(q => q.id === id);
    const stepsEl = [];
    let blocked = false;
    L.steps.forEach((s, si) => {
      const body = h("div", { class: "body" });
      const blocks = [];
      for (const b of s.blocks) {
        if (blocked) break;
        let el = null;
        if (b.type === "text") el = textBlock(u, b.node, b.paras);
        else if (b.type === "conditions") el = condBlock(u, b.node);
        else if (b.type === "assets") el = h("div", null, b.note ? h("div", { class: "small muted" }, b.note) : null,
          h("div", { class: "assets" }, b.ids.map(id => assetCard(u, u.assets.byId[id], { lesson: n }))));
        else if (b.type === "q") el = h("div", null, b.ids.map(id => questionCard(u, n, qById(id))));
        else if (b.type === "hint") el = h("div", null, b.ids.map(id => hintBlock(u, n, id, s.blocks.filter(x => x.type === "q").flatMap(x => x.ids), b.ai)));
        else if (b.type === "core") el = h("div", null, b.ids.map(no => coreBlock(u, n, no)));
        else if (b.type === "pending") el = pendingBox(b.what);
        else if (b.type === "activity") { const a = ws.activities[b.id]; el = h("div", { class: "card", style: "box-shadow:none" }, h("b", null, a.title), h("p", null, a.context), h("div", { class: "small" }, h("b", null, "使用材料與操作："), a.materials)); }
        else if (b.type === "teacher_note") el = teacherBox("教師投影", b.text, h("div", { class: "small" }, "可在「匯入作答與批改」開啟學生作答，隱去代碼後投影。"));
        else if (b.type === "teacher_hint") { const q = qById(b.q); el = T && q.teacher ? teacherBox("追問（" + q.label + "）", q.teacher.errors.map(x => h("p", null, x))) : null; }
        else if (b.type === "review") {
          const prev = u.worksheets[b.lesson]; const r = T ? null : getRec(u, b.lesson);
          el = h("details", { class: "card" }, h("summary", null, `第${b.lesson}節紀錄回看`),
            prev.questions.filter(q => !q.revise_of).map(q => h("div", { class: "draft" }, h("b", null, q.label, "　"), pre(T ? "（學生作答）" : partsSummary(q, r.items[q.id] && r.items[q.id].parts)))));
        }
        else if (b.type === "download") el = T ? null : h("div", { class: "toolbar" }, h("button", { class: "primary", onclick: () => { const r = getRec(u, n); r.completed_at = r.completed_at || now(); saveRec(u, n, r); download(recFileName(u, n), JSON.stringify(getRec(u, n), null, 2)); } }, "下載本節紀錄"), h("span", { class: "small muted" }, "檔名：", recFileName(u, n)));
        if (el) blocks.push(el);
        if (!T && b.type === "q" && b.ids.some(id => { const q = qById(id); return q.lock && !(getRec(u, n).items[id] || {}).submitted_at; })) blocked = true;
      }
      if (!blocks.length && blocked) return;
      const rows = [].concat(s.plan_row).map(i => L.teacher && L.teacher.rows[i]).filter(Boolean);
      body.append(...blocks);
      if (T && rows.length) body.prepend(teacherBox("教案流程（02）", table(["時間", "教師活動與提問", "學生活動與預期表現", "評量／證據", "教材／備註"], rows.map(r => [r.time, r.teacher, r.student, r.evidence, r.note]))));
      stepsEl.push(h("section", { class: "step", "data-step": si }, h("header", null, h("span", { class: "n" }, s.name), h("span", { class: "tm" }, s.time)), body));
    });
    if (blocked) stepsEl.push(h("div", { class: "lock-notice" }, "完成預測並按「送出預測」後，才會顯示後續的觀察素材與題目。"));
    const quiz = u.assessments["quiz-" + n];
    const ov = u.plan.overview_rows[n - 1];
    shell(u, "L" + n, [
      h("div", { class: "crumb" }, u.meta.title, " › ", L.title),
      h("h1", null, L.title),
      h("div", { class: "toolbar" },
        h("span", { class: "badge" }, L.minutes), h("span", null, h("b", null, "核心問題／重點："), ov.question),
        T ? h("button", { class: "primary", onclick: () => projection(u, n) }, "投影模式") : null,
        h("a", { href: `#/u/${u.meta.id}/print/${n}/student` }, "列印學習單"), T ? h("a", { href: `#/u/${u.meta.id}/print/${n}/teacher` }, "列印教師版") : null),
      ws.pending ? pendingBox(`第${n}節學習單完整題目` + PENDING, "03 只示範第2節；本節題號與任務取自 02 教案。") : h("div", { class: "small muted" }, ws.source),
      T && L.teacher ? teacherBox("銜接與目標／產出與教材", kvTable([{ label: "銜接與目標", value: L.teacher.bridge }, { label: "產出與教材", value: L.teacher.outputs }, { label: "專業說明", value: L.teacher.expert }, { label: "條件與誤解", value: L.teacher.caveats }])) : null,
      T && ws.teacher ? teacherBox("學習單活動總覽（03）", ws.teacher.overview.map(o => kvTable([{ label: o.label, value: o.lines.join("\n") }])), table(["順序", "活動名稱", "主要任務與題號", "預計時間"], ws.teacher.sequence.map(s => [s.no, s.name, s.task, s.time]))) : null,
      stepsEl,
      blocked ? null : h("section", { class: "step" }, h("header", null, h("span", { class: "n" }, "隨堂測驗")), h("div", { class: "body" }, assessmentBody(u, quiz))),
    ]);
  }

  // ---------- 投影模式（教師版） ----------
  function projection(u, n) {
    const L = u.plan.lessons.find(x => x.n === n);
    const steps = [...document.querySelectorAll("section.step[data-step]")];
    let si = 0, bi = 0;
    const view = h("div", { class: "proj" });
    function blocksOf(i) { return [...steps[i].querySelector(".body").children].filter(c => !c.classList.contains("teacher")); }
    function draw() {
      view.innerHTML = "";
      const s = L.steps[si];
      view.append(h("div", { class: "muted" }, L.title), h("h1", null, s.name, "　", h("span", { class: "muted", style: "font-size:1.2rem" }, s.time)));
      blocksOf(si).forEach((b, i) => { const c = b.cloneNode(true); c.querySelectorAll(".teacher").forEach(x => x.remove()); if (i > bi) c.classList.add("hidden-block"); view.append(c); });
      view.append(h("div", { class: "projbar" },
        h("button", { onclick: back }, "上一項"), h("button", { class: "primary", onclick: next }, "揭示下一項"),
        h("span", { class: "muted", style: "align-self:center" }, `${si + 1}/${steps.length}`), h("button", { onclick: close }, "離開投影")));
    }
    function next() { if (bi < blocksOf(si).length - 1) bi++; else if (si < steps.length - 1) { si++; bi = 0; } draw(); }
    function back() { if (bi > 0) bi--; else if (si > 0) { si--; bi = blocksOf(si).length - 1; } draw(); }
    function key(e) { if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); } else if (e.key === "ArrowLeft") back(); else if (e.key === "Escape") close(); }
    function close() { view.remove(); document.removeEventListener("keydown", key); }
    document.addEventListener("keydown", key);
    document.body.append(view); draw();
  }

  // ---------- 評量（前測、隨堂、後測） ----------
  function assessmentItems(a) {
    const items = [];
    (a.rows || []).forEach(r => Object.entries(r.levels).forEach(([lv, nos]) => nos.forEach(no => items.push({ no, objective: r.objective, level: lv, row_points: r.points }))));
    return items.sort((x, y) => x.no - y.no);
  }
  function assessmentBody(u, a) {
    const items = assessmentItems(a);
    return [
      a.info ? kvTable(a.info) : null,
      pendingBox("題目" + PENDING, a.rows && a.rows.length ? "06 只提供雙向細目表藍圖，實際題目尚未提供。" : "06 未提供本份評量的雙向細目表與題目。"),
      items.length ? h("ol", { class: "small" }, items.map(it => h("li", { value: it.no }, "第", it.no, "題　", h("span", { class: "badge pending" }, "題目" + PENDING),
        T ? [h("span", { class: "badge t" }, it.level), it.objective] : null))) : null,
      T && a.notes ? teacherBox("06 備註", a.notes.map(x => h("div", { class: "small" }, x))) : null,
    ];
  }
  function pageTest(u, id) {
    const a = u.assessments[id];
    shell(u, id, [h("div", { class: "crumb" }, u.meta.title, " › ", a.title), h("h1", null, a.title), assessmentBody(u, a),
      T ? h("p", null, h("a", { href: `#/u/${u.meta.id}/blueprint` }, "看自動產生的雙向細目表")) : null]);
  }

  // ---------- 雙向細目表（教師版，由題目標籤自動產生） ----------
  function blueprintTable(u, a) {
    const LV = u.blueprint_notes.levels;
    const items = assessmentItems(a);
    if (!items.length) return pendingBox("本份評量的題目與標籤" + PENDING);
    const total = a.rows.reduce((s, r) => s + r.points, 0);
    const rows = a.rows.map(r => {
      const its = items.filter(i => i.objective === r.objective);
      return [r.objective, ...LV.map(l => (r.levels[l] || []).join("、") || "—"), String(its.length), String(r.points), (r.points / total * 100).toFixed(1) + "%"];
    });
    const sumRow = ["合計", ...LV.map(l => items.filter(i => i.level === l).length + "題"), String(items.length), String(total), "100%"];
    const nos = items.map(i => i.no).sort((x, y) => x - y);
    const dup = nos.filter((x, i) => nos.indexOf(x) !== i);
    const missing = []; for (let i = 1; i <= a.declared.items; i++) if (!nos.includes(i)) missing.push(i);
    const okItems = items.length === a.declared.items, okPts = total === a.declared.points;
    return [table(["學習目標與知識節點", ...LV, "題數", "配分", "占分比"], [...rows, sumRow]),
      h("div", { class: "small" },
        h("span", { class: okItems ? "ok" : "bad" }, `題數：${items.length}／06 宣告 ${a.declared.items} ${okItems ? "✓" : "✗"}`), "　",
        h("span", { class: okPts ? "ok" : "bad" }, `配分：${total}／06 宣告 ${a.declared.points} ${okPts ? "✓" : "✗"}`), "　",
        h("span", { class: dup.length || missing.length ? "bad" : "ok" }, dup.length ? `重複題號：${dup.join("、")}` : missing.length ? `遺漏題號：${missing.join("、")}` : "題號無重複遺漏 ✓")),
      h("div", { class: "small muted" }, "各層次配分需每題配分，06 只提供各列合計，待補。")];
  }
  function pageBlueprint(u) {
    const ids = ["pretest", "quiz-1", "quiz-2", "quiz-3", "posttest"];
    shell(u, "blueprint", [h("h1", null, "雙向細目表"),
      h("p", { class: "small muted" }, "由每題的學習目標與認知層次標籤自動產生；題數、配分與題號另做核對。"),
      h("p", { class: "small" }, u.blueprint_notes.intro),
      ids.map(id => { const a = u.assessments[id]; return [h("h2", null, a.lesson ? `第${a.lesson}節` : "", a.title), a.info ? kvTable(a.info) : null, blueprintTable(u, a), a.notes ? a.notes.map(x => h("div", { class: "small muted" }, x)) : null]; }),
      h("h2", null, "說明"), u.blueprint_notes.notes.map(x => h("p", { class: "small" }, x)), h("p", { class: "small muted" }, u.blueprint_notes.signature)]);
  }

  // ---------- 延伸學習（04） ----------
  function pageExtension(u) {
    const e = u.extension;
    shell(u, "ext", [h("div", { class: "crumb" }, u.meta.title, " › 延伸學習"), h("h1", null, "延伸學習"),
      h("p", null, e.heading), kvTable(e.basic),
      h("h2", null, "三階段學習進程"), table(e.stages_header, e.stages),
      h("h2", null, "延伸資源"), h("p", { class: "small muted" }, e.resources_intro),
      e.groups.map(g => [h("h3", null, g.title), table(e.resource_header, g.items.map(it => [it.no, it.name, it.summary, h("div", null, pre(it.source), (it.links || []).map((l, i) => [i ? "／" : "", h("a", { href: l.url, target: "_blank", rel: "noopener" }, l.text)])), it.use]))]),
      h("p", { class: "small muted" }, e.footer)]);
  }

  // ---------- 素材庫（07A） ----------
  function pageAssets(u) {
    let lf = 0, kf = "";
    const kinds = ["實拍", "模型", "示意"];
    const list = h("div");
    function draw() {
      list.innerHTML = "";
      u.assets.groups.forEach(g => {
        const as = u.assets.assets.filter(a => a.group === g.id && (!lf || a.lessons.includes(lf)) && (!kf || a.kind.includes(kf)));
        if (!as.length) return;
        list.append(h("h2", null, g.title || g.struct_title), h("p", { class: "small muted" }, g.note), h("div", { class: "assets" }, as.map(a => assetCard(u, a))));
      });
      if (T) list.append(scriptsView(u));
    }
    const fbtn = (label, on, set) => h("button", { class: on ? "on" : "", onclick: () => { set(); draw(); bar(); } }, label);
    const fb = h("div");
    function bar() {
      fb.innerHTML = "";
      fb.append(h("div", { class: "filters" }, "節次：", fbtn("全部", !lf, () => lf = 0), u.meta.lessons.map(l => fbtn(`第${l.n}節`, lf === l.n, () => lf = l.n))),
        h("div", { class: "filters" }, "類型：", fbtn("全部", !kf, () => kf = ""), kinds.map(k => fbtn(k, kf === k, () => kf = k))));
    }
    bar();
    shell(u, "assets", [h("div", { class: "crumb" }, u.meta.title, " › 素材庫"), h("h1", null, "素材庫"),
      h("p", { class: "small" }, u.assets.basic), h("p", { class: "small muted" }, u.assets.intro),
      h("p", { class: "small muted" }, "開放授權照片直接連到 Wikimedia Commons 原圖並標示作者與授權；本教材自製的圖片與模擬檔尚未提供，先以清單佔位。"),
      fb, list]);
    draw();
  }
  function scriptsView(u) {
    const s = u.scripts && u.scripts.teacher;
    if (!s) return null;
    const img = name => TB.images && TB.images[name] ? h("img", { src: TB.images[name], style: "max-width:100%;border:1px solid var(--line);background:#fff" }) : null;
    return teacherBox("多模態輔助教材需求腳本（07B，製作用）", s.scripts.map(sc => h("div", { class: "card" },
      h("h3", null, sc.title), h("p", { class: "small muted" }, sc.intro),
      sc.fields.map(f => kvTable([{ label: f.label, value: f.lines.join("\n") }])),
      sc.shots ? [h("p", { class: "small" }, sc.shots_note), table(sc.shots_header, sc.shots.map(x => [x.no, h("div", null, x.scene, img(x.img)), x.narration, x.action, x.note]))] : null,
      sc.params ? [table(sc.params_header, sc.params), h("p", { class: "small muted" }, sc.params_note)] : null,
      sc.ops ? table(sc.ops_header, sc.ops) : null,
      sc.misread ? kvTable([{ label: "多模態呈現容易誤解處", value: sc.misread.join("\n") }]) : null,
      sc.output ? h("p", { class: "small" }, sc.output) : null,
      sc.reminder ? h("p", { class: "small" }, sc.reminder) : null,
      sc.image ? [h("p", { class: "small" }, sc.image.caption), img(sc.image.src), h("p", { class: "small muted" }, sc.image.note)] : null)));
  }

  // ---------- 單元教學設計（教師版，02） ----------
  function pageDesign(u) {
    const p = u.plan;
    const ck = store("tb:t:delivery") || {};
    shell(u, "design", [h("h1", null, "單元教學設計"), h("div", { class: "small muted" }, "來源：", p.source_file),
      h("h2", null, "一　基本資料"), kvTable(p.basic.teacher),
      h("h2", null, "二　教學設計依據"), kvTable(p.design),
      h("h3", null, "學習目標與評量對應"), table(["序", "學習目標", "可觀察證據", "達成規準"], p.objectives.map(o => [o.no, o.goal, o.teacher.evidence, o.teacher.criteria])),
      h("h2", null, "三　單元進程與教學準備"), kvTable([{ label: "學習路徑", value: p.path }]),
      table(["節次", "本節功能", "核心問題／重點", "教材／活動", "學生主要產出", "時間"], p.overview_rows.map(r => [String(r.n), r.function, r.question, r.material, r.output, r.time])),
      kvTable(p.teacher.prep),
      h("h2", null, "四　分節教學設計"),
      p.lessons.map(L => [h("h3", null, L.title, "（", L.minutes, "）"),
        kvTable([{ label: "銜接與目標", value: L.teacher.bridge }, { label: "產出與教材", value: L.teacher.outputs }]),
        table(["時間", "教師活動與提問", "學生活動與預期表現", "評量／證據", "教材／備註"], L.teacher.rows.map(r => [r.time, r.teacher, r.student, r.evidence, r.note])),
        kvTable([{ label: "專業說明", value: L.teacher.expert }, { label: "條件與誤解", value: L.teacher.caveats }])]),
      h("h2", null, "五　評量與學習記錄"),
      table(["評量時機", "學生任務／題目", "判斷標準", "記錄位置"], p.teacher.assessment.map(a => [a.when, a.task, a.criteria, a.where])),
      kvTable([{ label: "數位記錄", value: p.teacher.digital_record }]),
      h("h2", null, "六　附件與交付"),
      table(["序", "附件／素材名稱", "用途／使用位置", "作者／來源授權"], p.teacher.attachments.map(a => [a.no, a.name, a.use, a.license])),
      h("h3", null, "交付檢核"), h("div", null, p.teacher.delivery_check_intro,
        p.teacher.delivery_check.map(x => h("label", { style: "display:block" }, h("input", { type: "checkbox", checked: !!ck[x], onchange: e => { ck[x] = e.target.checked; store("tb:t:delivery", ck); } }), " ", x)))]);
  }
  function pageMis(u) {
    const m = u.misconceptions;
    shell(u, "mis", [h("h1", null, "學習困難速查"), h("p", { class: "small muted" }, m.note), kvTable(m.teacher.basic),
      h("h2", null, "一　困難與引導速查"),
      table(["節次／學習困難", "學生表現", "引導方式", "改善判準"], m.items.map(i => [`第${i.lesson}節\n${i.quick_name}`, i.teacher.quick.performance, i.teacher.quick.guidance, i.teacher.quick.criterion])),
      h("h2", null, "二　單項引導表"), h("p", { class: "small muted" }, m.teacher.guide_note),
      m.items.map(i => h("div", { class: "card" }, h("h3", null, i.name, i.questions ? "　" + i.questions : ""),
        i.hints ? [kvTable([{ label: "學生表現", value: i.teacher.performance }, { label: "學習重點", value: i.teacher.focus }]),
          table(["提示層次", "提問或行動", "對照材料"], ["L1", "L2", "L3"].map(l => [m.levels[l], i.hints[l], i.teacher.materials[l]]))]
          : pendingBox("本項 L1–L3 單項引導表" + PENDING, "10 只提供速查列。"))),
      h("p", { class: "small" }, "設計參考：", m.teacher.refs.map((r, i) => [i ? "、" : "", h("a", { href: r.url, target: "_blank", rel: "noopener" }, r.text)])),
      h("p", { class: "small muted" }, m.teacher.footer)]);
  }

  // ---------- 匯入作答與批改（教師版） ----------
  function allQuestions(u, n) {
    const ws = u.worksheets[n];
    const qs = ws.questions.map(q => ({ ...q, kind: q.teacher && q.teacher.key ? "auto" : "open" }));
    u.plan.lessons.find(x => x.n === n).steps.forEach(s => s.blocks.filter(b => b.type === "core").forEach(b => b.ids.forEach(no => {
      const c = u.core.items.find(x => x.no === no);
      qs.push({ id: "C" + no, label: "核心題 " + no, prompt: c.question, parts: [{ id: "x", type: "text" }], kind: "open", core: c });
    })));
    return qs;
  }
  function autoScore(q, parts) {
    if (!q.teacher || !q.teacher.key || !parts) return null;
    const k = q.teacher.key; const keys = Object.keys(k);
    return { got: keys.filter(x => parts[x] === k[x]).length, of: keys.length };
  }
  function pageGrade(u) {
    let recs = store("tb:t:import") || [];
    const grades = store("tb:t:grades") || {};
    let lesson = 1;
    const area = h("div");
    const dz = h("div", { class: "dropzone" }, "把全班的作答紀錄檔（.json）拖到這裡，或 ", h("label", { class: "link", style: "text-decoration:underline;cursor:pointer;color:var(--accent)" }, "選擇檔案", h("input", { type: "file", multiple: true, accept: ".json,application/json", style: "display:none", onchange: e => readFiles(e.target.files) })));
    dz.addEventListener("dragover", e => { e.preventDefault(); dz.classList.add("over"); });
    dz.addEventListener("dragleave", () => dz.classList.remove("over"));
    dz.addEventListener("drop", e => { e.preventDefault(); dz.classList.remove("over"); readFiles(e.dataTransfer.files); });
    const msg = h("div", { class: "small" });
    async function readFiles(files) {
      let added = 0, bad = [];
      for (const f of files) {
        try { let d = JSON.parse(await f.text()); if (!Array.isArray(d)) d = [d];
          d.forEach(r => { if (r.schema !== "tb-record/1" || r.unit !== u.meta.id) throw 0; recs = recs.filter(x => !(x.student_code === r.student_code && x.lesson === r.lesson)); recs.push(r); added++; });
        } catch (e) { bad.push(f.name); }
      }
      store("tb:t:import", recs);
      msg.textContent = `已匯入 ${added} 份紀錄。` + (bad.length ? `無法讀取：${bad.join("、")}` : "");
      draw();
    }
    const gk = (s, n, q) => `${s}|${n}|${q}`;
    function draw() {
      area.innerHTML = "";
      const qs = allQuestions(u, lesson);
      const rs = recs.filter(r => r.lesson === lesson).sort((a, b) => String(a.student_code).localeCompare(String(b.student_code)));
      area.append(h("div", { class: "filters" }, u.meta.lessons.map(l => h("button", { class: lesson === l.n ? "on" : "", onclick: () => { lesson = l.n; draw(); } }, `第${l.n}節（${recs.filter(r => r.lesson === l.n).length}）`))));
      if (!rs.length) { area.append(h("p", { class: "muted" }, "這一節還沒有匯入紀錄。")); return; }
      area.append(table(["學生代碼", ...qs.map(q => q.label), "提示", "轉教師", "更新時間"], rs.map(r => [
        r.student_code,
        ...qs.map(q => { const it = r.items[q.id]; const sc = autoScore(q, it && it.parts); const g = grades[gk(r.student_code, lesson, q.id)];
          return h("button", { class: "link", onclick: () => detail(r, q) }, !it ? "—" : sc ? `${sc.got}/${sc.of}` : g || "待評"); }),
        String(r.hints.length), r.handoff.length ? "是" : "", new Date(r.updated_at).toLocaleString("zh-TW")])));
    }
    function detail(r, q) {
      const it = r.items[q.id] || {};
      const sc = autoScore(q, it.parts);
      const key = gk(r.student_code, lesson, q.id);
      const crit = q.core ? q.core.teacher.rubric : null;
      const bg = h("div", { class: "modal-bg", onclick: e => { if (e.target === bg) bg.remove(); } }, h("div", { class: "modal", style: "max-width:760px;max-height:90vh;overflow:auto" },
        h("h3", null, r.student_code, "　第", lesson, "節　", q.label),
        q.prompt ? h("p", { class: "small" }, q.prompt) : pendingBox("題目文字" + PENDING, q.plan_ref ? "02 教案：" + q.plan_ref : ""),
        it.draft ? [h("b", null, "初稿"), pre(partsSummary(q, it.draft.parts), "draft"), drawings(q, it.draft.parts)] : null,
        h("b", null, it.draft ? "修訂稿／目前作答" : "目前作答"), pre(partsSummary(q, it.parts), "draft"), drawings(q, it.parts),
        it.revision_reason ? [h("b", null, "修訂理由"), pre(it.revision_reason, "draft")] : null,
        sc ? h("p", null, h("b", null, "自動計分："), `${sc.got}/${sc.of}`) : null,
        q.teacher ? teacherBox("參考答案與判讀", q.teacher.answer.map(x => h("p", { class: "small" }, x))) : null,
        crit ? teacherBox("成功規準（05）", rubricView(crit)) : null,
        !sc ? h("div", null, h("b", null, "三級規準評分："), ["達成", "發展中", "待支持"].map(l => h("label", { style: "margin-right:1rem" },
          h("input", { type: "radio", name: "g", checked: grades[key] === l, onchange: () => { grades[key] = l; store("tb:t:grades", grades); draw(); } }), " ", l))) : null,
        r.hints.filter(x => (x.questions || []).includes(q.id)).length ? [h("b", null, "提示使用歷程"), h("ul", { class: "small" }, r.hints.filter(x => (x.questions || []).includes(q.id)).map(x => h("li", null, new Date(x.at).toLocaleTimeString("zh-TW"), " ", x.level || "AI", "：", x.text)))] : null,
        h("div", { class: "toolbar" }, h("button", { onclick: () => bg.remove() }, "關閉"))));
      document.body.append(bg);
    }
    function drawings(q, parts) { return (q.parts || []).filter(p => p.type === "draw" && parts && parts[p.id]).map(p => h("img", { class: "thumb", src: parts[p.id] })); }
    function csv() {
      const esc = v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
      const lines = [["學生代碼", "節次", "題號", "題型", "自動計分", "三級規準", "初稿", "修訂稿／目前作答", "修訂理由", "使用提示層次", "轉教師", "更新時間", "教材版本"].map(esc).join(",")];
      recs.forEach(r => allQuestions(u, r.lesson).forEach(q => {
        const it = r.items[q.id]; if (!it) return;
        const sc = autoScore(q, it.parts);
        lines.push([r.student_code, r.lesson, q.label, sc ? "客觀" : "開放", sc ? `${sc.got}/${sc.of}` : "", grades[gk(r.student_code, r.lesson, q.id)] || "",
          it.draft ? partsSummary(q, it.draft.parts) : "", partsSummary(q, it.parts), it.revision_reason || "",
          r.hints.filter(x => (x.questions || []).includes(q.id)).map(x => x.level || "AI").join(" "), r.handoff.some(x => (x.questions || []).includes(q.id)) ? "是" : "", r.updated_at, r.material_version].map(esc).join(","));
      }));
      download(`${u.meta.title}_成績.csv`, "﻿" + lines.join("\r\n"), "text/csv");
    }
    shell(u, "grade", [h("h1", null, "匯入作答與批改"),
      h("p", { class: "small muted" }, "紀錄只存在這台電腦的瀏覽器。客觀題自動計分；開放題依三級規準（達成／發展中／待支持）點選。"),
      dz, msg,
      h("div", { class: "toolbar" }, h("button", { class: "primary", onclick: csv }, "匯出 CSV"),
        confirmBtn("清除匯入資料", "確定清除匯入紀錄與評分（再按一次）", () => { storeDel("tb:t:import"); storeDel("tb:t:grades"); route(); })),
      area]);
    draw();
  }

  // ---------- 列印中心 ----------
  function pagePrintIndex(u) {
    shell(u, "print", [h("h1", null, "列印中心"),
      table(["節次", "學生版", T ? "教師版" : null].filter(Boolean), u.meta.lessons.map(l => [l.title,
        h("a", { href: `#/u/${u.meta.id}/print/${l.n}/student` }, "學習單（學生版）"),
        T ? h("a", { href: `#/u/${u.meta.id}/print/${l.n}/teacher` }, "學習單（教師版）") : null].filter(x => x !== null)))]);
  }
  function pagePrint(u, n, who) {
    const tv = who === "teacher" && T;
    const ws = u.worksheets[n], L = u.plan.lessons.find(x => x.n === n);
    const order = [];
    L.steps.forEach(s => s.blocks.forEach(b => {
      if (b.type === "activity") order.push({ act: ws.activities[b.id] });
      if (b.type === "q") b.ids.forEach(id => order.push({ q: ws.questions.find(q => q.id === id) }));
      if (b.type === "core") b.ids.forEach(no => order.push({ core: u.core.items.find(c => c.no === no) }));
    }));
    const lines = k => h("div", { class: "lines" }, Array.from({ length: k }, () => h("div")));
    const page = h("div", { class: "print-page" },
      h("div", { class: "toolbar noprint" }, h("button", { class: "primary", onclick: () => window.print() }, "列印"), h("a", { href: `#/u/${u.meta.id}/lesson/${n}` }, "回到節次頁")),
      h("h2", { style: "margin-top:0" }, u.meta.title, "　", L.title, "　學習單", tv ? "（教師版）" : ""),
      h("p", null, "學生代碼：＿＿＿＿＿＿　日期：＿＿＿＿＿＿"),
      ws.pending ? pendingBox(`第${n}節學習單完整題目` + PENDING, "03 只示範第2節；本節題號與任務取自 02 教案。") : null,
      order.map(o => {
        if (o.act) return h("div", { class: "pq" }, h("b", null, o.act.title), h("p", null, o.act.context));
        if (o.core) return h("div", { class: "pq" }, h("b", null, "核心題 ", o.core.no), h("p", null, o.core.question), lines(4),
          tv ? h("div", { class: "ans" }, h("b", null, "答案要素："), o.core.teacher.answer.join(" "), h("br"), rubricView(o.core.teacher.rubric)) : null);
        const q = o.q;
        return h("div", { class: "pq" }, h("b", null, q.label, "　"), q.prompt || h("span", null, "題目" + PENDING + (q.plan_ref ? "（02 教案：" + q.plan_ref + "）" : "")),
          (q.parts || [{ type: "text", lines: 4 }]).map(p => p.type === "choice" ? h("div", null, p.group || "", p.label ? p.label + "　" : "", p.options.map(x => "□ " + x + (x === "其他：" ? "＿＿＿＿" : "")).join("　"))
            : p.type === "draw" ? [p.label ? h("div", null, p.label) : null, h("div", { class: "drawbox" })]
            : [p.label ? h("div", null, p.label) : null, lines(p.lines || 3)]),
          tv && q.teacher ? h("div", { class: "ans" }, h("b", null, "參考答案與判讀："), q.teacher.answer.map(x => h("div", null, x)), q.teacher.errors ? [h("b", null, "常見錯誤與引導："), q.teacher.errors.map(x => h("div", null, x))] : null) : null);
      }));
    $app.innerHTML = ""; $app.append(page);
  }

  // ---------- 路由 ----------
  function route() {
    const parts = (location.hash.replace(/^#\/?/, "") || "").split("/").filter(Boolean).map(decodeURIComponent);
    if (!T && !sid()) { shell(null, null, h("p", null, "請先輸入學生代碼。")); askSid(); return; }
    if (parts[0] !== "u") return pageHome();
    const u = unitById(parts[1]); if (!u) return pageHome();
    const p = parts[2];
    if (!p) return pageUnit(u);
    if (p === "lesson") return pageLesson(u, +parts[3]);
    if (p === "test") return pageTest(u, parts[3]);
    if (p === "extension") return pageExtension(u);
    if (p === "assets") return pageAssets(u);
    if (p === "print") return parts[3] ? pagePrint(u, +parts[3], parts[4]) : pagePrintIndex(u);
    if (T && p === "design") return pageDesign(u);
    if (T && p === "blueprint") return pageBlueprint(u);
    if (T && p === "misconceptions") return pageMis(u);
    if (T && p === "grade") return pageGrade(u);
    pageUnit(u);
  }
  TB.units.forEach(u => { u.assets.byId = Object.fromEntries(u.assets.assets.map(a => [a.id, a])); });
  window.addEventListener("hashchange", route);
  route();
})();
