import { NextResponse } from 'next/server'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supaHeaders = {
  apikey: SUPA_KEY,
  Authorization: `Bearer ${SUPA_KEY}`,
  'Content-Type': 'application/json',
}

// Keep same list ID constants so the frontend needs no changes
const LIST_BACKLOG       = '6614e07109c74b4bf05f0da8'
const LIST_IN_PRODUCTION = '666fee9d24fdad7631ab5c7e'
const LIST_APPROVED      = '666fee9d24fdad7631ab5c7f'

const STATUS_TO_LIST: Record<string, string> = {
  backlog:       LIST_BACKLOG,
  in_production: LIST_IN_PRODUCTION,
  approved:      LIST_APPROVED,
}

const TYPE_COLORS: Record<string, string> = {
  Video:     '#22c55e',
  Graphic:   '#f97316',
  EDM:       '#ef4444',
  Signage:   '#0ea5e9',
  Voiceover: '#a855f7',
  Script:    '#f59e0b',
  Other:     '#94a3b8',
}

export async function GET() {
  try {
    const res = await fetch(
      `${SUPA_URL}/rest/v1/briefs?select=*&order=pos.asc`,
      { headers: supaHeaders }
    )
    if (!res.ok) return NextResponse.json({ error: 'DB error' }, { status: 502 })
    const rows = await res.json()

    const cards = rows.map((row: any) => ({
      id:       row.id,
      name:     row.name,
      idList:   STATUS_TO_LIST[row.status] ?? LIST_BACKLOG,
      url:      '',
      due:      row.due_date ? `${row.due_date}T00:00:00.000Z` : null,
      labels:   row.labels ?? [],
      desc:     row.description,
      campaign: row.campaign,
      type:     row.content_type
        ? { text: row.content_type, color: TYPE_COLORS[row.content_type] ?? '#94a3b8' }
        : null,
      sizes:    row.sizes,
      status:   row.status,
      draftUrl: row.draft_url,
    }))

    const lists = [
      { id: LIST_BACKLOG,       name: 'Backlog' },
      { id: LIST_IN_PRODUCTION, name: 'In Production' },
      { id: LIST_APPROVED,      name: 'Approved' },
    ]

    // Auto-notify when a draft URL is newly added
    try {
      const cardsWithDraft = cards.filter((c: any) => c.draftUrl)
      if (cardsWithDraft.length > 0) {
        const ids = cardsWithDraft.map((c: any) => c.id).join(',')
        const alreadyNotified = await fetch(
          `${SUPA_URL}/rest/v1/card_draft_notifications?card_id=in.(${ids})&select=card_id`,
          { headers: supaHeaders }
        ).then(r => r.json()).then((rows: any[]) => new Set(rows.map(r => r.card_id)))

        const newlyReady = cardsWithDraft.filter((c: any) => !alreadyNotified.has(c.id))
        for (const card of newlyReady) {
          await Promise.all([
            fetch(`${SUPA_URL}/rest/v1/notifications`, {
              method: 'POST', headers: supaHeaders,
              body: JSON.stringify({
                message: `Draft ready for review: "${card.name}"`,
                type: 'draft_ready', link: '/trello', resolved: false,
              }),
            }),
            fetch(`${SUPA_URL}/rest/v1/card_draft_notifications`, {
              method: 'POST', headers: { ...supaHeaders, Prefer: 'resolution=merge-duplicates' },
              body: JSON.stringify({ card_id: card.id }),
            }),
          ])
        }
      }
    } catch {}

    return NextResponse.json({ lists, cards }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
