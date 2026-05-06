# Eden's Launch Readiness Inbox

Items requiring your decision or action. Updated: 2026-05-06.

---

## ITEM 1 — Onboarding broken: "We couldn't find your account" after profile step

**Task:** 7e (smoke test)
**Priority:** LAUNCH BLOCKER
**What happened:** After confirming email via the new branded email, the /onboarding page loaded correctly with a session. The profile modal ("Welcome! Let's set up your profile") appeared and the name "Launch Test 1" was submitted. After clicking "Get Started", the app returned to /dashboard showing "We couldn't find your account. Please sign in again." The second onboarding step (business branding: logo + colour picker) never appeared.
**Impact:** New self-serve clients cannot complete setup. The client row may not be getting created or profile.client_id is not being set.
**What's needed:** Debug onboarding/page.tsx — check if client INSERT runs and profile.client_id is updated after the profile step. The branding step should show when client_id is null.
**Left off:** Tasks 7f, 8, 9 were not completed due to this blocker.

---

## ITEM 2 — Reset password smoke test needed

**Task:** 8
**What's needed:**
1. portal.swipeupco.com → Forgot password → eden+1@swipeupco.com → click reset link → set password SwipeUp2026!!
2. hub.swipeupco.com → Forgot password → eden@swipeupco.com → same new password SwipeUp2026!!

---

## ITEM 3 — Notification pipeline smoke test needed

**Task:** 9
**What's needed:** With two browser sessions:
- Portal: post @mention comment → Hub: bell notification appears within 10s, email within 60s
- Hub: move brief to client_review → Portal: bell + email to client

---

## ITEM 4 — Missing notification triggers

**Task:** 13a
**Finding:** Expected 3 triggers but only trg_notify_on_client_review exists. Missing: trg_notify_on_approved, trg_notify_on_revisions.
**Impact:** "Brief approved" and "Revisions requested" notifications won't fire.
**Diagnose:** SELECT tgname, tgrelid::regclass FROM pg_trigger WHERE tgname ILIKE 'trg_notify%' AND NOT tgisinternal;

---

## ITEM 5 — Supabase auth emails should use Resend SMTP

**Task:** Adjacent to 5
**Finding:** Auth emails (confirm signup, reset password etc.) are sent via Supabase built-in service which has rate limits and is not for production.
**Fix:** https://supabase.com/dashboard/project/uwpuhspaokikbvgbnrfw/auth/smtp
- Enable custom SMTP
- Host: smtp.resend.com
- Port: 465 (SSL) or 587 (TLS)
- Username: resend
- Password: [your Resend API key — get from resend.com/api-keys]
- From: notifications@swipeupco.com

---

## Applied this session (no action needed)

- **Task 10:** Created trigger trg_grant_staff_access on clients table. All staff (Eden Jannides, Sophie) now auto-get access to new clients. Backfilled all existing clients.
- **Task 6:** Cleaned up test users: eden+5, eden+logotest, eden+test1, demo-riley, demo-jamie, demo-alex deleted.
- **Task 5:** Email templates branded: Reset password, Magic link, Change email, Invite user.
- **Task 1:** SwipeUp_Email.png is live at https://portal.swipeupco.com/SwipeUp_Email.png
- **Task 2:** Signup "Check your inbox" screen deployed.
- **Task 3:** /account redirect deployed for portal.
