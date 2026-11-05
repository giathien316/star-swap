# Changelog

## 1.261104.04 (Nov 4, 2026)
- Phone alert for the host (ntfy app) whenever someone sends a gate screenshot; tapping it opens review.html.
- review.html shows the pending count in the browser tab title.

## 1.261104.03 (Nov 4, 2026)
- Connected Firebase project `star-swap-f8c18`: real matching and proof storage (no more demo mode).

## 1.261104.02 (Nov 4, 2026)
- Gate now needs a proof screenshot instead of a checkbox. Screenshots are shrunk on the phone and saved to Firebase.
- New host page `review.html`: approve or reject gate screenshots. Rejected devices can't connect or send a new screenshot (enforced by the database rules).
- Swaps: "Done" is replaced by uploading a proof screenshot. Your partner approves or rejects it, and you check theirs. The swap is complete only when both are approved.
- Removed the unlock timer (`unlockDelaySeconds`).

## 1.261104.01 (Nov 4, 2026)
- First version: QR gate (scan option A or redeem code 5400545675 option B), swap card, Connect with others, one-for-one matching with Done status for both sides.
- Firebase Realtime Database matching with security rules; demo mode when Firebase isn't set up.
- Quiet animated star background, phone layout.
