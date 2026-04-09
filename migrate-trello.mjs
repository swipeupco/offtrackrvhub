/**
 * One-time migration: Trello cards → Supabase briefs table
 * Run with: node migrate-trello.mjs
 *
 * Make sure you've run the SQL to create the briefs table first.
 */

const TRELLO_KEY   = process.env.TRELLO_KEY   || ''
const TRELLO_TOKEN = process.env.TRELLO_TOKEN || ''
const TRELLO_BOARD = process.env.TRELLO_BOARD || ''

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Custom field IDs
const CF_CAMPAIGN = '666fee9e24fdad7631ab5de4'
const CF_TYPE     = '666fee9e24fdad7631ab5de6'
const CF_SIZES    = '666fee9e24fdad7631ab5e00'
const CF_DRAFT    = '69d73098f3404cfb0330e5f3'

// List ID → status
const LIST_STATUS = {
  '6614e07109c74b4bf05f0da8': 'backlog',
  '666fee9d24fdad7631ab5c7e': 'in_production',
  '666fee9d24fdad7631ab5c7f': 'approved',
}

// Trello type option ID → text
const TYPE_OPTIONS = {
  '666fee9e24fdad7631ab5de7': 'Video',
  '666fee9e24fdad7631ab5de8': 'Graphic',
  '686f1dfdfa604e8d543a09f5': 'Other',
  '69b0a4815b2deeeaef10f0cf': 'EDM',
  '69b0a491a6bc62fb06a400c5': 'Signage',
}

const supaHeaders = {
  apikey: SUPA_KEY,
  Authorization: `Bearer ${SUPA_KEY}`,
  'Content-Type': 'application/json',
}

async function main() {
  console.log('Fetching cards from Trello…')

  const res = await fetch(
    `https://api.trello.com/1/boards/${TRELLO_BOARD}/cards` +
    `?key=${TRELLO_KEY}&token=${TRELLO_TOKEN}` +
    `&fields=id,name,idList,due,labels,desc,pos,closed` +
    `&customFieldItems=true&attachments=true&attachment_fields=url,name`
  )
  if (!res.ok) throw new Error(`Trello error: ${res.status}`)
  const rawCards = await res.json()

  // Only migrate open cards in known lists
  const cards = rawCards.filter(c => !c.closed && LIST_STATUS[c.idList])
  console.log(`Found ${cards.length} cards to migrate (skipping archived/unknown lists)`)

  let inserted = 0, skipped = 0

  for (const card of cards) {
    const cfi = card.customFieldItems ?? []
    const get = (id) => cfi.find(f => f.idCustomField === id)

    const campaignField = get(CF_CAMPAIGN)
    const typeField     = get(CF_TYPE)
    const sizesField    = get(CF_SIZES)
    const draftField    = get(CF_DRAFT)

    const campaign    = campaignField?.value?.text ?? null
    const contentType = typeField?.idValue ? (TYPE_OPTIONS[typeField.idValue] ?? null) : null
    const sizes       = sizesField?.value?.text ?? null
    const draftUrl    = draftField?.value?.text ?? null

    // Parse desc for any leftover metadata lines
    const lines = (card.desc ?? '').split('\n')
    const briefLines = lines.filter(l =>
      !l.startsWith('Campaign: ') &&
      !l.startsWith('Type: ') &&
      !l.startsWith('Sizes: ')
    )
    const description = briefLines.join('\n').trim() || null

    // Reference URL attachments
    const referenceUrls = (card.attachments ?? [])
      .map(a => a.url)
      .filter(Boolean)

    const row = {
      name:           card.name,
      description,
      campaign,
      content_type:   contentType,
      sizes,
      status:         LIST_STATUS[card.idList],
      draft_url:      draftUrl,
      due_date:       card.due ? card.due.split('T')[0] : null,
      labels:         card.labels ?? [],
      pos:            card.pos,
      reference_urls: referenceUrls,
    }

    const insertRes = await fetch(`${SUPA_URL}/rest/v1/briefs`, {
      method: 'POST',
      headers: { ...supaHeaders, Prefer: 'return=minimal' },
      body: JSON.stringify(row),
    })

    if (insertRes.ok || insertRes.status === 201) {
      console.log(`  ✓ ${card.name} [${LIST_STATUS[card.idList]}]`)
      inserted++
    } else {
      const err = await insertRes.json().catch(() => ({}))
      console.error(`  ✗ ${card.name} — ${err.message ?? insertRes.status}`)
      skipped++
    }
  }

  console.log(`\nDone. ${inserted} inserted, ${skipped} failed.`)
}

main().catch(err => { console.error(err); process.exit(1) })
