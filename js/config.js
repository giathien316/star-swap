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

  // Seconds the Unlock button waits after the page opens (gives people time to scan).
  unlockDelaySeconds: 12,

  // 2) Firebase (free) so real people can be matched with each other.
  //    Leave as null and the site runs in DEMO MODE with example partners.
  //    See README.md -> "Turn on real matching".
  firebase: null
  /* firebase: {
    apiKey: "...",
    authDomain: "your-project.firebaseapp.com",
    databaseURL: "https://your-project-default-rtdb.firebaseio.com",
    projectId: "your-project",
    appId: "..."
  } */
};
