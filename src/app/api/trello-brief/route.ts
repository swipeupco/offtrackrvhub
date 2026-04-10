import { NextResponse } from 'next/server'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supaHeaders = {
  apikey: SUPA_KEY,
  Authorization: `Bearer ${SUPA_KEY}`,
  'Content-Type': 'application/json',
}

function parseDesc(raw: string | null) {
  const lines = (raw ?? '').split('\n')
  let campaign = '', contentType = '', sizes = '', briefLines: string[] = []
  for (const line of lines) {
    if (line.startsWith('Campaign: '))      campaign    = line.replace('Campaign: ', '')
    else if (line.startsWith('Type: '))     contentType = line.replace('Type: ', '')
    else if (line.startsWith('Sizes: '))    sizes       = line.replace('Sizes: ', '')
    else briefLines.push(line)
  }
  return { campaign, contentType, sizes, brief: briefLines.join('\n').trim() }
}

export async function POST(request: Request) {
  try {
    const { name, desc, campaign: explicitCampaign, referenceUrls = [] } = await request.json()
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const parsed = parseDesc(desc)

    // Place new card at top of backlog (smallest pos)
    const posRes = await fetch(
      `${SUPA_URL}/rest/v1/briefs?status=eq.backlog&select=pos&order=pos.asc&limit=1`,
      { headers: supaHeaders }
    )
    const [firstCard] = await posRes.json()
    const pos = firstCard ? firstCard.pos - 1000 : Date.now()

    const insertRes = await fetch(`${SUPA_URL}/rest/v1/briefs`, {
      method: 'POST',
      headers: { ...supaHeaders, Prefer: 'return=representation' },
      body: JSON.stringify({
        name:          name.trim(),
        description:   parsed.brief || desc || null,
        campaign:      explicitCampaign || parsed.campaign || null,
        content_type:  parsed.contentType || null,
        sizes:         parsed.sizes || null,
        status:        'backlog',
        pos,
        reference_urls: referenceUrls.filter(Boolean),
      }),
    })
    if (!insertRes.ok) {
      const err = await insertRes.json()
      return NextResponse.json({ error: err.message ?? 'Failed to create' }, { status: 500 })
    }
    const [card] = await insertRes.json()
    return NextResponse.json({ cardId: card.id, cardUrl: '' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
