import { NextResponse } from 'next/server'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supaHeaders = {
  apikey: SUPA_KEY,
  Authorization: `Bearer ${SUPA_KEY}`,
  'Content-Type': 'application/json',
}

const MAX_IN_PRODUCTION = 3

async function getInProductionCount(): Promise<number> {
  const res = await fetch(
    `${SUPA_URL}/rest/v1/briefs?status=eq.in_production&select=id`,
    { headers: { ...supaHeaders, Prefer: 'count=exact' } }
  )
  const range = res.headers.get('Content-Range')
  return parseInt(range?.split('/')[1] ?? '0', 10)
}

async function getTopBacklog(limit: number): Promise<{ id: string; name: string }[]> {
  const res = await fetch(
    `${SUPA_URL}/rest/v1/briefs?status=eq.backlog&order=pos.asc&limit=${limit}&select=id,name`,
    { headers: supaHeaders }
  )
  return res.json()
}

async function setStatus(id: string, status: string) {
  await fetch(`${SUPA_URL}/rest/v1/briefs?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...supaHeaders, Prefer: 'return=minimal' },
    body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
  })
}

async function fillProduction(): Promise<{ id: string; name: string }[]> {
  const promoted: { id: string; name: string }[] = []
  let count = await getInProductionCount()
  while (count < MAX_IN_PRODUCTION) {
    const [top] = await getTopBacklog(1)
    if (!top) break
    await setStatus(top.id, 'in_production')
    promoted.push(top)
    count++
  }
  return promoted
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { cardId, action } = body

    if (action === 'fill') {
      const promoted = await fillProduction()
      return NextResponse.json({ success: true, promoted })
    }

    if (action === 'reorder') {
      const { positions } = body as { positions: { id: string; pos: number }[] }
      await Promise.all(positions.map(({ id, pos }) =>
        fetch(`${SUPA_URL}/rest/v1/briefs?id=eq.${id}`, {
          method: 'PATCH',
          headers: { ...supaHeaders, Prefer: 'return=minimal' },
          body: JSON.stringify({ pos }),
        })
      ))
      return NextResponse.json({ success: true })
    }

    if (action === 'backlog') {
      await setStatus(cardId, 'backlog')
      await fillProduction()
      return NextResponse.json({ success: true })
    }

    if (action === 'delete') {
      await fetch(`${SUPA_URL}/rest/v1/briefs?id=eq.${cardId}`, {
        method: 'DELETE',
        headers: { ...supaHeaders, Prefer: 'return=minimal' },
      })
      return NextResponse.json({ success: true })
    }

    if (action !== 'approve') {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    await setStatus(cardId, 'approved')
    const promoted = await fillProduction()
    return NextResponse.json({ success: true, promoted })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
