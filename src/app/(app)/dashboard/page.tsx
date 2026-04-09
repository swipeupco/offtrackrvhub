'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { isShowComplete, daysUntilStart, parseLocalDate } from '@/lib/date-utils'
import { Tent, Play, Clock, Video, ExternalLink, CheckCircle2, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import Link from 'next/link'
import type { Show, VideoShoot } from '@/types'

interface TrelloCard {
  id: string; name: string; idList: string; url: string
  due: string | null; campaign: string | null
  type: { text: string; color: string } | null
  draftUrl: string | null
}

const LIST_IN_PRODUCTION = '666fee9d24fdad7631ab5c7e'

export default function DashboardPage() {
  const [shows, setShows]   = useState<Show[]>([])
  const [shoots, setShoots] = useState<VideoShoot[]>([])
  const [trelloCards, setTrelloCards] = useState<TrelloCard[]>([])
  const [loading, setLoading] = useState(true)
  const [trelloLoading, setTrelloLoading] = useState(true)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('shows').select('*').order('start_date', { ascending: true }),
      supabase.from('video_shoots').select('*').order('shoot_date', { ascending: true }),
    ]).then(([showsRes, shootsRes]) => {
      setShows((showsRes.data as Show[]) ?? [])
      setShoots((shootsRes.data as VideoShoot[]) ?? [])
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    fetch('/api/trello-board', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => { setTrelloCards(data.cards ?? []); setTrelloLoading(false) })
      .catch(() => setTrelloLoading(false))
  }, [])

  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')

  const upcomingShows = shows.filter(s => !isShowComplete(s.end_date))
  const thisMonthShows = upcomingShows.filter(s => daysUntilStart(s.start_date) <= 30)
  const nextShoot = shoots.find(s => s.shoot_date >= todayStr)
  const nextShow = upcomingShows[0] ?? null

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

  const productionCards = trelloCards.filter(c => c.idList === LIST_IN_PRODUCTION)
  const readyForReview  = productionCards.filter(c => !!c.draftUrl)

  async function handleApprove(cardId: string) {
    setApprovingId(cardId)
    try {
      await fetch('/api/trello-move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, action: 'approve' }),
      })
      // Refresh board data
      const data = await fetch('/api/trello-board', { cache: 'no-store' }).then(r => r.json())
      setTrelloCards(data.cards ?? [])
    } finally {
      setApprovingId(null)
    }
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
      {!loading && nextShow && (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #0d9676 0%, #14C29F 60%, #a7f3e0 100%)' }}>
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

      {/* ── Ready for Review (primary CTA) ── */}
      {!trelloLoading && (
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
            <Link href="/trello" className="text-sm hover:underline" style={{ color: '#14C29F' }}>View pipeline</Link>
          </div>
          {readyForReview.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {readyForReview.map(card => (
                <div key={card.id} className="rounded-2xl bg-white border-2 border-amber-200 p-4 shadow-sm space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-800 leading-snug">{card.name}</p>
                    {card.campaign && <p className="text-xs text-zinc-500 mt-0.5">{card.campaign}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {card.type && (
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white" style={{ backgroundColor: card.type.color }}>
                        {card.type.text}
                      </span>
                    )}
                    {card.due && (
                      <span className="flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium bg-zinc-100 text-zinc-600">
                        <Clock className="h-2.5 w-2.5" />
                        {format(parseLocalDate(card.due.split('T')[0]), 'd MMM')}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={card.draftUrl!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                      style={{ backgroundColor: '#0052CC' }}
                    >
                      <Play className="h-3.5 w-3.5" />
                      Review Draft
                    </a>
                    <button
                      onClick={() => handleApprove(card.id)}
                      disabled={approvingId === card.id}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                      style={{ backgroundColor: '#14C29F' }}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {approvingId === card.id ? 'Approving…' : 'Approve'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl bg-zinc-50 border border-zinc-200 px-6 py-8 text-center">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2" style={{ color: '#14C29F' }} />
              <p className="text-sm font-medium text-zinc-700">Nothing to review right now</p>
              <p className="text-xs text-zinc-400 mt-1">New drafts will appear here when ready</p>
            </div>
          )}
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Upcoming Shows This Month ── */}
        <div className="rounded-2xl bg-white border border-zinc-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Tent className="h-4 w-4 text-zinc-500" />
              <h2 className="font-semibold text-zinc-900 text-sm">Shows This Month</h2>
            </div>
            <Link href="/shows" className="text-xs hover:underline" style={{ color: '#14C29F' }}>All shows</Link>
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
                      <p className="text-[10px] text-zinc-500">
                        {format(parseLocalDate(show.start_date), 'd MMM')}
                      </p>
                      <Badge variant={days <= 7 ? 'warning' : 'info'} className="mt-0.5">
                        {days === 0 ? 'Today' : `${days}d`}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Next Video Shoot ── */}
        <div className="rounded-2xl bg-white border border-zinc-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 text-zinc-500" />
              <h2 className="font-semibold text-zinc-900 text-sm">Next Video Shoot</h2>
            </div>
            <Link href="/shoots" className="text-xs hover:underline" style={{ color: '#14C29F' }}>All shoots</Link>
          </div>
          {nextShoot ? (
            <div className="rounded-xl bg-zinc-50 px-4 py-4 space-y-2">
              <p className="text-sm font-semibold text-zinc-800">{nextShoot.title}</p>
              <div className="flex items-center gap-2">
                <Badge variant={daysUntilStart(nextShoot.shoot_date) <= 7 ? 'warning' : 'info'}>
                  {format(parseLocalDate(nextShoot.shoot_date), 'd MMMM yyyy')}
                </Badge>
                {nextShoot.confirmed && (
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white" style={{ backgroundColor: '#14C29F' }}>
                    Confirmed
                  </span>
                )}
              </div>
              {nextShoot.notes && <p className="text-xs text-zinc-500 leading-relaxed">{nextShoot.notes}</p>}
            </div>
          ) : (
            <p className="text-xs text-zinc-400">No upcoming shoots scheduled.</p>
          )}
        </div>

        {/* ── Creative Pipeline ── */}
        <div className="rounded-2xl bg-white border border-zinc-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-zinc-500" />
              <h2 className="font-semibold text-zinc-900 text-sm">In Production</h2>
            </div>
            <Link href="/trello" className="text-xs hover:underline" style={{ color: '#14C29F' }}>Full pipeline</Link>
          </div>
          {trelloLoading ? (
            <div className="space-y-2">
              {[1,2,3].map(n => <div key={n} className="h-10 rounded-xl bg-zinc-100 animate-pulse" />)}
            </div>
          ) : productionCards.length === 0 ? (
            <p className="text-xs text-zinc-400">Nothing in production right now.</p>
          ) : (
            <div className="space-y-2">
              {productionCards.map(card => (
                <div key={card.id} className="flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2.5 gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-zinc-800 truncate">{card.name}</p>
                    {card.campaign && <p className="text-[10px] text-zinc-500 truncate">{card.campaign}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {card.type && (
                      <span className="rounded-full px-1.5 py-0.5 text-[9px] font-medium text-white" style={{ backgroundColor: card.type.color }}>
                        {card.type.text}
                      </span>
                    )}
                    {card.draftUrl ? (
                      <a href={card.draftUrl} target="_blank" rel="noopener noreferrer"
                        className="rounded-full p-1" style={{ backgroundColor: '#0052CC' }}>
                        <Play className="h-2.5 w-2.5 text-white" />
                      </a>
                    ) : (
                      <a href={card.url} target="_blank" rel="noopener noreferrer" className="text-zinc-300 hover:text-zinc-500">
                        <ExternalLink className="h-3 w-3" />
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
