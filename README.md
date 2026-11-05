# Star Swap

A small website where people swap TikTok Pro invite links one for one.

1. **Get in.** Visitors scan your QR (option A) or redeem your code `5400545675` in TikTok Pro (option B), tick the box and press Unlock.
2. **Swap card.** They enter their TikTok username and their own invite link.
3. **Connect.** They press **Connect with others**. Only then are they paired with one other person, and they see that person's link and QR. Both press **Done** after using each other's link.

Version scheme: `MAJOR.YYMMDD.NN` (date of the update + counter that day). Current: see `js/version.js` and `CHANGELOG.md`.

## Files

| File | What it is |
|---|---|
| `index.html` | The page |
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

- The site can't check that someone really used your invite. The Unlock step is an honor system with a short timer.
- TikTok's reward rules can change, and referral programs often don't allow trading invites with strangers. Rewards from swaps might not count.
- Partners only see each other's username and invite link. No chat, no other personal info.
