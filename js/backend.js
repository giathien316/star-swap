// Matching backend. Firebase Realtime Database when configured, otherwise a demo.
//
// Firebase layout
//   /proofs/{uid}    : { img, ts, status, name }  gate screenshot. status: pending | approved | rejected (host sets)
//   /presence/{uid}  : timestamp while someone is waiting (no names, only used for the count)
//   /pairing         : { uid, name, link, ts }  the one person currently waiting
//   /inbox/{uid}     : pairId, written by whoever claims you
//   /pairs/{pairId}  : { a, aName, aLink, b, bName, bLink, ts,
//                        aProof, bProof,   screenshot each side uploads after using the other's link
//                        aCheck, bCheck,   "ok" | "bad": the OTHER side's verdict on that proof
//                        aLeft, bLeft }
(function () {
  const STALE_MS = 90 * 1000;      // a waiting slot older than this is ignored
  const HEARTBEAT_MS = 30 * 1000;
  const FB_VER = "10.12.2";

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = () => rej(new Error("Could not load " + src));
      document.head.appendChild(s);
    });
  }
  const isImg = v => typeof v === "string" && v.indexOf("data:image/") === 0;

  // ---------------------------------------------------------------- Firebase
  function FirebaseBackend(cfg) {
    let db, uid, heartbeat = null, inboxRef = null, pairRef = null;
    const api = { mode: "live" };

    api.init = async function () {
      const base = "https://www.gstatic.com/firebasejs/" + FB_VER + "/";
      await loadScript(base + "firebase-app-compat.js");
      await Promise.all([
        loadScript(base + "firebase-auth-compat.js"),
        loadScript(base + "firebase-database-compat.js")
      ]);
      firebase.initializeApp(cfg);
      const cred = await firebase.auth().signInAnonymously();
      uid = cred.user.uid;
      db = firebase.database();
      return uid;
    };

    // ----- gate proof
    api.sendGateProof = async function (img, name) {
      const rec = { img, ts: firebase.database.ServerValue.TIMESTAMP, status: "pending" };
      if (name) rec.name = name;
      await db.ref("proofs/" + uid).set(rec);
    };
    api.setProofName = async function (name) {
      await db.ref("proofs/" + uid + "/name").set(name);
    };
    // "none" | "pending" | "approved" | "rejected"
    api.gateStatus = async function () {
      const s = await db.ref("proofs/" + uid + "/status").once("value");
      return s.val() || "none";
    };

    api.watchCount = function (cb) {
      db.ref("presence").on("value", snap => {
        const now = Date.now(); let n = 0;
        snap.forEach(c => { if (now - (c.val() || 0) < STALE_MS) n++; });
        cb(n);
      });
    };

    // Look for a partner. onMatch(pair) fires once paired and on every change.
    api.connect = async function (me, onMatch) {
      const pres = db.ref("presence/" + uid);
      await pres.set(Date.now());
      pres.onDisconnect().remove();

      let claimed = null;
      const now = Date.now();
      const result = await db.ref("pairing").transaction(cur => {
        claimed = null;
        if (cur && cur.uid !== uid && now - cur.ts < STALE_MS) {
          claimed = cur;            // take the waiting person
          return null;
        }
        return { uid, name: me.name, link: me.link, ts: now };
      });
      if (!result.committed) throw new Error("Busy, try again.");

      if (claimed) {
        const ref = db.ref("pairs").push();
        await ref.set({
          a: claimed.uid, aName: claimed.name, aLink: claimed.link,
          b: uid, bName: me.name, bLink: me.link,
          ts: firebase.database.ServerValue.TIMESTAMP
        });
        await db.ref("inbox/" + claimed.uid).set(ref.key);
        await pres.remove();
        watchPair(ref.key, onMatch);
        return;
      }

      // We're the one waiting: keep the slot fresh and wait for someone to claim us.
      heartbeat = setInterval(() => {
        db.ref("pairing").transaction(cur =>
          cur && cur.uid === uid ? Object.assign({}, cur, { ts: Date.now() }) : undefined);
        pres.set(Date.now());
      }, HEARTBEAT_MS);

      inboxRef = db.ref("inbox/" + uid);
      inboxRef.on("value", snap => {
        const pid = snap.val();
        if (!pid) return;
        stopWaiting();
        inboxRef.remove();
        pres.remove();
        watchPair(pid, onMatch);
      });
    };

    function watchPair(pid, onMatch) {
      if (pairRef) pairRef.off();
      api._pair = { pid, side: null };
      pairRef = db.ref("pairs/" + pid);
      pairRef.on("value", snap => {
        const p = snap.val();
        if (!p) return;
        const me = p.a === uid ? "a" : "b", them = me === "a" ? "b" : "a";
        api._pair.side = me;
        onMatch({
          id: pid,
          partner: { name: p[them + "Name"], link: p[them + "Link"] },
          myProof: isImg(p[me + "Proof"]),
          myCheck: p[me + "Check"] || null,         // partner's verdict on my screenshot
          theirProof: isImg(p[them + "Proof"]) ? p[them + "Proof"] : null,
          theirCheck: p[them + "Check"] || null,    // my verdict on theirs
          partnerLeft: !!p[them + "Left"]
        });
      });
    }

    function stopWaiting() {
      if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
      if (inboxRef) { inboxRef.off(); inboxRef = null; }
    }

    api.cancel = async function () {
      stopWaiting();
      await db.ref("pairing").transaction(cur => (cur && cur.uid === uid ? null : undefined));
      await db.ref("presence/" + uid).remove();
    };

    // Upload my screenshot (clears any earlier verdict so the partner checks again).
    api.sendSwapProof = async function (img) {
      const p = api._pair; if (!p || !p.side) throw new Error("Not in a swap");
      const upd = {}; upd[p.side + "Proof"] = img; upd[p.side + "Check"] = null;
      await db.ref("pairs/" + p.pid).update(upd);
    };
    // My verdict on the partner's screenshot: "ok" | "bad"
    api.checkPartner = async function (verdict) {
      const p = api._pair; if (!p || !p.side) return;
      const them = p.side === "a" ? "b" : "a";
      await db.ref("pairs/" + p.pid + "/" + them + "Check").set(verdict);
    };

    api.leave = async function () {
      const p = api._pair;
      if (pairRef) { pairRef.off(); pairRef = null; }
      if (p && p.side) await db.ref("pairs/" + p.pid + "/" + p.side + "Left").set(true);
      api._pair = null;
    };

    return api;
  }

  // ---------------------------------------------------------------- Demo
  function DemoBackend() {
    const api = { mode: "demo" };
    let timers = [], state = null, onMatchCb = null;
    const clear = () => { timers.forEach(clearTimeout); timers = []; };
    const emit = () => state && onMatchCb && onMatchCb(Object.assign({}, state));
    const later = (ms, fn) => timers.push(setTimeout(fn, ms));
    let gate = "none";
    try { gate = localStorage.getItem("starswap.demoGate") || "none"; } catch (e) {}

    // A stand-in "screenshot" so the partner-proof panel has something to show.
    function fakeShot() {
      const c = document.createElement("canvas"); c.width = 360; c.height = 640;
      const x = c.getContext("2d");
      x.fillStyle = "#16161d"; x.fillRect(0, 0, 360, 640);
      x.fillStyle = "#ffc94a"; x.font = "bold 22px sans-serif"; x.textAlign = "center";
      x.fillText("Example screenshot", 180, 290);
      x.fillStyle = "#9aa3c6"; x.font = "16px sans-serif";
      x.fillText("demo mode: a real partner", 180, 324);
      x.fillText("would upload theirs here", 180, 346);
      return c.toDataURL("image/jpeg", .8);
    }

    api.init = async () => "demo-user";
    api.sendGateProof = async () => { gate = "pending"; try { localStorage.setItem("starswap.demoGate", gate); } catch (e) {} };
    api.setProofName = async () => {};
    api.gateStatus = async () => gate;
    api.watchCount = cb => {
      const tick = () => cb(3 + Math.floor(Math.random() * 6));
      tick(); setInterval(tick, 7000);
    };
    api.connect = async (me, onMatch) => {
      onMatchCb = onMatch;
      later(1800, () => {
        state = { id: "demo", partner: { name: "starchaser.example", link: "https://example.com/demo-invite" },
                  myProof: false, myCheck: null, theirProof: null, theirCheck: null, demo: true };
        emit();
        later(5000, () => { state.theirProof = fakeShot(); emit(); });
      });
    };
    api.cancel = async () => clear();
    api.sendSwapProof = async () => {
      if (!state) return;
      state.myProof = true; state.myCheck = null; emit();
      later(3000, () => { if (state) { state.myCheck = "ok"; emit(); } });
    };
    api.checkPartner = async v => { if (state) { state.theirCheck = v; emit(); } };
    api.leave = async () => { clear(); state = null; };
    return api;
  }

  window.createBackend = function (cfg) {
    return cfg && cfg.databaseURL ? FirebaseBackend(cfg) : DemoBackend();
  };
})();
