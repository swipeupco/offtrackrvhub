'use client'
export const dynamic = 'force-dynamic'
import { useActiveClient } from '@/lib/active-client-context'
import { Layers } from 'lucide-react'

export default function CampaignsPage() {
  const { clientConfig } = useActiveClient()
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-zinc-900 mb-2">Campaigns</h1>
      <p className="text-zinc-500">Track your active and upcoming campaigns.</p>
      <div className="mt-12 flex flex-col items-center justify-center text-center">
        <div className="h-14 w-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: `${clientConfig.color}15` }}>
          <Layers className="h-7 w-7" style={{ color: clientConfig.color }} />
        </div>
        <p className="text-sm font-medium text-zinc-700">Campaigns coming soon</p>
        <p className="text-xs text-zinc-400 mt-1">This feature is being built for you</p>
      </div>
    </div>
  )
}
