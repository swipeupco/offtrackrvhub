import { NextResponse } from 'next/server'
import OpenAI from 'openai'

// Lazy init — instantiating at module scope fails the Next build whenever
// OPENAI_API_KEY isn't present at build time (e.g. CI without secrets).
let openaiClient: OpenAI | null = null
function getOpenAI() {
  if (!openaiClient) openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return openaiClient
}

const SYSTEM_PROMPT = `You are a creative brief assistant for a marketing agency. You help clients brief their creative team on content they need produced.

Based on the user's rough idea, return a JSON object with these fields:
{
  "title": "short card title (max 8 words)",
  "campaign": "campaign or event name if identifiable, else empty string",
  "contentType": "exactly one of: Video, Graphic, EDM, Signage, Voiceover, Script, Other",
  "sizes": ["array from: 1:1, 4:5, 9:16, 16:9 — pick what fits the content type"],
  "brief": "2-3 lines max. Format: Objective | Key Message | Tone. No waffle."
}

Return ONLY valid JSON. No markdown fences. Keep the brief concise — 3 short lines max.`

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json()
    const completion = await getOpenAI().chat.completions.create({
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
