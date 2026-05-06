# SwipeUp Portal — Launch Runbook

> Last updated: 7 May 2026 (Pass 4 audit)  
> Maintained by: Eden Jannides (eden@swipeupco.com)

---

## Critical URLs

| Service | URL |
|---|---|
| Portal (client-facing) | https://portal.swipeupco.com |
| Hub (staff-facing) | https://hub.swipeupco.com |
| Supabase Dashboard | https://supabase.com/dashboard/project/uwpuhspaokikbvgbnrfw |
| Vercel | https://vercel.com/swipeupco |
| Resend | https://resend.com |
| GitHub | https://github.com/swipeupco/swipeup-portal |

---

## Schema Migration Order

Schemas must be applied in version order. All versions through v10 are applied on prod as of May 2026:

1. `supabase/schema.sql` — Base schema (v1)
2. `supabase/schema_v2.sql` — Video shoots table
3. `supabase/schema_v3.sql` — hubspot_audience, 2026 show calendar
4. `supabase/schema_v4_shared_links_tenancy.sql` — Shared links multi-tenancy
5. `supabase/schema_v5_task4_attribution.sql` — Brief attribution (created_by, assigned_users)
6. `supabase/schema_v6_task5_notifications_mentions.sql` — Notifications + mentions
7. `supabase/schema_v7_task6_email_delivery.sql` — Email delivery via Resend Edge Function
8. `supabase/schema_v8_task7_self_serve.sql` — Self-serve signup (handle_new_user v8)
9. `supabase/schema_v9_task8_notifications_fix.sql` — Notification pipeline fix (brief_name/client_name columns)
10. `supabase/schema_v10_task9_bell_schema.sql` — Notification bell UX (actor_id, comment_id)

To apply a new migration: paste into Supabase SQL Editor → Run this query.

---

## Common SQL Queries

### Find a user by email
```sql
SELECT id, email, email_confirmed_at, created_at
FROM auth.users
WHERE email = 'client@example.com';
```

### Find a client by name
```sql
SELECT id, name, slug, color, logo_url, in_production_limit, created_at
FROM clients
WHERE name ILIKE '%client name%';
```

### See all clients + their staff access
```sql
SELECT 
  c.name AS client,
  c.slug,
  p.name AS staff_name,
  p.email AS staff_email,
  sca.created_at AS access_granted
FROM clients c
LEFT JOIN staff_client_access sca ON sca.client_id = c.id
LEFT JOIN profiles p ON p.id = sca.staff_id
ORDER BY c.name, p.name;
```

### Find all profiles for a client
```sql
SELECT p.id, p.name, p.email, p.role, p.is_admin, p.is_staff, p.client_id
FROM profiles p
WHERE p.client_id = (SELECT id FROM clients WHERE name ILIKE '%client name%');
```

### See recent failed or undelivered notifications
```sql
SELECT n.id, n.event_type, n.type, n.message, n.created_at, p.email
FROM notifications n
LEFT JOIN profiles p ON p.id = n.user_id
WHERE n.created_at > now() - interval '7 days'
ORDER BY n.created_at DESC
LIMIT 50;
```

### Manually confirm a user's email (when they can't find the confirmation email)
```sql
UPDATE auth.users
SET email_confirmed_at = now()
WHERE email = 'client@example.com';
```

### Reset a user's password (admin override — sets a temp password)
```sql
UPDATE auth.users
SET encrypted_password = crypt('TempPassword123!', gen_salt('bf'))
WHERE email = 'client@example.com';
-- Then tell the client to log in with TempPassword123! and change it immediately.
```

### Delete a client and all their data (FK cascade order)
```sql
-- Step 1: Delete auth user (cascades to profiles via ON DELETE CASCADE)
DELETE FROM auth.users
WHERE id IN (
  SELECT p.id FROM profiles p
  WHERE p.client_id = (SELECT id FROM clients WHERE name = 'Client Name')
);

-- Step 2: Delete the client (profiles already gone, no FK violation)
DELETE FROM clients WHERE name = 'Client Name';

-- Step 3: Verify
SELECT COUNT(*) FROM profiles WHERE client_id = (SELECT id FROM clients WHERE name = 'Client Name');
-- Should return 0 or error (client row gone)
```

---

## 3 Most Likely Failure Modes

### 1. "Confirmation email didn't arrive"

**Symptom:** Client signed up but never received the confirmation email.

**Resolution steps:**
1. Check Resend → Emails: search for the client's email address
2. If "Delivered" — it arrived, tell client to check spam/junk
3. If not found in Resend — check Supabase Auth logs for the signup event
4. Manually confirm via SQL:
```sql
UPDATE auth.users
SET email_confirmed_at = now()
WHERE email = 'client@example.com';
```
5. Then tell client to log in at portal.swipeupco.com/login

---

### 2. "I signed up but can't see anything" (stuck onboarding)

