# Star Swap

A small website where people swap TikTok Pro invite links one for one.

1. **Get in.** Visitors scan your QR (option A) or redeem your code `5400545675` in TikTok Pro (option B), then upload a **screenshot as proof**. You check these on `review.html`.
2. **Swap card.** They enter their TikTok username and their own invite link.
3. **Connect.** They press **Connect with others**. Only then are they paired with one other person, and they see that person's link and QR. Each uploads a screenshot showing they used the other's link, and each approves the other's screenshot. The swap is done when both are approved.

Version scheme: `MAJOR.YYMMDD.NN` (date of the update + counter that day). Current: see `js/version.js` and `CHANGELOG.md`.

## Files

| File | What it is |
|---|---|
| `index.html` | The page |
| `review.html` | Host page: approve or reject proof screenshots |
| `js/review.js` | Code for the host page |
| `css/style.css` | The look |
| `js/config.js` | **Your settings**: invite link, code, QR image, Firebase |
| `js/backend.js` | Matching (Firebase, or demo mode) |
| `js/app.js` | Screens and buttons |
| `database.rules.json` | Firebase security rules |
| `build.py` | Makes a one-file copy in `releases/` |
| `releases/` | One-file builds, named by version |

## 1. Add your invite

Open `js/config.js` and paste your TikTok Pro invite link into `referralLink`. The QR is drawn from it automatically. If you'd rather show your real QR screenshot, put it in `assets/` and set `qrImage: "assets/my-qr.png"`.

## 2. Turn on real matching (Firebase, free)

Without this, the site runs in **demo mode**: it works, but everyone gets an example partner.

1. Go to https://console.firebase.google.com → **Add project** (Analytics off is fine).
2. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable.**
3. **Build → Realtime Database → Create database** (pick a US location, start in *locked mode*).
4. In the database's **Rules** tab, paste everything from `database.rules.json` and **Publish**.
5. **Project settings (gear) → Your apps → Web (`</>`)** → register an app → copy the `firebaseConfig` object.
6. In `js/config.js`, replace `firebase: null` with that object. Make sure it includes `databaseURL`.
7. **Authentication → Settings → Authorized domains** → add `YOURNAME.github.io`.
8. **Make yourself the host.** Open `review.html` on the site (e.g. `https://YOURNAME.github.io/star-swap/review.html`). It shows your host ID. In `database.rules.json`, replace every `PASTE_YOUR_HOST_ID` with it, paste the rules into Firebase again and **Publish**. Always review from that same browser; clearing its site data gives you a new ID and you'd have to repeat this step.

### Checking proof

- **Gate screenshots:** open `review.html`. For each one, look for that username in your TikTok Pro invite list. **Approve** real ones. **Reject** fakes: that device can no longer connect or send a new screenshot.
- **Swap screenshots** go to the partner, not to you. Each partner approves or rejects the other's screenshot, and can check their own invite list too.

The Firebase web config is meant to be public; the rules file is what protects the data.

## 3. Put it on GitHub Pages

In VS Code:

1. **File → Open Folder** → this folder.
2. Source Control (Ctrl+Shift+G) → **Publish to GitHub** → choose **public** (Pages is free for public repos).
3. On github.com open the repo → **Settings → Pages** → Source: *Deploy from a branch*, Branch: `main` / `/ (root)` → Save.
4. About a minute later it's live at `https://YOURNAME.github.io/star-swap/`.

Or from a terminal:

```bash
git remote add origin https://github.com/YOURNAME/star-swap.git
git push -u origin main --tags
```

## Working on it

- Preview locally: install the **Live Server** extension (VS Code will suggest it), right-click `index.html` → *Open with Live Server*.
- After a change: bump `js/version.js` (e.g. `1.261104.02`), add a line to `CHANGELOG.md`, run `python build.py` for a one-file copy, commit, push.

## Good to know

- A website can't read TikTok's notifications or confirm a referral by itself (phones keep apps separate, and TikTok has no public API for this). That's why proof is a screenshot that a person checks. Someone determined can still fake a screenshot, which is why checking usernames against your invite list matters.
- People can't unlock by editing their browser: connecting needs a screenshot on file, and the database rules enforce that.
- Rejecting someone blocks that browser. If they clear site data or use another device, they have to send a new screenshot, which lands in your Pending list again.
- TikTok's reward rules can change, and referral programs often don't allow trading invites with strangers. Rewards from swaps might not count.
- Partners only see each other's username and invite link. No chat, no other personal info.
