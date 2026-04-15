'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MarketingCalendar } from '@/components/calendar/MarketingCalendar'
import type { Show, MarketingTask, DeliverablesConfig } from '@/types'

export default function SharedCalendarPage({ params }: { params: { token: string } }) {
  const [valid, setValid]   = useState<boolean | null>(null)
  const [shows, setShows]   = useState<Show[]>([])
  const [tasks, setTasks]   = useState<MarketingTask[]>([])
  const [_configs, setConfigs] = useState<DeliverablesConfig[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Verify token
    fetch(`/api/shared-link?token=${params.token}`)
      .then(r => r.json())
      .then(async data => {
        if (!data.valid) { setValid(false); setLoading(false); return }
        setValid(true)
        const supabase = createClient()
        const [showsRes, tasksRes, configsRes] = await Promise.all([
          supabase.from('shows').select('*').order('start_date', { ascending: true }),
          supabase.from('marketing_tasks').select('*'),
          supabase.from('deliverables_config').select('*'),
        ])
        setShows((showsRes.data as Show[]) ?? [])
        setTasks((tasksRes.data as MarketingTask[]) ?? [])
        setConfigs((configsRes.data as DeliverablesConfig[]) ?? [])
        setLoading(false)
      })
      .catch(() => { setValid(false); setLoading(false) })
  }, [params.token])

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="animate-pulse text-zinc-400 text-sm">Loading calendar…</div>
      </div>
    )
  }

  if (!valid) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-lg font-semibold text-zinc-800">Link not found</p>
          <p className="text-sm text-zinc-500 mt-1">This calendar link is invalid or has expired.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Minimal header */}
      <div className="bg-black px-6 py-3 flex items-center justify-between">
        <span className="text-lg font-black tracking-tight text-white">
          SwipeUp<span className="text-[#14C29F]">.</span>
        </span>
        <span className="text-xs text-zinc-500">Marketing Calendar · View Only</span>
      </div>
      <div className="p-6">
        <MarketingCalendar shows={shows} tasks={tasks} onEditShow={() => {}} />
      </div>
    </div>
  )
}
