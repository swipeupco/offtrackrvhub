'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Camera, User, Check, X } from 'lucide-react'

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const [checking, setChecking]   = useState(true)
  const [show, setShow]           = useState(false)
  const [name, setName]           = useState('')
  const [role, setRole]           = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setChecking(false); return }
      supabase.from('profiles').select('onboarding_complete').eq('id', user.id).single().then(({ data }) => {
        if (!data || !data.onboarding_complete) setShow(true)
        setChecking(false)
      })
    })
  }, [])

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setAvatarUrl(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function handleComplete() {
    if (!name.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('profiles').upsert({
      id: user.id, name, role, avatar_url: avatarUrl, onboarding_complete: true,
    })
    setShow(false)
    setSaving(false)
  }

  if (checking) return null

  return (
    <>
      {children}
      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="px-8 pt-8 pb-6 space-y-6">
              <div className="relative text-center">
                <button
                  onClick={() => setShow(false)}
                  className="absolute -top-2 -right-2 text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
                <h2 className="text-xl font-bold text-zinc-900">Welcome! Let's set up your profile</h2>
                <p className="text-sm text-zinc-500 mt-1">This only takes a moment</p>
              </div>

              {/* Avatar */}
              <div className="flex justify-center">
                <div className="relative">
                  <div className="h-20 w-20 rounded-full bg-zinc-200 overflow-hidden flex items-center justify-center">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-9 w-9 text-zinc-400" />
                    )}
                  </div>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 text-white hover:bg-zinc-700 transition-colors"
                  >
                    <Camera className="h-3.5 w-3.5" />
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Full Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#14C29F]/40 focus:border-[#14C29F]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Role</label>
                  <input
                    type="text"
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    placeholder="e.g. Marketing Manager"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#14C29F]/40 focus:border-[#14C29F]"
                  />
                </div>
              </div>

              <button
                onClick={handleComplete}
                disabled={saving || !name.trim()}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#14C29F' }}
              >
                <Check className="h-4 w-4" />
                {saving ? 'Saving…' : 'Get Started'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
