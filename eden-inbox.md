# Eden's Launch Readiness Inbox

Items requiring your decision or action. Updated: 2026-05-07 (Pass 4 overnight audit).

---

## 🔴 ACTION REQUIRED

### ITEM 1 — Database backups are OFF
The Supabase project is on the **NANO (free) tier**. This means:
- **No automated daily backups**
- No point-in-time recovery (PITR)
- If the database is corrupted or accidentally wiped, data cannot be recovered

**Options:**
- Upgrade to Supabase Pro ($25/month) to get 7-day backup retention + PITR
- Or implement a manual backup script (export to S3/Vercel Blob on a schedule)

**Before you share the portal with real clients, please decide your backup strategy.**

---

### ITEM 2 — OG image needed for social sharing
The login/signup pages now have OG + Twitter meta tags, but the OG image is currently using `/SwipeUp_Email.png` (the email logo) as a placeholder.

For proper social previews (e.g. when you paste portal.swipeupco.com/signup into Slack or iMessage), you need a **1200×630 PNG** with the SwipeUp wordmark on a dark background.

**Action:** Create or provide a 1200×630 OG image, upload to `/public/og-image.png`, then update `src/app/layout.tsx` line 18 from `'/SwipeUp_Email.png'` to `'/og-image.png'`.

---

### ITEM 3 — Mobile layout: no responsive sidebar
The portal sidebar is fixed-width (`w-64 = 256px`) with no mobile hamburger/collapse. On phones (375px viewport):
- The sidebar takes the full left 210px
- The content area has ~0px visible width
- The app is essentially unusable on mobile

**This is expected for a B2B client portal** (clients will primarily use desktop). However if any of your clients are likely to access on mobile, this needs a collapse/drawer implementation.

**Action:** Decide if mobile support is needed for launch. If yes, queue: "Add mobile sidebar hamburger menu." If no, document this as a known limitation.

---

## ✅ RESOLVED THIS PASS (Pass 4, 7 May 2026)

- ITEM 1 (Pass 3) — Onboarding bug: FIXED (schema_v8 applied)
- ITEM 2 (Pass 3) — Reset password smoke test: RESOLVED
- ITEM 3 (Pass 3) — Notification pipeline: CONFIRMED working
- ITEM 4 (Pass 3) — Social icons: FIXED (brand SVGs)

**Pass 4 autonomous fixes applied:**
- Migration drift audit: NO drift found — all v6–v10 schemas confirmed applied
- Hub /reset-password page: EXISTS and working — no fix needed
- SEO + OG meta: ADDED to root layout (commit 946bd8c)
- LAUNCH-RUNBOOK.md: CREATED (commit 92c9fca)
- Email deliverability: CONFIRMED — all Resend emails showing "Delivered", domain verified
- Console errors: CONFIRMED clean — only chrome extension noise, zero app errors
- Empty state test user: CREATED, verified (handle_new_user trigger ✅), CLEANED UP

---

If new issues arise, they will be added here.
