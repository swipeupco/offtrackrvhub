'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Invalid email or password.')
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="flex justify-center mb-8">
        <Image
          src="https://www.offtrackrv.com.au/content/images/off-track-rv-logo.svg"
          alt="Off Track RV"
          width={160}
          height={48}
          className="brightness-0 invert object-contain"
          unoptimized
        />
      </div>

      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-8 shadow-2xl">
        <h1 className="text-xl font-bold text-white mb-1">Welcome back</h1>
        <p className="text-sm text-zinc-400 mb-6">Sign in to your Command Centre</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-300">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@offtrackrv.com.au"
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#14C29F] focus:outline-none focus:ring-2 focus:ring-[#14C29F]/20"
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
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#14C29F] focus:outline-none focus:ring-2 focus:ring-[#14C29F]/20"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 rounded-lg bg-red-950 border border-red-900 px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
            style={{ backgroundColor: '#14C29F' }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>

      <p className="text-center text-xs text-zinc-600 mt-6">
        Built by SwipeUp · Internal use only
      </p>
    </div>
  )
}
