(function () {
  const CFG = window.STARSWAP_CONFIG || {};
  const $ = id => document.getElementById(id);
  const backend = window.createBackend(CFG.firebase);

  // ---------- storage (fails quietly in private windows)
  const store = {
    get(k, d) { try { const v = localStorage.getItem("starswap." + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("starswap." + k, JSON.stringify(v)); } catch (e) {} }
  };
  let me = store.get("card", null);
  let unlocked = store.get("unlocked", false);
  let swaps = store.get("swaps", 0);

  // ---------- helpers
  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 2200);
  }
  async function copy(text, label) {
    try { await navigator.clipboard.writeText(text); toast(label + " copied"); }
    catch (e) { toast("Copy blocked here. Select it and copy by hand."); }
  }
  function drawQR(el, text) {
    el.innerHTML = "";
    if (window.QRCode) new QRCode(el, { text, width: 440, height: 440, correctLevel: QRCode.CorrectLevel.M });
    else el.textContent = "QR library didn't load";
  }
  function show(view) {
    document.querySelectorAll(".view").forEach(v => (v.hidden = v.id !== "view-" + view));
    const step = { gate: 1, profile: 2 }[view] || 3;
    [1, 2, 3].forEach(n => {
      const li = $("st-" + n);
      li.classList.toggle("on", n === step);
      li.classList.toggle("done", n < step);
    });
    window.scrollTo(0, 0);
  }
  function safeUrl(u) {
    try { const x = new URL(u); return x.protocol === "https:" || x.protocol === "http:" ? x.href : null; }
    catch (e) { return null; }
  }

  // ---------- 1. Gate
  function setupGate() {
    const link = safeUrl(CFG.referralLink || "");
    if (CFG.qrImage) {
      $("owner-qr").innerHTML = "";
      const img = new Image(); img.src = CFG.qrImage; img.alt = "Host's TikTok Pro invite QR code";
      $("owner-qr").appendChild(img);
    } else {
      drawQR($("owner-qr"), link || "https://example.com/your-tiktok-pro-invite");
      $("owner-qr-note").hidden = !!link;
    }
    $("open-owner").href = link || "#";
    $("open-owner").hidden = !link;
    $("owner-code").textContent = CFG.inviteCode || "—";
    $("copy-code").onclick = () => CFG.inviteCode && copy(CFG.inviteCode, "Code");

    let left = Math.max(0, CFG.unlockDelaySeconds | 0);
    const btn = $("gate-go"), timer = $("gate-timer"), check = $("gate-check");
    const sync = () => {
      btn.disabled = !(check.checked && left === 0);
      timer.textContent = left > 0 ? "(" + left + "s)" : "";
    };
    check.onchange = sync;
    const iv = setInterval(() => { left = Math.max(0, left - 1); sync(); if (!left) clearInterval(iv); }, 1000);
    sync();
    btn.onclick = () => {
      unlocked = true; store.set("unlocked", true);
      me ? toLobby() : toProfile();
    };
  }

  // ---------- 2. Profile
  function toProfile() {
    show("profile");
    if (me) { $("p-name").value = me.name; $("p-link").value = me.link; }
  }
  $("profile-form").addEventListener("submit", e => {
    e.preventDefault();
    const name = $("p-name").value.trim().replace(/^@/, "");
    const link = safeUrl($("p-link").value.trim());
    const err = $("p-error");
    if (!/^[A-Za-z0-9._]{2,24}$/.test(name)) { err.textContent = "Usernames use letters, numbers, dots and underscores."; err.hidden = false; return; }
    if (!link) { err.textContent = "Paste the full invite link, starting with https://"; err.hidden = false; return; }
    if (CFG.referralLink && link === safeUrl(CFG.referralLink)) { err.textContent = "That's the host's link. Paste your own invite link."; err.hidden = false; return; }
    err.hidden = true;
    me = { name, link }; store.set("card", me);
    toast("Card saved");
    toLobby();
  });

  // ---------- 3. Lobby
  function toLobby() {
    show("lobby");
    $("me-name").textContent = "@" + me.name;
    $("swap-tally").textContent = swaps ? "You've finished " + swaps + " swap" + (swaps === 1 ? "" : "s") + "." : "";
  }
  $("edit-card").onclick = toProfile;

  $("connect").onclick = async () => {
    show("search");
    try { await backend.connect(me, onMatch); }
    catch (e) { toast(e.message || "Couldn't connect"); toLobby(); }
  };
  $("cancel-search").onclick = async () => { await backend.cancel(); toLobby(); };

  // ---------- 4. Match
  let lastPairId = null, counted = false;
  function onMatch(m) {
    if (m.id !== lastPairId) { lastPairId = m.id; counted = false; renderPartner(m); }
    show("match");
    $("chip-me").textContent = "You · " + (m.meDone ? "done" : "pending");
    $("chip-me").classList.toggle("ok", m.meDone);
    $("chip-them").textContent = "Them · " + (m.themDone ? "done" : "pending");
    $("chip-them").classList.toggle("ok", m.themDone);
    $("mark-done").hidden = m.meDone;
    const both = m.meDone && m.themDone;
    $("complete").hidden = !both;
    if (both && !counted) { counted = true; swaps++; store.set("swaps", swaps); }
    if (m.partnerLeft && !both) toast("Your partner left this swap");
  }
  function renderPartner(m) {
    const link = safeUrl(m.partner.link) || "#";
    $("partner-name").textContent = "@" + m.partner.name;
    $("partner-demo").hidden = !m.demo;
    drawQR($("partner-qr"), link);
    $("open-partner").href = link;
    $("copy-partner").onclick = () => copy(link, "Link");
  }
  $("mark-done").onclick = () => backend.markDone();
  $("again").onclick = async () => { await backend.leave(); lastPairId = null; $("connect").click(); };
  $("leave-match").onclick = async () => { await backend.leave(); lastPairId = null; toLobby(); };

  // ---------- starfield (quiet: a few hundred dim stars, slow twinkle)
  function sky() {
    const c = $("sky"), ctx = c.getContext("2d");
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let stars = [], w, h, dpr;
    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = c.width = innerWidth * dpr; h = c.height = innerHeight * dpr;
      const n = Math.round((innerWidth * innerHeight) / 5000);
      stars = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, r: (Math.random() * 1.2 + .3) * dpr, p: Math.random() * 6.28, s: .4 + Math.random() }));
    }
    function frame(t) {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        const a = still ? .6 : .35 + .45 * Math.sin(t / 1400 * s.s + s.p);
        ctx.fillStyle = "rgba(233,236,247," + a.toFixed(2) + ")";
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.29); ctx.fill();
      }
      if (!still) requestAnimationFrame(frame);
    }
    addEventListener("resize", resize); resize(); requestAnimationFrame(frame);
  }

  // ---------- boot
  $("ver").textContent = "v" + (window.STARSWAP_VERSION || "") + (backend.mode === "demo" ? " · demo mode" : "");
  sky();
  setupGate();
  backend.init().then(() => {
    backend.watchCount(n => { $("looking-count").textContent = n; $("looking-word").textContent = n === 1 ? "person" : "people"; });
  }).catch(e => toast("Matching is offline: " + e.message));

  if (!unlocked) show("gate");
  else if (!me) toProfile();
  else toLobby();
})();
