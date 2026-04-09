import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const SYSTEM_PROMPT = `You are a creative brief assistant for Off Track RV, an Australian caravan dealership (brands: Vacationer, Radiant, Atlas, OzVenture). They attend caravan shows across Australia and create marketing content.

Based on the user's rough idea, return a JSON object with these fields:
{
  "title": "short card title (max 8 words)",
  "campaign": "campaign or show name if identifiable, else empty string",
  "contentType": "exactly one of: Video, Graphic, EDM, Signage, Voiceover, Script, Other",
  "sizes": ["array from: 1:1, 4:5, 9:16, 16:9 — pick what fits the content type"],
  "brief": "2-3 lines max. Format: Objective | Key Message | Tone. No waffle."
}

Return ONLY valid JSON. No markdown fences. Keep the brief concise — 3 short lines max.`

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json()
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      max_tokens: 300,
      response_format: { type: 'json_object' },
    })
    const raw = completion.choices[0]?.message?.content ?? '{}'
    const data = JSON.parse(raw)
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
