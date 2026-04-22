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

// GET /api/shared-link?token=xxx — verify token exists; return type + client scope
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'No token' }, { status: 400 })
  const supabase = await makeSupabase()
  const { data } = await supabase
    .from('shared_links')
    .select('id, type, client_id')
    .eq('token', token)
    .single()
  if (!data) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  return NextResponse.json({ valid: true, type: data.type, client_id: data.client_id })
}

// POST /api/shared-link — create a new share link scoped to the creator's client
export async function POST(request: Request) {
  const supabase = await makeSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { type = 'calendar' } = await request.json().catch(() => ({}))

  const { data: profile } = await supabase
    .from('profiles')
    .select('client_id')
    .eq('id', user.id)
    .single()

  if (!profile?.client_id) {
    return NextResponse.json({ error: 'No client associated with user' }, { status: 400 })
  }

  // Reuse existing link for this (user, type)
  const { data: existing } = await supabase
    .from('shared_links')
    .select('token')
    .eq('created_by', user.id)
    .eq('type', type)
    .single()

  if (existing) return NextResponse.json({ token: existing.token })

  const { data, error } = await supabase
    .from('shared_links')
    .insert({ type, created_by: user.id, client_id: profile.client_id })
    .select('token')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ token: data.token })
}
