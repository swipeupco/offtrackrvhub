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

export async function PATCH(request: Request) {
  try {
    const { cardId, name, desc, contentType } = await request.json()
    const parsed = parseDesc(desc)

    const update: Record<string, any> = { updated_at: new Date().toISOString() }
    if (name !== undefined)        update.name         = name
    if (desc !== undefined) {
      update.description  = parsed.brief || null
      update.campaign     = parsed.campaign || null
      update.sizes        = parsed.sizes || null
    }
    // contentType passed explicitly takes precedence over what's in desc
    if (contentType !== undefined) update.content_type = contentType || null
    else if (parsed.contentType)   update.content_type = parsed.contentType

    const res = await fetch(`${SUPA_URL}/rest/v1/briefs?id=eq.${cardId}`, {
      method: 'PATCH',
      headers: { ...supaHeaders, Prefer: 'return=representation' },
      body: JSON.stringify(update),
    })
    if (!res.ok) return NextResponse.json({ error: 'DB error' }, { status: 502 })
    const [row] = await res.json()
    return NextResponse.json({ name: row?.name, desc: row?.description })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
