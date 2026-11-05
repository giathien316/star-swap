// Host review page: list gate screenshots and approve or reject them.
(function () {
  const CFG = window.STARSWAP_CONFIG || {};
  const $ = id => document.getElementById(id);
  const FB_VER = "10.12.2";
  $("ver").textContent = "v" + (window.STARSWAP_VERSION || "");

  function msg(t) { $("msg").textContent = t || ""; $("msg").hidden = !t; }
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = () => rej(new Error("Could not load " + src));
      document.head.appendChild(s);
    });
  }
  function ago(ts) {
    const m = Math.round((Date.now() - ts) / 60000);
    if (m < 1) return "just now";
    if (m < 60) return m + " min ago";
    const h = Math.round(m / 60);
    return h < 48 ? h + " h ago" : Math.round(h / 24) + " days ago";
  }

  if (!CFG.firebase || !CFG.firebase.databaseURL) {
    msg("Firebase isn't set up yet, so there's nothing to review. See README → Turn on real matching.");
    return;
  }

  let db, query = null, mode = "pending";

  function render(snap) {
    const list = $("list"); list.innerHTML = "";
    const rows = [];
    snap.forEach(c => { rows.push(Object.assign({ uid: c.key }, c.val())); });
    rows.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    $("count").textContent = rows.length + (mode === "pending" ? " waiting" : " shown");
    if (!rows.length) {
      const p = document.createElement("p"); p.className = "hint";
      p.textContent = mode === "pending" ? "Nothing waiting. New screenshots show up here live." : "No screenshots yet.";
      list.appendChild(p);
    }
    for (const r of rows) {
      const card = document.createElement("article"); card.className = "card review-item";
      const img = document.createElement("img"); img.className = "proof-img"; img.alt = "Screenshot from " + (r.name ? "@" + r.name : "a visitor");
      if (typeof r.img === "string" && r.img.indexOf("data:image/") === 0) img.src = r.img;
      img.onclick = () => img.classList.toggle("big");
      const head = document.createElement("div"); head.className = "review-head";
      const who = document.createElement("b"); who.textContent = r.name ? "@" + r.name : "(no username yet)";
      const st = document.createElement("span"); st.className = "chip" + (r.status === "approved" ? " ok" : r.status === "rejected" ? " bad" : "");
      st.textContent = r.status || "pending";
      head.append(who, st);
      const when = document.createElement("span"); when.className = "hint"; when.textContent = r.ts ? ago(r.ts) : "";
      const btns = document.createElement("div"); btns.className = "row";
      const mk = (label, cls, status) => {
        const b = document.createElement("button"); b.type = "button"; b.className = "btn sm " + cls; b.textContent = label;
        b.onclick = () => db.ref("proofs/" + r.uid + "/status").set(status).catch(e => msg("Couldn't save: " + e.message));
        return b;
      };
      if (r.status !== "approved") btns.append(mk("Approve", "primary", "approved"));
      if (r.status !== "rejected") btns.append(mk("Reject", "ghost", "rejected"));
      if (r.status !== "pending") btns.append(mk("Back to pending", "ghost", "pending"));
      card.append(img, head, when, btns);
      list.appendChild(card);
    }
  }

  function watch() {
    if (query) query.off();
    query = mode === "pending"
      ? db.ref("proofs").orderByChild("status").equalTo("pending")
      : db.ref("proofs").orderByChild("ts").limitToLast(50);
    query.on("value", s => { msg(); $("setup").hidden = true; $("filters").hidden = false; render(s); }, e => {
      $("setup").hidden = false; $("filters").hidden = true;
      msg(/permission/i.test(e.message) ? "This browser isn't the host yet. Do the one-time setup above." : e.message);
    });
    $("f-pending").className = "btn sm " + (mode === "pending" ? "primary" : "ghost");
    $("f-all").className = "btn sm " + (mode === "all" ? "primary" : "ghost");
  }
  $("f-pending").onclick = () => { mode = "pending"; watch(); };
  $("f-all").onclick = () => { mode = "all"; watch(); };

  (async () => {
    try {
      const base = "https://www.gstatic.com/firebasejs/" + FB_VER + "/";
      await loadScript(base + "firebase-app-compat.js");
      await Promise.all([loadScript(base + "firebase-auth-compat.js"), loadScript(base + "firebase-database-compat.js")]);
      firebase.initializeApp(CFG.firebase);
      const cred = await firebase.auth().signInAnonymously();
      db = firebase.database();
      $("host-id").textContent = cred.user.uid;
      $("copy-id").onclick = () => navigator.clipboard.writeText(cred.user.uid).then(() => ($("copy-id").textContent = "Copied"), () => {});
      watch();
    } catch (e) { msg("Couldn't connect: " + e.message); }
  })();
})();
