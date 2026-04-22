'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

export default function SignupPage() {
  const [businessName, setBusinessName] = useState('')
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!businessName.trim() || !email.trim() || password.length < 8) {
      setError('Enter a business name, email, and at least 8 characters for the password.')
      return
    }
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { business_name: businessName.trim() },
        emailRedirectTo: 'https://portal.swipeupco.com/auth/callback?next=/onboarding',
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    // If email confirmation is disabled the user is already logged in;
    // redirect straight to onboarding. Otherwise display "Check your inbox".
    router.push('/onboarding')
    router.refresh()
  }

  return (
    <div className="w-full max-w-sm">
      <div className="flex justify-center mb-8">
        <Image src="/SwipeUp_White.svg" alt="SwipeUp" width={160} height={39} priority />
      </div>

      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-8 shadow-2xl">
        <h1 className="text-xl font-bold text-white mb-1">Create your portal</h1>
        <p className="text-sm text-zinc-400 mb-6">Start a free SwipeUp portal for your business.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-300">Business name</label>
            <input
              type="text"
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
              required
              placeholder="Your business"
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#4950F8] focus:outline-none focus:ring-2 focus:ring-[#4950F8]/20"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-300">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#4950F8] focus:outline-none focus:ring-2 focus:ring-[#4950F8]/20"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-300">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="At least 8 characters"
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#4950F8] focus:outline-none focus:ring-2 focus:ring-[#4950F8]/20"
            />
          </div>
          {error && (
            <p className="text-sm text-red-400 rounded-lg bg-red-950 border border-red-900 px-3 py-2">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="group relative w-full overflow-hidden rounded-lg px-4 py-3 text-sm font-semibold text-white transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed hover:-translate-y-0.5"
            style={{
              background: 'linear-gradient(135deg, rgba(73, 80, 248, 0.95) 0%, rgba(73, 80, 248, 0.75) 50%, rgba(55, 62, 220, 0.9) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              boxShadow: '0 10px 30px rgba(73, 80, 248, 0.5), 0 4px 12px rgba(73, 80, 248, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
            }}
          >
            <span className="relative z-10 drop-shadow-sm pointer-events-none">
              {loading ? 'Creating account…' : 'Create account'}
            </span>
          </button>
        </form>

        <p className="text-xs text-zinc-500 text-center mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-zinc-300 hover:text-white font-medium">Log in</Link>
        </p>
      </div>
    </div>
  )
}
