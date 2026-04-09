import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

async function makeSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
}

// GET /api/shared-link?token=xxx — verify token exists
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'No token' }, { status: 400 })
  const supabase = await makeSupabase()
  const { data } = await supabase.from('shared_links').select('id, type').eq('token', token).single()
  if (!data) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  return NextResponse.json({ valid: true, type: data.type })
}

// POST /api/shared-link — create a new share link
export async function POST(request: Request) {
  const supabase = await makeSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { type = 'calendar' } = await request.json().catch(() => ({}))

  // Check if user already has a link of this type
  const { data: existing } = await supabase
    .from('shared_links')
    .select('token')
    .eq('created_by', user.id)
    .eq('type', type)
    .single()

  if (existing) return NextResponse.json({ token: existing.token })

  const { data, error } = await supabase
    .from('shared_links')
    .insert({ type, created_by: user.id })
    .select('token')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ token: data.token })
}
