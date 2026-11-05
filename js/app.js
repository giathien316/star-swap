(function () {
  const CFG = window.STARSWAP_CONFIG || {};
  const $ = id => document.getElementById(id);
  const backend = window.createBackend(CFG.firebase);
  const ready = backend.init();
  const MAX_PROOF = 350000;   // chars of the screenshot data URL; database rules allow up to 400000

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
  let current = null;
  function show(view) {
    if (view === current) return;
    current = view;
    document.querySelectorAll(".view").forEach(v => (v.hidden = v.id !== "view-" + view));
    const step = { gate: 1, profile: 2 }[view] || 3;
    [1, 2, 3].forEach(n => {
      const li = $("st-" + n);
      li.classList.toggle("on", n === step);
      li.classList.toggle("done", n < step);
    });
    window.scrollTo(0, 0);
  }
  function err(id, msg) { const e = $(id); e.textContent = msg || ""; e.hidden = !msg; }
  function safeUrl(u) {
    try { const x = new URL(u); return x.protocol === "https:" || x.protocol === "http:" ? x.href : null; }
    catch (e) { return null; }
  }

  // ---------- screenshots: load a picked image and shrink it to a JPEG small enough to store
  function loadImage(file) {
    return new Promise((res, rej) => {
      if (!file || !/^image\//.test(file.type)) return rej(new Error("Pick a screenshot (an image file)."));
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); res(img); };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("Couldn't open that image. Try a PNG or JPG screenshot.")); };
      img.src = url;
    });
  }
  async function shrink(file) {
    const img = await loadImage(file);
    const w0 = img.naturalWidth, h0 = img.naturalHeight;
    if (Math.min(w0, h0) < 200) throw new Error("That image is too small to read. Use a full screenshot.");
    let long = 1280;
    for (let i = 0; i < 6; i++) {
      const k = Math.min(1, long / Math.max(w0, h0));
      const c = document.createElement("canvas");
      c.width = Math.round(w0 * k); c.height = Math.round(h0 * k);
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const out = c.toDataURL("image/jpeg", 0.72);
      if (out.length <= MAX_PROOF) return out;
      long = Math.round(long * 0.8);
    }
    throw new Error("Couldn't make that image small enough. Try another screenshot.");
  }
  // Open the file picker; resolves with the shrunk image, or null if nothing was picked.
  function pickShot(input) {
    return new Promise((res, rej) => {
      input.value = "";
      input.onchange = () => { const f = input.files && input.files[0]; f ? shrink(f).then(res, rej) : res(null); };
      input.click();
    });
  }

  // ---------- 1. Gate: join with the host's invite, then upload a screenshot as proof
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

    let shot = null;
    const btn = $("gate-go"), pick = $("gate-pick"), prev = $("gate-preview");
    pick.onclick = async () => {
      err("gate-error");
      try {
        const img = await pickShot($("gate-file"));
        if (!img) return;
        shot = img; prev.src = img; prev.hidden = false;
        pick.textContent = "Choose a different screenshot";
        btn.disabled = false;
      } catch (e) { err("gate-error", e.message); }
    };
    btn.onclick = async () => {
      if (!shot) return;
      btn.disabled = true; err("gate-error");
      const label = btn.textContent; btn.textContent = "Sending…";
      try {
        await ready;
        await backend.sendGateProof(shot, me && me.name);
        unlocked = true; store.set("unlocked", true);
        me ? toLobby() : toProfile();
      } catch (e) {
        err("gate-error", /permission/i.test(e.message || "")
          ? "The host already rejected a screenshot from this device, so it can't unlock."
          : "Couldn't send your proof: " + (e.message || "try again"));
        btn.disabled = false;
      }
      btn.textContent = label;
    };
  }
  function toGate(msg) {
    unlocked = false; store.set("unlocked", false);
    show("gate");
    if (msg) err("gate-error", msg);
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
    if (!/^[A-Za-z0-9._]{2,24}$/.test(name)) return err("p-error", "Usernames use letters, numbers, dots and underscores.");
    if (!link) return err("p-error", "Paste the full invite link, starting with https://");
    if (CFG.referralLink && link === safeUrl(CFG.referralLink)) return err("p-error", "That's the host's link. Paste your own invite link.");
    err("p-error");
    me = { name, link }; store.set("card", me);
    // Attach the username to the gate proof so the host can match it against their invite list.
    ready.then(() => backend.setProofName(name)).catch(() => {});
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
    err("lobby-error");
    try {
      await ready;
      const st = await backend.gateStatus();
      if (st === "none") return toGate("Send your proof screenshot first.");
      if (st === "rejected") return err("lobby-error", "The host couldn't confirm your screenshot, so swapping is blocked for this device.");
    } catch (e) { return toast(e.message || "Matching is offline"); }
    show("search");
    try { await backend.connect(me, onMatch); }
    catch (e) { toast(e.message || "Couldn't connect"); toLobby(); }
  };
  $("cancel-search").onclick = async () => { await backend.cancel(); toLobby(); };

  // ---------- 4. Match: each side uploads proof, the other side approves it
  let lastPairId = null, counted = false;
  function chip(id, who, has, verdict, waitText) {
    const c = $(id);
    c.textContent = who + " · " + (!has ? "not sent" : verdict === "ok" ? "approved" : verdict === "bad" ? "rejected" : waitText);
    c.classList.toggle("ok", has && verdict === "ok");
    c.classList.toggle("bad", has && verdict === "bad");
  }
  function onMatch(m) {
    if (m.id !== lastPairId) { lastPairId = m.id; counted = false; renderPartner(m); }
    show("match");
    const them = "@" + m.partner.name;
    chip("chip-me", "Your proof", m.myProof, m.myCheck, "waiting for " + them);
    chip("chip-them", "Their proof", !!m.theirProof, m.theirCheck, "check it below");

    const md = $("mark-done");
    md.hidden = m.myCheck === "ok";
    md.textContent = m.myProof ? "Upload a different screenshot" : "Upload proof I used their link";
    md.className = "btn " + (m.myProof ? "ghost" : "primary");
    err("me-proof-note", m.myCheck === "bad" ? them + " says your screenshot doesn't show their invite. Upload a clearer one." : "");

    $("their-proof").hidden = !m.theirProof;
    if (m.theirProof && $("their-proof-img").getAttribute("src") !== m.theirProof) $("their-proof-img").src = m.theirProof;
    $("their-proof-title").textContent = them + "'s proof";
    $("verdict-btns").hidden = !!m.theirCheck;
    const vn = $("verdict-note");
    vn.hidden = !m.theirCheck;
    vn.textContent = m.theirCheck === "ok" ? "You approved this." : "You said this doesn't show your invite. They've been asked for a new one.";

    const both = m.myCheck === "ok" && m.theirCheck === "ok";
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
    $("their-proof-img").removeAttribute("src");
  }
  $("mark-done").onclick = async () => {
    err("me-proof-note");
    try {
      const img = await pickShot($("done-file"));
      if (!img) return;
      await backend.sendSwapProof(img);
      toast("Proof sent");
    } catch (e) { err("me-proof-note", e.message || "Couldn't send that"); }
  };
  $("proof-ok").onclick = () => backend.checkPartner("ok");
  $("proof-bad").onclick = () => backend.checkPartner("bad");
  $("again").onclick = async () => { await backend.leave(); lastPairId = null; current = null; $("connect").click(); };
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
  ready.then(() => {
    backend.watchCount(n => { $("looking-count").textContent = n; $("looking-word").textContent = n === 1 ? "person" : "people"; });
    // Unlocked on this device but no proof on file (e.g. unlocked before proofs existed): back to the gate.
    if (unlocked) return backend.gateStatus().then(st => { if (st === "none") toGate(); });
  }).catch(e => toast("Matching is offline: " + e.message));

  if (!unlocked) show("gate");
  else if (!me) toProfile();
  else toLobby();
})();
