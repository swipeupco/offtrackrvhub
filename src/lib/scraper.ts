export interface ScrapedShowData {
  name?: string
  start_date?: string
  end_date?: string
  location?: string
}

export interface ScrapedVanData {
  model_name?: string
  brand?: string
  price?: number
  features?: string
  image_url?: string
}

export interface ScrapeResult {
  success: boolean
  data?: ScrapedShowData | ScrapedVanData
  error?: string
}

export async function scrapeVanFromUrl(url: string): Promise<ScrapeResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return { success: false, error: 'OpenAI API key not configured' }

  try {
    const pageRes = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CaravanBot/1.0)' },
      signal: AbortSignal.timeout(15000),
    })
    if (!pageRes.ok) return { success: false, error: `Could not fetch URL (${pageRes.status})` }

    const html = await pageRes.text()

    // Extract og:image or first large img src before stripping tags
    const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
    const ogImage = ogImageMatch?.[1] ?? null

    const text = html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .slice(0, 12000)

    const prompt = `
Extract caravan/RV product details from this webpage text.
Return ONLY valid JSON with these fields (omit fields you cannot find):
{
  "model_name": "Full model name e.g. Vacationer 18ft",
  "brand": "Brand/manufacturer name e.g. Vacationer",
  "price": 85000,
  "features": "Full complete features list exactly as shown on the page — include every bullet point, spec, dimension and feature. Do NOT summarise or condense. Use newlines between items.",
  "image_url": "Absolute URL of the main product image if visible in the text"
}
Webpage text:
"""
${text}
"""
`.trim()

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0,
      }),
    })

    if (!openaiRes.ok) return { success: false, error: 'OpenAI API error' }

    const openaiData = await openaiRes.json()
    const raw = openaiData.choices?.[0]?.message?.content
    const parsed: ScrapedVanData = JSON.parse(raw)

    // Use og:image if AI didn't find one
    if (!parsed.image_url && ogImage) parsed.image_url = ogImage

    return { success: true, data: parsed }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

/**
 * Server-side function that uses OpenAI to extract show data from a URL.
 * Called from an API route, NOT from the client directly.
 */
export async function scrapeShowFromUrl(url: string): Promise<ScrapeResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return { success: false, error: 'OpenAI API key not configured' }
  }

  try {
    // Fetch the HTML content of the page
    const pageRes = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CaravanBot/1.0)' },
      signal: AbortSignal.timeout(10000),
    })

    if (!pageRes.ok) {
      return { success: false, error: `Could not fetch URL (${pageRes.status})` }
    }

    const html = await pageRes.text()
    // Strip HTML to reduce tokens — keep visible text
    const text = html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .slice(0, 6000) // cap tokens

    const prompt = `
Extract caravan/RV show event details from this webpage text.
Return ONLY valid JSON with these fields (omit fields you cannot find):
{
  "name": "Show name",
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD",
  "location": "Venue name and city"
}
Today's year is ${new Date().getFullYear()}.
Webpage text:
"""
${text}
"""
`.trim()

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0,
      }),
    })

    if (!openaiRes.ok) {
      return { success: false, error: 'OpenAI API error' }
    }

    const openaiData = await openaiRes.json()
    const raw = openaiData.choices?.[0]?.message?.content
    const parsed: ScrapedShowData = JSON.parse(raw)

    return { success: true, data: parsed }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}
