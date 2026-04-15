'use client'

import { useState } from 'react'
import { BarChart2, CheckCircle2 } from 'lucide-react'

interface Platform {
  id: string
  name: string
  icon: React.ElementType
  color: string
  bg: string
  connected: boolean
  handle: string | null
  followers: number | null
}

const PLATFORMS: Platform[] = [
  { id: 'instagram', name: 'Instagram', icon: BarChart2, color: 'text-pink-600',  bg: 'bg-pink-50',  connected: false, handle: null, followers: null },
  { id: 'tiktok',    name: 'TikTok',   icon: BarChart2, color: 'text-zinc-800',  bg: 'bg-zinc-100', connected: false, handle: null, followers: null },
  { id: 'facebook',  name: 'Facebook', icon: BarChart2, color: 'text-blue-600',  bg: 'bg-blue-50',  connected: false, handle: null, followers: null },
  { id: 'youtube',   name: 'YouTube',  icon: BarChart2, color: 'text-red-600',   bg: 'bg-red-50',   connected: false, handle: null, followers: null },
]

export default function SocialPage() {
  const [platforms, setPlatforms] = useState<Platform[]>(PLATFORMS)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [handles, setHandles] = useState<Record<string, string>>({})

  async function handleConnect(id: string) {
    setConnecting(id)
    await new Promise(r => setTimeout(r, 800))
    setPlatforms(prev => prev.map(p =>
      p.id === id ? { ...p, connected: true, handle: handles[id] || null } : p
    ))
    setConnecting(null)
  }

  const connected = platforms.filter(p => p.connected)
  const notConnected = platforms.filter(p => !p.connected)

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Social</h1>
        <p className="text-sm text-zinc-500 mt-1">Connect your social accounts to track followers, reach and engagement</p>
      </div>

      {/* Connected platforms */}
      {connected.length > 0 && (
        <div className="mb-6 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Connected</p>
          {connected.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-zinc-200 p-4 flex items-center gap-4">
              <div className={`h-10 w-10 rounded-xl ${p.bg} flex items-center justify-center flex-shrink-0`}>
                <p.icon className={`h-5 w-5 ${p.color}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-zinc-800">{p.name}</p>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </div>
                {p.handle && <p className="text-xs text-zinc-400">@{p.handle}</p>}
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-zinc-900">{p.followers ?? '—'}</p>
                <p className="text-[10px] text-zinc-400">followers</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Not connected */}
      {notConnected.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Connect a platform</p>
          {notConnected.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-zinc-200 p-4">
              <div className="flex items-center gap-4">
                <div className={`h-10 w-10 rounded-xl ${p.bg} flex items-center justify-center flex-shrink-0`}>
                  <p.icon className={`h-5 w-5 ${p.color}`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-zinc-800">{p.name}</p>
                  <input
                    type="text"
                    value={handles[p.id] ?? ''}
                    onChange={e => setHandles(prev => ({ ...prev, [p.id]: e.target.value }))}
                    placeholder={`Your ${p.name} handle`}
                    className="mt-1.5 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-[#14C29F]/30 focus:border-[#14C29F]"
                  />
                </div>
                <button
                  onClick={() => handleConnect(p.id)}
                  disabled={connecting === p.id || !handles[p.id]?.trim()}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-white bg-[#14C29F] disabled:opacity-40 hover:opacity-90 transition-opacity whitespace-nowrap"
                >
                  {connecting === p.id ? 'Connecting…' : 'Connect'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-zinc-400 text-center mt-8">
        Full API integration with live follower counts and post analytics coming soon
      </p>
    </div>
  )
}
