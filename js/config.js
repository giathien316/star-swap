// =====================================================================
//  Star Swap settings. This is the only file you need to edit.
// =====================================================================
window.STARSWAP_CONFIG = {
  // 1) YOUR TikTok Pro invite. Visitors must use this before they can swap.
  //    In TikTok Pro: Stars -> Invite friends -> Copy link.
  referralLink: "",          // e.g. "https://vm.tiktok.com/ZMxxxxxxx/"
  inviteCode: "5400545675",  // option B on the gate: redeem this code in TikTok Pro

  // Optional: use a screenshot of your own QR instead of the generated one.
  // Put the image in /assets and write its path here, e.g. "assets/my-qr.png".
  qrImage: "",

  // 2) Firebase (free) so real people can be matched with each other.
  //    Leave as null and the site runs in DEMO MODE with example partners.
  //    See README.md -> "Turn on real matching".
  firebase: {
    apiKey: "AIzaSyC5p3Hyfhsa1IHd9e5-gQzFZRnmGLST1v8",
    authDomain: "star-swap-f8c18.firebaseapp.com",
    databaseURL: "https://star-swap-f8c18-default-rtdb.firebaseio.com",
    projectId: "star-swap-f8c18",
    storageBucket: "star-swap-f8c18.firebasestorage.app",
    messagingSenderId: "253333433486",
    appId: "1:253333433486:web:1d3cb777b28e3df4ea6ddf"
  }
};
