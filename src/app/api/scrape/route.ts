import { NextRequest, NextResponse } from 'next/server'
import { scrapeShowFromUrl, scrapeVanFromUrl } from '@/lib/scraper'

export async function POST(req: NextRequest) {
  try {
    const { url, mode } = await req.json()
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'url is required' }, { status: 400 })
    }
    const result = mode === 'van'
      ? await scrapeVanFromUrl(url)
      : await scrapeShowFromUrl(url)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 })
  }
}
