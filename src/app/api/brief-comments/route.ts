import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const headers = {
  apikey: SUPA_KEY,
  Authorization: `Bearer ${SUPA_KEY}`,
  'Content-Type': 'application/json',
}

export async function GET(req: NextRequest) {
  const cardId = req.nextUrl.searchParams.get('cardId')
  if (!cardId) return NextResponse.json([], { status: 200 })
  const res = await fetch(
    `${SUPA_URL}/rest/v1/brief_comments?card_id=eq.${encodeURIComponent(cardId)}&order=created_at.asc&select=*`,
    { headers }
  )
  const data = await res.json()
  return NextResponse.json(Array.isArray(data) ? data : [])
}

export async function POST(req: NextRequest) {
  const { cardId, cardName, authorName, comment } = await req.json()
  if (!cardId || !comment || !authorName) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Insert comment
  const insertRes = await fetch(`${SUPA_URL}/rest/v1/brief_comments`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({ card_id: cardId, author_name: authorName, comment }),
  })
  if (!insertRes.ok) return NextResponse.json({ error: 'Failed to save' }, { status: 500 })

  // Insert notification so the bell lights up
  await fetch(`${SUPA_URL}/rest/v1/notifications`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message: `New comment on "${cardName}": ${comment.slice(0, 80)}${comment.length > 80 ? '…' : ''}`,
      type: 'comment',
      link: '/trello',
      resolved: false,
    }),
  })

  return NextResponse.json({ ok: true })
}
