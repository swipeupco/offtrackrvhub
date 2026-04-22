// Supabase Edge Function: send-notification
// Deploy with: supabase functions deploy send-notification
// Env vars required:
//   RESEND_API_KEY             — Resend API key (swipeupco.com verified sender)
//   SUPABASE_URL               — auto-provided by Supabase runtime
//   SUPABASE_SERVICE_ROLE_KEY  — auto-provided by Supabase runtime
//
// Input body (JSON): { notification_id: string }
// The caller (DB trigger via pg_net) posts the freshly-inserted notification's
// id; this function looks it up, checks the recipient's preferences, and
// sends an email via Resend if email is enabled for that event_type.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SENDER_EMAIL   = 'notifications@swipeupco.com'
const SENDER_NAME    = 'SwipeUp'
const REPLY_TO       = 'notifications@swipeupco.com'
const CLIENT_ORIGIN  = 'https://portal.swipeupco.com'
const STAFF_ORIGIN   = 'https://hub.swipeupco.com'
const BRAND_COLOR    = '#4950F8'

type Notification = {
  id: string
  user_id: string
  event_type: string | null
  type: string | null
  message: string
  link: string | null
  brief_id: string | null
  brief_name: string | null
  created_at: string
}

function subjectFor(n: Notification): string {
  switch (n.event_type) {
    case 'mentioned':        return `You were mentioned on "${n.brief_name ?? 'a brief'}"`
    case 'new_comment':      return `New comment on "${n.brief_name ?? 'a brief'}"`
    case 'ready_for_review': return `Ready for your review: "${n.brief_name ?? 'a brief'}"`
    case 'status_change':    return `Status updated: "${n.brief_name ?? 'a brief'}"`
    default:                 return n.message.slice(0, 80)
  }
}

function escape(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function emailHtml(args: {
  recipientName: string
  message: string
  ctaUrl: string
  ctaLabel: string
  preferencesUrl: string
}) {
  const { recipientName, message, ctaUrl, ctaLabel, preferencesUrl } = args
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SwipeUp</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="background:#09090b;padding:18px 24px;border-top-left-radius:16px;border-top-right-radius:16px;">
      <span style="color:#ffffff;font-weight:900;font-size:18px;letter-spacing:-0.5px;">
        SwipeUp<span style="color:${BRAND_COLOR};">.</span>
      </span>
    </div>
    <div style="background:#ffffff;padding:32px 24px;border-bottom-left-radius:16px;border-bottom-right-radius:16px;border:1px solid #e4e4e7;border-top:0;">
      <p style="color:#18181b;font-size:15px;line-height:1.6;margin:0 0 8px 0;">Hi ${escape(recipientName)},</p>
      <p style="color:#3f3f46;font-size:15px;line-height:1.6;margin:0 0 24px 0;">${escape(message)}</p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${escape(ctaUrl)}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;">
          ${escape(ctaLabel)}
        </a>
      </div>
      <p style="color:#71717a;font-size:12px;line-height:1.5;margin:0;">
        You're receiving this because you're tagged on or mentioned in this brief.
        <a href="${escape(preferencesUrl)}" style="color:${BRAND_COLOR};text-decoration:underline;">Manage preferences</a>
      </p>
    </div>
    <p style="text-align:center;color:#a1a1aa;font-size:11px;margin-top:16px;">© SwipeUp · Built by SwipeUp</p>
  </div>
</body>
</html>`
}

function textFallback(message: string, ctaUrl: string) {
  return `${message}\n\nOpen: ${ctaUrl}\n\nManage notification preferences: ${ctaUrl.split('/').slice(0, 3).join('/')}/account/notifications\n`
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')
  const SERVICE_ROLE   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!RESEND_API_KEY || !SUPABASE_URL || !SERVICE_ROLE) {
    return new Response(JSON.stringify({ error: 'Missing env vars' }), { status: 500 })
  }

  let body: { notification_id?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }

  if (!body.notification_id) {
    return new Response(JSON.stringify({ error: 'notification_id required' }), { status: 400 })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  // 1. Fetch the notification
  const { data: notification, error: notifError } = await supabase
    .from('notifications')
    .select('*')
    .eq('id', body.notification_id)
    .single<Notification>()

  if (notifError || !notification) {
    return new Response(JSON.stringify({ error: 'Notification not found' }), { status: 404 })
  }

  if (!notification.user_id || !notification.event_type) {
    return new Response(JSON.stringify({ skipped: 'missing user_id or event_type' }), { status: 200 })
  }

  // 2. Check preferences
  const { data: pref } = await supabase
    .from('notification_preferences')
    .select('email_enabled')
    .eq('user_id', notification.user_id)
    .eq('event_type', notification.event_type)
    .single()

  if (pref && pref.email_enabled === false) {
    return new Response(JSON.stringify({ skipped: 'email disabled for this event' }), { status: 200 })
  }

  // 3. Load recipient profile + auth email
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, is_staff, is_admin, client_id')
    .eq('id', notification.user_id)
    .single()

  const { data: userRes } = await supabase.auth.admin.getUserById(notification.user_id)
  const email = userRes?.user?.email
  if (!email) {
    return new Response(JSON.stringify({ error: 'No email for user' }), { status: 404 })
  }

  // 4. Build CTA URL — staff go to hub, clients to portal
  const origin = profile?.is_staff || profile?.is_admin ? STAFF_ORIGIN : CLIENT_ORIGIN
  const ctaUrl = notification.link?.startsWith('/')
    ? `${origin}${notification.link}`
    : origin
  const preferencesUrl = `${origin}/account/notifications`
  const recipientName  = profile?.name ?? email.split('@')[0] ?? 'there'

  // 5. Send via Resend
  const resendResp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:     `${SENDER_NAME} <${SENDER_EMAIL}>`,
      to:       [email],
      reply_to: REPLY_TO,
      subject:  subjectFor(notification),
      html:     emailHtml({
        recipientName,
        message: notification.message,
        ctaUrl,
        ctaLabel: notification.event_type === 'ready_for_review' ? 'Review brief' : 'Open brief',
        preferencesUrl,
      }),
      text: textFallback(notification.message, ctaUrl),
    }),
  })

  if (!resendResp.ok) {
    const errBody = await resendResp.text()
    return new Response(JSON.stringify({ error: 'Resend failed', details: errBody }), { status: 502 })
  }

  return new Response(JSON.stringify({ sent: true }), { status: 200 })
})
