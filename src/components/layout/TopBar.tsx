'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { User } from 'lucide-react'

export function TopBar() {
  const router = useRouter()
  const [profile, setProfile] = useState<{ name: string | null; avatar_url: string | null } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('name, avatar_url').eq('id', user.id).single()
        .then(({ data }) => setProfile(data))
    })
  }, [])

  return (
    <div className="flex justify-end px-8 py-4">
      <button
        onClick={() => router.push('/settings')}
        className="flex items-center gap-2.5 rounded-xl bg-white border border-zinc-200 px-3 py-2 shadow-sm hover:shadow-md transition-shadow"
      >
        <div className="h-7 w-7 rounded-full bg-zinc-200 overflow-hidden flex items-center justify-center flex-shrink-0">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="avatar" className="h-full w-full object-cover" />
          ) : (
            <User className="h-3.5 w-3.5 text-zinc-400" />
          )}
        </div>
        {profile?.name && (
          <span className="text-xs font-medium text-zinc-700">{profile.name}</span>
        )}
      </button>
    </div>
  )
}
