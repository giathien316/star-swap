// Matching backend. Firebase Realtime Database when configured, otherwise a demo.
//
// Firebase layout
//   /presence/{uid}  : timestamp while someone is waiting (no names, only used for the count)
//   /pairing         : { uid, name, link, ts }  the one person currently waiting
//   /inbox/{uid}     : pairId, written by whoever claims you
//   /pairs/{pairId}  : { a, aName, aLink, b, bName, bLink, ts, aDone, bDone }
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

    api.watchCount = function (cb) {
      db.ref("presence").on("value", snap => {
        const now = Date.now(); let n = 0;
        snap.forEach(c => { if (now - (c.val() || 0) < STALE_MS) n++; });
        cb(n);
      });
    };

    // Look for a partner. onMatch(pair) fires once paired.
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
          ts: firebase.database.ServerValue.TIMESTAMP, aDone: false, bDone: false
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
      pairRef = db.ref("pairs/" + pid);
      pairRef.on("value", snap => {
        const p = snap.val();
        if (!p) return;
        const iAmA = p.a === uid;
        onMatch({
          id: pid,
          partner: { name: iAmA ? p.bName : p.aName, link: iAmA ? p.bLink : p.aLink },
          meDone: !!(iAmA ? p.aDone : p.bDone),
          themDone: !!(iAmA ? p.bDone : p.aDone),
          partnerLeft: !!(iAmA ? p.bLeft : p.aLeft)
        });
      });
      api._pair = { pid, side: null };
      pairRef.once("value").then(s => { const p = s.val(); if (p) api._pair.side = p.a === uid ? "a" : "b"; });
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

    api.markDone = async function () {
      const p = api._pair; if (!p || !p.side) return;
      await db.ref("pairs/" + p.pid + "/" + p.side + "Done").set(true);
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

    api.init = async () => "demo-user";
    api.watchCount = cb => {
      const tick = () => cb(3 + Math.floor(Math.random() * 6));
      tick(); setInterval(tick, 7000);
    };
    api.connect = async (me, onMatch) => {
      onMatchCb = onMatch;
      timers.push(setTimeout(() => {
        state = { id: "demo", partner: { name: "starchaser.example", link: "https://example.com/demo-invite" }, meDone: false, themDone: false, demo: true };
        onMatch(Object.assign({}, state));
        timers.push(setTimeout(() => { state.themDone = true; onMatchCb(Object.assign({}, state)); }, 6000));
      }, 1800));
    };
    api.cancel = async () => clear();
    api.markDone = async () => { if (state) { state.meDone = true; onMatchCb(Object.assign({}, state)); } };
    api.leave = async () => { clear(); state = null; };
    return api;
  }

  window.createBackend = function (cfg) {
    return cfg && cfg.databaseURL ? FirebaseBackend(cfg) : DemoBackend();
  };
})();
