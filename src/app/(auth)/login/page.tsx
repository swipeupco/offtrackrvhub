'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

interface ClientBranding {
  name: string
  color: string
  logo_url: string | null
}

export default function LoginPage() {
  const [mode, setMode]           = useState<'signin' | 'signup'>('signin')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [success, setSuccess]     = useState<string | null>(null)
  const [branding, setBranding]   = useState<ClientBranding | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  // Load client branding — subdomain cookie takes priority, then ?client= param
  useEffect(() => {
    const cookieSlug = document.cookie.match(/x-client-slug=([^;]+)/)?.[1] ?? null
    const slug = cookieSlug || searchParams.get('client')
    if (!slug) return
    const supabase = createClient()
    supabase
      .from('clients')
      .select('name, color, logo_url')
      .eq('slug', slug)
      .single()
      .then(({ data }) => { if (data) setBranding(data) })
  }, [searchParams])

  const accentColor = branding?.color ?? '#14C29F'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)
    const supabase = createClient()

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError('Invalid email or password.')
        setLoading(false)
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
        setLoading(false)
      } else {
        setSuccess('Account created! Check your email to confirm, then sign in.')
        setLoading(false)
        setMode('signin')
        setPassword('')
      }
    }
  }

  function switchMode(next: 'signin' | 'signup') {
    setMode(next)
    setError(null)
    setSuccess(null)
  }

  return (
    <div className="w-full max-w-sm">
      {/* Logo / branding */}
      <div className="flex justify-center mb-8">
        {branding?.logo_url ? (
          <img
            src={branding.logo_url}
            alt={branding.name}
            className="max-h-12 max-w-[180px] object-contain brightness-0 invert"
          />
        ) : (
          <div className="text-center">
            <p className="text-2xl font-black tracking-tight text-white">
              SwipeUp<span style={{ color: accentColor }}>.</span>
            </p>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mt-0.5">Client Portal</p>
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-8 shadow-2xl">
        {/* Mode tabs */}
        <div className="flex rounded-lg bg-zinc-800 p-1 mb-6">
          <button
            type="button"
            onClick={() => switchMode('signin')}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
              mode === 'signin'
                ? 'bg-zinc-700 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-300'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => switchMode('signup')}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
              mode === 'signup'
                ? 'bg-zinc-700 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-300'
            }`}
          >
            Create account
          </button>
        </div>

        <h1 className="text-xl font-bold text-white mb-1">
          {mode === 'signin' ? 'Welcome back' : 'Get started'}
        </h1>
        <p className="text-sm text-zinc-400 mb-6">
          {mode === 'signin'
            ? `Sign in to ${branding?.name ? branding.name + ' portal' : 'your portal'}`
            : 'Create your portal account'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-300">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-300">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              minLength={mode === 'signup' ? 6 : undefined}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
            />
            {mode === 'signup' && (
              <p className="text-xs text-zinc-500 mt-0.5">Minimum 6 characters</p>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-400 rounded-lg bg-red-950 border border-red-900 px-3 py-2">{error}</p>
          )}
          {success && (
            <p className="text-sm text-emerald-400 rounded-lg bg-emerald-950 border border-emerald-900 px-3 py-2">{success}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
            style={{ backgroundColor: accentColor }}
          >
            {loading
              ? (mode === 'signin' ? 'Signing in…' : 'Creating account…')
              : (mode === 'signin' ? 'Sign in' : 'Create account')
            }
          </button>
        </form>
      </div>

      <p className="text-center text-xs text-zinc-600 mt-6">
        Built by SwipeUp
      </p>
    </div>
  )
}
