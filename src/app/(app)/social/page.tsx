'use client'

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'

const InstagramSvg = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
)

const TikTokSvg = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
  </svg>
)

const FacebookSvg = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
)

const YouTubeSvg = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
)

interface Platform {
  id: string
  name: string
  IconComponent: React.ComponentType<{ className?: string }>
  color: string
  bg: string
  connected: boolean
  handle: string | null
  followers: number | null
}

const PLATFORMS: Platform[] = [
  { id: 'instagram', name: 'Instagram', IconComponent: InstagramSvg, color: 'text-pink-600',  bg: 'bg-pink-50',  connected: false, handle: null, followers: null },
  { id: 'tiktok',    name: 'TikTok',    IconComponent: TikTokSvg,    color: 'text-zinc-800',  bg: 'bg-zinc-100', connected: false, handle: null, followers: null },
  { id: 'facebook',  name: 'Facebook',  IconComponent: FacebookSvg,  color: 'text-blue-600',  bg: 'bg-blue-50',  connected: false, handle: null, followers: null },
  { id: 'youtube',   name: 'YouTube',   IconComponent: YouTubeSvg,   color: 'text-red-600',   bg: 'bg-red-50',   connected: false, handle: null, followers: null },
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

      {connected.length > 0 && (
        <div className="mb-6 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Connected</p>
          {connected.map(p => {
            const { IconComponent } = p
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-zinc-200 p-4 flex items-center gap-4">
                <div className={`h-10 w-10 rounded-xl ${p.bg} flex items-center justify-center flex-shrink-0`}>
                  <IconComponent className={`h-5 w-5 ${p.color}`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-zinc-900">{p.name}</p>
                  {p.handle && <p className="text-xs text-zinc-500">@{p.handle}</p>}
                </div>
                <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
              </div>
            )
          })}
        </div>
      )}

      {notConnected.length > 0 && (
        <div className="space-y-3">
          {connected.length > 0 && (
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Available</p>
          )}
          {notConnected.map(p => {
            const { IconComponent } = p
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-zinc-200 p-4 flex items-center gap-4">
                <div className={`h-10 w-10 rounded-xl ${p.bg} flex items-center justify-center flex-shrink-0`}>
                  <IconComponent className={`h-5 w-5 ${p.color}`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-zinc-900">{p.name}</p>
                  <input
                    type="text"
                    placeholder={`@${p.name.toLowerCase()} handle`}
                    value={handles[p.id] || ''}
                    onChange={e => setHandles(prev => ({ ...prev, [p.id]: e.target.value }))}
                    className="mt-1 text-xs text-zinc-500 bg-transparent border-none outline-none placeholder-zinc-300 w-full"
                  />
                </div>
                <button
                  onClick={() => handleConnect(p.id)}
                  disabled={connecting === p.id}
                  className="shrink-0 rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-50"
                >
                  {connecting === p.id ? 'Connecting…' : 'Connect'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