**Symptom:** Client signed up, confirmed email, but /onboarding shows error OR blank.

**Root cause:** handle_new_user trigger didn't fire (function drift, or user was created via SQL without triggering the INSERT trigger).

**Diagnosis:**
```sql
-- Check if profile + client exists
SELECT p.id, p.client_id, c.name AS client_name
FROM profiles p
LEFT JOIN clients c ON c.id = p.client_id
WHERE p.id = (SELECT id FROM auth.users WHERE email = 'client@example.com');
```

**Fix A — profile exists but client_id is NULL (trigger fired but client wasn't created):**
```sql
-- Check function version
SELECT LEFT(pg_get_functiondef(oid), 500) FROM pg_proc WHERE proname = 'handle_new_user';
-- If it doesn't show "insert into clients", re-run schema_v8_task7_self_serve.sql
```

**Fix B — profile doesn't exist (trigger never fired):**
```sql
-- Manually run handle_new_user logic for this user
DO $$
DECLARE
  v_user_id uuid := (SELECT id FROM auth.users WHERE email = 'client@example.com');
  v_business text := (SELECT raw_user_meta_data->>'business_name' FROM auth.users WHERE email = 'client@example.com');
  v_new_slug text;
  v_client_id uuid;
BEGIN
  v_new_slug := generate_unique_client_slug(v_business);
  INSERT INTO clients (name, slug) VALUES (v_business, v_new_slug) RETURNING id INTO v_client_id;
  INSERT INTO profiles (id, client_id) VALUES (v_user_id, v_client_id);
END $$;
```

---

### 3. "My client looks broken on the Hub"

**Symptom:** Staff can't see a specific client in the Hub, or client's briefs are invisible to staff.

**Root cause:** Missing row in staff_client_access (grant_staff_access_to_new_client trigger may not have backfilled).

**Diagnosis:**
```sql
SELECT sca.staff_id, sca.client_id, p.email, c.name
FROM staff_client_access sca
JOIN profiles p ON p.id = sca.staff_id
JOIN clients c ON c.id = sca.client_id
WHERE c.name ILIKE '%client name%';
```

**Fix — backfill staff access for a specific client:**
```sql
INSERT INTO staff_client_access (staff_id, client_id)
SELECT p.id, c.id
FROM profiles p, clients c
WHERE (p.is_staff = true OR p.is_admin = true)
  AND c.name ILIKE '%client name%'
ON CONFLICT DO NOTHING;
```

---

## Common UI Fixes

### Force-refresh a client's branding (logo/colour not updating)
The portal reads branding from the clients table at page load. If a client updates their branding but still sees old values:
1. Ask them to hard-refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
2. If still stale, check the clients table directly:
```sql
SELECT name, slug, color, logo_url FROM clients WHERE name ILIKE '%client name%';
```

### Client signed up with wrong business name
```sql
UPDATE clients
SET name = 'Correct Business Name',
    slug = generate_unique_client_slug('Correct Business Name')
WHERE name = 'Wrong Name';

UPDATE profiles
SET name = 'Correct Name'
WHERE client_id = (SELECT id FROM clients WHERE name = 'Correct Business Name');
```

---

## When a Client Emails Saying...

| Client says | You do |
|---|---|
| "I didn't get the confirmation email" | Check Resend, manually confirm via SQL if needed |
| "I can't log in" | Check auth.users for their email, check if confirmed |
| "My logo/colour isn't showing" | Check clients table, ask them to hard refresh |
| "I see someone else's data" | URGENT — check RLS policies, check client_id on their profile |
| "The page is blank" | Check browser console, check if profile has client_id |
| "My team member can't see the portal" | Check if their profile has correct client_id, check if they confirmed email |

---

## Deployment Notes

- **Portal** deploys automatically to Vercel on push to `main` branch (~60s build time)
- **Hub** deploys separately — check the swipeup (Hub) repo
- **Database changes** require manual SQL execution in Supabase SQL Editor — no automatic migrations
- **Edge Functions** deploy via `supabase functions deploy send-notification` (rarely needed)
- The **Resend API key** and **Edge Function URL** are set as Supabase secrets/GUCs

---

## Database Health Checks

```sql
-- Client count
SELECT COUNT(*) FROM clients;

-- User count  
SELECT COUNT(*) FROM auth.users;

-- Unconfirmed users (may need manual confirmation)
SELECT email, created_at FROM auth.users WHERE email_confirmed_at IS NULL ORDER BY created_at DESC;

-- Recent notifications (last 24h)
SELECT COUNT(*), event_type FROM notifications WHERE created_at > now() - interval '1 day' GROUP BY event_type;

-- Orphaned profiles (profile with no matching client)
SELECT p.id, p.email FROM profiles p WHERE p.client_id IS NULL OR NOT EXISTS (SELECT 1 FROM clients WHERE id = p.client_id);
```
