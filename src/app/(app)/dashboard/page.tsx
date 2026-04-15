'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { isShowComplete, daysUntilStart, parseLocalDate } from '@/lib/date-utils'
import { Tent, Play, Clock, Video, ExternalLink, CheckCircle2, RefreshCw, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import Link from 'next/link'
import type { Show, VideoShoot } from '@/types'

interface Brief {
  id: string
  name: string
  campaign: string | null
  content_type: string | null
  pipeline_status: string
  draft_url: string | null
  due_date: string | null
}

export default function DashboardPage() {
  const [shows, setShows]     = useState<Show[]>([])
  const [shoots, setShoots]   = useState<VideoShoot[]>([])
  const [briefs, setBriefs]   = useState<Brief[]>([])
  const [clientColor, setClientColor] = useState('#14C29F')
  const [hasVans, setHasVans] = useState(false)
  const [loading, setLoading] = useState(true)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles').select('client_id').eq('id', user.id).single()

      if (profile?.client_id) {
        const { data: client } = await supabase
          .from('clients').select('color, has_vans').eq('id', profile.client_id).single()
        if (client?.color) setClientColor(client.color)
        const clientHasVans = client?.has_vans ?? false
        setHasVans(clientHasVans)

        if (clientHasVans) {
          const [showsRes, shootsRes] = await Promise.all([
            supabase.from('shows').select('*').order('start_date', { ascending: true }),
            supabase.from('video_shoots').select('*').order('shoot_date', { ascending: true }),
          ])
          setShows((showsRes.data as Show[]) ?? [])
          setShoots((shootsRes.data as VideoShoot[]) ?? [])
        }

        const { data: briefData } = await supabase
          .from('briefs')
          .select('id, name, campaign, content_type, pipeline_status, draft_url, due_date')
          .eq('client_id', profile.client_id)
          .neq('pipeline_status', 'approved')
          .order('created_at', { ascending: false })
        setBriefs(briefData ?? [])
      } // end if profile.client_id

      setLoading(false)
    }
    load()
  }, [])

  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')

  const upcomingShows   = shows.filter(s => !isShowComplete(s.end_date))
  const thisMonthShows  = upcomingShows.filter(s => daysUntilStart(s.start_date) <= 30)
  const nextShoot       = shoots.find(s => s.shoot_date >= todayStr)
  const nextShow        = upcomingShows[0] ?? null

  const readyForReview  = briefs.filter(b => b.pipeline_status === 'client_review' && b.draft_url)
  const inProduction    = briefs.filter(b => ['backlog', 'in_production', 'qa_review'].includes(b.pipeline_status))

  useEffect(() => {
    if (!nextShow) return
    const target = parseLocalDate(nextShow.start_date).getTime()
    function tick() {
      const diff = target - Date.now()
      if (diff <= 0) { setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 }); return }
      setCountdown({
        days:    Math.floor(diff / 86400000),
        hours:   Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      })
    }
    tick()
    timerRef.current = setInterval(tick, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [nextShow?.start_date])

  async function handleApprove(briefId: string) {
    setApprovingId(briefId)
    const supabase = createClient()
    await supabase
      .from('briefs')
      .update({ pipeline_status: 'approved', internal_status: 'approved_by_client' })
      .eq('id', briefId)
    setBriefs(prev => prev.filter(b => b.id !== briefId))
    setApprovingId(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-zinc-500">Loading…</div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
        <p className="text-zinc-500 mt-1">{format(today, 'EEEE, d MMMM yyyy')}</p>
      </div>

      {/* ── Show Countdown ── */}
      {hasVans && nextShow && (
        <div className="rounded-2xl overflow-hidden" style={{ background: `linear-gradient(135deg, ${clientColor}cc 0%, ${clientColor} 60%, ${clientColor}88 100%)` }}>
          <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-white/70 uppercase tracking-wider flex items-center gap-1.5">
                <Tent className="h-3.5 w-3.5" /> Next Show
              </p>
              <h2 className="text-xl font-bold text-white mt-0.5">{nextShow.name}</h2>
              <p className="text-sm text-white/80 mt-0.5">
                {nextShow.location} · {format(parseLocalDate(nextShow.start_date), 'd MMM yyyy')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {[
                { label: 'Days',    value: countdown.days },
                { label: 'Hours',   value: countdown.hours },
                { label: 'Mins',    value: countdown.minutes },
                { label: 'Secs',    value: countdown.seconds },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col items-center bg-white/20 rounded-xl px-3 py-2 min-w-[52px]">
                  <span className="text-2xl font-bold text-white tabular-nums leading-none">
                    {String(value).padStart(2, '0')}
                  </span>
                  <span className="text-[10px] font-medium text-white/70 mt-0.5">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Ready for Review ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-zinc-900">Ready for Review</h2>
            {readyForReview.length > 0 && (
              <span className="rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5">
                {readyForReview.length} awaiting
              </span>
            )}
          </div>
          <Link href="/trello" className="text-sm hover:underline" style={{ color: clientColor }}>View pipeline</Link>
        </div>
        {readyForReview.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {readyForReview.map(brief => (
              <div key={brief.id} className="rounded-2xl bg-white border-2 border-amber-200 p-4 shadow-sm space-y-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-800 leading-snug">{brief.name}</p>
                  {brief.campaign && <p className="text-xs text-zinc-500 mt-0.5">{brief.campaign}</p>}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {brief.content_type && (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-zinc-100 text-zinc-600">
                      {brief.content_type}
                    </span>
                  )}
                  {brief.due_date && (
                    <span className="flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium bg-zinc-100 text-zinc-600">
                      <Clock className="h-2.5 w-2.5" />
                      {format(new Date(brief.due_date), 'd MMM')}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <a
                    href={brief.draft_url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: clientColor }}
                  >
                    <Play className="h-3.5 w-3.5" />
                    Review Draft
                  </a>
                  <button
                    onClick={() => handleApprove(brief.id)}
                    disabled={approvingId === brief.id}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold bg-green-600 text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {approvingId === brief.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <CheckCircle2 className="h-3.5 w-3.5" />}
                    {approvingId === brief.id ? 'Approving…' : 'Approve'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl bg-zinc-50 border border-zinc-200 px-6 py-8 text-center">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2" style={{ color: clientColor }} />
            <p className="text-sm font-medium text-zinc-700">Nothing to review right now</p>
            <p className="text-xs text-zinc-400 mt-1">New drafts will appear here when ready</p>
          </div>
        )}
      </section>

      <div className={`grid grid-cols-1 gap-6 ${hasVans ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
        {/* ── Upcoming Shows This Month ── */}
        {hasVans && <div className="rounded-2xl bg-white border border-zinc-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Tent className="h-4 w-4 text-zinc-500" />
              <h2 className="font-semibold text-zinc-900 text-sm">Shows This Month</h2>
            </div>
            <Link href="/shows" className="text-xs hover:underline" style={{ color: clientColor }}>All shows</Link>
          </div>
          {thisMonthShows.length === 0 ? (
            <p className="text-xs text-zinc-400">No shows in the next 30 days.</p>
          ) : (
            <div className="space-y-2">
              {thisMonthShows.map(show => {
                const days = daysUntilStart(show.start_date)
                return (
                  <div key={show.id} className="flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2.5">
                    <div>
                      <p className="text-xs font-semibold text-zinc-800">{show.name}</p>
                      <p className="text-[10px] text-zinc-500">{show.location}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-zinc-500">{format(parseLocalDate(show.start_date), 'd MMM')}</p>
                      <Badge variant={days <= 7 ? 'warning' : 'info'} className="mt-0.5">
                        {days === 0 ? 'Today' : `${days}d`}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>}

        {/* ── Next Video Shoot ── */}
        {hasVans && <div className="rounded-2xl bg-white border border-zinc-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 text-zinc-500" />
              <h2 className="font-semibold text-zinc-900 text-sm">Next Video Shoot</h2>
            </div>
            <Link href="/shoots" className="text-xs hover:underline" style={{ color: clientColor }}>All shoots</Link>
          </div>
          {nextShoot ? (
            <div className="rounded-xl bg-zinc-50 px-4 py-4 space-y-2">
              <p className="text-sm font-semibold text-zinc-800">{nextShoot.title}</p>
              <div className="flex items-center gap-2">
                <Badge variant={daysUntilStart(nextShoot.shoot_date) <= 7 ? 'warning' : 'info'}>
                  {format(parseLocalDate(nextShoot.shoot_date), 'd MMMM yyyy')}
                </Badge>
                {nextShoot.confirmed && (
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white" style={{ backgroundColor: clientColor }}>
                    Confirmed
                  </span>
                )}
              </div>
              {nextShoot.notes && <p className="text-xs text-zinc-500 leading-relaxed">{nextShoot.notes}</p>}
            </div>
          ) : (
            <p className="text-xs text-zinc-400">No upcoming shoots scheduled.</p>
          )}
        </div>}

        {/* ── In Production ── */}
        <div className="rounded-2xl bg-white border border-zinc-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-zinc-500" />
              <h2 className="font-semibold text-zinc-900 text-sm">In Production</h2>
            </div>
            <Link href="/trello" className="text-xs hover:underline" style={{ color: clientColor }}>Full pipeline</Link>
          </div>
          {inProduction.length === 0 ? (
            <p className="text-xs text-zinc-400">Nothing in production right now.</p>
          ) : (
            <div className="space-y-2">
              {inProduction.map(brief => (
                <div key={brief.id} className="flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2.5 gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-zinc-800 truncate">{brief.name}</p>
                    {brief.campaign && <p className="text-[10px] text-zinc-500 truncate">{brief.campaign}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {brief.content_type && (
                      <span className="rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-zinc-200 text-zinc-600">
                        {brief.content_type}
                      </span>
                    )}
                    {brief.draft_url && (
                      <a href={brief.draft_url} target="_blank" rel="noopener noreferrer"
                        className="rounded-full p-1 text-white" style={{ backgroundColor: clientColor }}>
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
