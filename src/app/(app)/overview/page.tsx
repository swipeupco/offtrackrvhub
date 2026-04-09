'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO, getMonth, eachMonthOfInterval, startOfYear, endOfYear, isWithinInterval, isSameMonth } from 'date-fns'
import { Tent, Video, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'
import type { Show, MarketingTask, VideoShoot } from '@/types'

const MONTHS = eachMonthOfInterval({ start: startOfYear(new Date()), end: endOfYear(new Date()) })

const BRAND_COLORS: Record<string, string> = {
  Vacationer: '#14C29F',
  Radiant:    '#f59e0b',
  Atlas:      '#6366f1',
  OzVenture:  '#ec4899',
}

export default function OverviewPage() {
  const [shows, setShows]   = useState<Show[]>([])
  const [tasks, setTasks]   = useState<MarketingTask[]>([])
  const [shoots, setShoots] = useState<VideoShoot[]>([])
  const [loading, setLoading] = useState(true)
  const [year, setYear]       = useState(new Date().getFullYear())

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('shows').select('*'),
      supabase.from('marketing_tasks').select('*'),
      supabase.from('video_shoots').select('*'),
    ]).then(([s, t, sh]) => {
      setShows((s.data as Show[]) ?? [])
      setTasks((t.data as MarketingTask[]) ?? [])
      setShoots((sh.data as VideoShoot[]) ?? [])
      setLoading(false)
    })
  }, [])

  const yearShows  = shows.filter(s => parseISO(s.start_date).getFullYear() === year || parseISO(s.end_date).getFullYear() === year)
  const yearShoots = shoots.filter(s => parseISO(s.shoot_date).getFullYear() === year)

  // Stats
  const doneTasks    = tasks.filter(t => t.status === 'done').length
  const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'urgent').length

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Annual Overview</h1>
          <p className="text-zinc-500 mt-1">Year-at-a-glance for shows, shoots, and deliverables</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setYear(y => y - 1)} className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 border border-zinc-300 hover:bg-zinc-100">← {year - 1}</button>
          <span className="text-lg font-bold text-zinc-900 px-2">{year}</span>
          <button onClick={() => setYear(y => y + 1)} className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 border border-zinc-300 hover:bg-zinc-100">{year + 1} →</button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Shows This Year',    value: yearShows.length,   icon: Tent,         color: '#14C29F' },
          { label: 'Video Shoots',       value: yearShoots.length,  icon: Video,        color: '#6366f1' },
          { label: 'Tasks Complete',     value: doneTasks,          icon: CheckCircle2, color: '#14C29F' },
          { label: 'Tasks Pending',      value: pendingTasks,       icon: Clock,        color: '#f59e0b' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl bg-white border border-zinc-200 p-5 shadow-sm">
            <div className="inline-flex items-center justify-center rounded-xl p-2 bg-zinc-100" style={{ color }}>
              <Icon className="h-5 w-5" />
            </div>
            <p className="mt-3 text-3xl font-bold text-zinc-900">{value}</p>
            <p className="mt-0.5 text-sm text-zinc-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Year timeline */}
      {loading ? (
        <div className="h-96 rounded-2xl bg-zinc-100 animate-pulse" />
      ) : (
        <div className="rounded-2xl bg-white border border-zinc-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-200">
            <h2 className="font-semibold text-zinc-900">Year Timeline — {year}</h2>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[900px] p-6 space-y-6">
              {/* Month columns */}
              <div className="grid grid-cols-12 gap-2">
                {MONTHS.map((month, idx) => (
                  <div key={idx} className="text-center text-xs font-semibold text-zinc-500 uppercase">
                    {format(month, 'MMM')}
                  </div>
                ))}
              </div>

              {/* Shows row */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Tent className="h-4 w-4 text-zinc-400" />
                  <span className="text-xs font-semibold text-zinc-500 uppercase">Shows</span>
                </div>
                <div className="grid grid-cols-12 gap-2">
                  {MONTHS.map((month, idx) => {
                    const monthShows = yearShows.filter(s =>
                      isSameMonth(parseISO(s.start_date), month) ||
                      isSameMonth(parseISO(s.end_date), month) ||
                      isWithinInterval(month, { start: parseISO(s.start_date), end: parseISO(s.end_date) })
                    )
                    return (
                      <div key={idx} className="min-h-[60px] rounded-xl bg-zinc-50 border border-zinc-200 p-1.5 space-y-1">
                        {monthShows.map(show => (
                          <div
                            key={show.id}
                            className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white truncate"
                            style={{ backgroundColor: BRAND_COLORS[show.brands[0]] ?? '#14C29F' }}
                            title={show.name}
                          >
                            {show.name.split(' ').slice(0, 2).join(' ')}
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Video Shoots row */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Video className="h-4 w-4 text-zinc-400" />
                  <span className="text-xs font-semibold text-zinc-500 uppercase">Video Shoots</span>
                </div>
                <div className="grid grid-cols-12 gap-2">
                  {MONTHS.map((month, idx) => {
                    const monthShoots = yearShoots.filter(s => isSameMonth(parseISO(s.shoot_date), month))
                    return (
                      <div key={idx} className="min-h-[60px] rounded-xl bg-zinc-50 border border-zinc-200 p-1.5 space-y-1">
                        {monthShoots.map(shoot => (
                          <div
                            key={shoot.id}
                            className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white truncate"
                            style={{ backgroundColor: shoot.confirmed ? '#6366f1' : '#94a3b8' }}
                            title={shoot.title}
                          >
                            {shoot.title}
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Task load heatmap */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-zinc-400" />
                  <span className="text-xs font-semibold text-zinc-500 uppercase">Marketing Task Load</span>
                </div>
                <div className="grid grid-cols-12 gap-2">
                  {MONTHS.map((month, idx) => {
                    const monthTasks = tasks.filter(t => isSameMonth(parseISO(t.due_date), month))
                    const urgentCount = monthTasks.filter(t => t.status === 'urgent').length
                    const total = monthTasks.length
                    const opacity = Math.min(total / 10, 1)
                    return (
                      <div
                        key={idx}
                        className="min-h-[60px] rounded-xl border border-zinc-200 flex flex-col items-center justify-center text-center p-2"
                        style={{ backgroundColor: total > 0 ? `rgba(20,194,159,${0.1 + opacity * 0.5})` : '#f9fafb' }}
                        title={`${total} tasks due`}
                      >
                        {total > 0 && (
                          <>
                            <span className="text-lg font-bold" style={{ color: '#14C29F' }}>{total}</span>
                            <span className="text-[10px] text-zinc-500">tasks</span>
                            {urgentCount > 0 && <span className="text-[10px] text-red-500">{urgentCount} urgent</span>}
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 px-6 py-3 border-t border-zinc-100 bg-zinc-50 flex-wrap">
            {Object.entries(BRAND_COLORS).map(([brand, color]) => (
              <div key={brand} className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
                <span className="text-xs text-zinc-500">{brand}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-sm bg-indigo-500" />
              <span className="text-xs text-zinc-500">Shoot (confirmed)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-sm bg-slate-400" />
              <span className="text-xs text-zinc-500">Shoot (pending)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
