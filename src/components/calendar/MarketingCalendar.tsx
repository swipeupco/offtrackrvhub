'use client'

import { useState } from 'react'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isToday, isSameDay, addMonths, subMonths,
  parseISO, isWithinInterval, startOfWeek, endOfWeek,
  isWithinInterval as inInterval,
} from 'date-fns'
import { ChevronLeft, ChevronRight, CalendarDays, Sun } from 'lucide-react'
import { parseLocalDate } from '@/lib/date-utils'
import type { Show, MarketingTask } from '@/types'

// ── Per-show colour palette (cycles if > 8 shows) ────────────────────────────
const PALETTES = [
  { bg: '#e0f2fe', text: '#0369a1', border: '#7dd3fc' }, // sky
  { bg: '#ede9fe', text: '#6d28d9', border: '#c4b5fd' }, // violet
  { bg: '#dcfce7', text: '#166534', border: '#86efac' }, // green
  { bg: '#fce7f3', text: '#9d174d', border: '#f9a8d4' }, // pink
  { bg: '#ffedd5', text: '#9a3412', border: '#fdba74' }, // orange
  { bg: '#e0f7fa', text: '#00695c', border: '#80cbc4' }, // teal
  { bg: '#fef9c3', text: '#854d0e', border: '#fde047' }, // yellow
  { bg: '#f3e8ff', text: '#7e22ce', border: '#d8b4fe' }, // purple
]

function paletteFor(showId: string, shows: Show[]) {
  const idx = shows.findIndex((s) => s.id === showId)
  return PALETTES[idx % PALETTES.length]
}

interface Props {
  shows: Show[]
  tasks: MarketingTask[]
  onEditShow: (show: Show) => void
  onClickTask?: (show: Show, task: MarketingTask) => void
}

type DayEvent =
  | { type: 'show'; show: Show }
  | { type: 'task'; task: MarketingTask; show: Show | undefined }

export function MarketingCalendar({ shows, tasks, onEditShow, onClickTask }: Props) {
  const [current, setCurrent] = useState(new Date())
  const today = new Date()

  const monthStart = startOfMonth(current)
  const monthEnd   = endOfMonth(current)

  // Pad to full weeks (Sun start)
  const startPad = monthStart.getDay()
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const paddedBefore = Array.from({ length: startPad }, (_, i) => {
    const d = new Date(monthStart)
    d.setDate(d.getDate() - (startPad - i))
    return d
  })
  const allDays = [...paddedBefore, ...days]
  while (allDays.length < 42) {
    const last = allDays[allDays.length - 1]
    const next = new Date(last)
    next.setDate(next.getDate() + 1)
    allDays.push(next)
  }

  function eventsForDay(day: Date): DayEvent[] {
    const events: DayEvent[] = []
    shows.forEach((show) => {
      if (isWithinInterval(day, { start: parseLocalDate(show.start_date), end: parseLocalDate(show.end_date) })) {
        events.push({ type: 'show', show })
      }
    })
    tasks.forEach((task) => {
      if (isSameDay(day, parseLocalDate(task.due_date))) {
        const show = shows.find((s) => s.id === task.show_id)
        events.push({ type: 'task', task, show })
      }
    })
    return events
  }

  // ── Today tasks ───────────────────────────────────────────────────────────
  const todayTasks = tasks.filter((t) => isSameDay(parseLocalDate(t.due_date), today) && t.status !== 'done')

  // ── This week tasks (Mon–Sun) ─────────────────────────────────────────────
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })
  const weekEnd   = endOfWeek(today, { weekStartsOn: 1 })
  const weekTasks = tasks.filter(
    (t) =>
      t.status !== 'done' &&
      inInterval(parseLocalDate(t.due_date), { start: weekStart, end: weekEnd }) &&
      !isSameDay(parseLocalDate(t.due_date), today)
  )

  return (
    <div className="space-y-4">
      {/* ── Today + This Week panels ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Today */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sun className="h-4 w-4 text-orange-500" />
            <h3 className="font-semibold text-slate-900 text-sm">Today</h3>
            <span className="text-xs text-slate-400">{format(today, 'd MMM')}</span>
          </div>
          {todayTasks.length === 0 ? (
            <p className="text-xs text-slate-400">Nothing due today.</p>
          ) : (
            <div className="space-y-1.5">
              {todayTasks.map((task) => {
                const show = shows.find((s) => s.id === task.show_id)
                const palette = show ? paletteFor(show.id, shows) : { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' }
                return (
                  <div
                    key={task.id}
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium"
                    style={{ background: palette.bg, color: palette.text }}
                  >
                    <span>{task.task_name}</span>
                    {show && <span className="opacity-70 truncate ml-2 max-w-[120px]">{show.name}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* This Week */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="h-4 w-4 text-blue-500" />
            <h3 className="font-semibold text-slate-900 text-sm">This Week</h3>
            <span className="text-xs text-slate-400">
              {format(weekStart, 'd MMM')} – {format(weekEnd, 'd MMM')}
            </span>
          </div>
          {weekTasks.length === 0 ? (
            <p className="text-xs text-slate-400">No other tasks this week.</p>
          ) : (
            <div className="space-y-1.5">
              {weekTasks.map((task) => {
                const show = shows.find((s) => s.id === task.show_id)
                const palette = show ? paletteFor(show.id, shows) : { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' }
                return (
                  <div
                    key={task.id}
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium"
                    style={{ background: palette.bg, color: palette.text }}
                  >
                    <span>{task.task_name}</span>
                    <span className="opacity-70 truncate ml-2 max-w-[120px]">
                      {show?.name} · {format(parseLocalDate(task.due_date), 'EEE d')}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Calendar grid ────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">{format(current, 'MMMM yyyy')}</h2>
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrent((c) => subMonths(c, 1))} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setCurrent(new Date())} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
              Today
            </button>
            <button onClick={() => setCurrent((c) => addMonths(c, 1))} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Show colour legend — only shows visible this month */}
        {(() => {
          const monthShows = shows.filter(show =>
            isWithinInterval(parseLocalDate(show.start_date), { start: monthStart, end: monthEnd }) ||
            isWithinInterval(parseLocalDate(show.end_date), { start: monthStart, end: monthEnd }) ||
            (parseLocalDate(show.start_date) <= monthStart && parseLocalDate(show.end_date) >= monthEnd)
          )
          return monthShows.length > 0 ? (
            <div className="flex flex-wrap items-center gap-3 px-6 py-2.5 border-b border-slate-100 bg-slate-50">
              {monthShows.map((show) => {
                const p = paletteFor(show.id, shows)
                return (
                  <div key={show.id} className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-sm" style={{ background: p.border }} />
                    <span className="text-xs text-slate-600">{show.name}</span>
                  </div>
                )
              })}
            </div>
          ) : null
        })()}

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-slate-200">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="px-3 py-2 text-center text-xs font-medium text-slate-500">{d}</div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7">
          {allDays.map((day, idx) => {
            const inMonth = isSameMonth(day, current)
            const todayCell = isToday(day)
            const events = eventsForDay(day)

            return (
              <div
                key={idx}
                className={`min-h-[96px] p-2 border-b border-r border-slate-100 ${!inMonth ? 'bg-slate-50/60' : ''} ${idx % 7 === 6 ? 'border-r-0' : ''}`}
              >
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                  todayCell ? 'bg-orange-500 text-white' : inMonth ? 'text-slate-700' : 'text-slate-300'
                }`}>
                  {format(day, 'd')}
                </span>

                <div className="mt-1 space-y-0.5">
                  {events.slice(0, 4).map((ev, evIdx) => {
                    if (ev.type === 'show') {
                      const p = paletteFor(ev.show.id, shows)
                      return (
                        <button
                          key={evIdx}
                          onClick={() => onEditShow(ev.show)}
                          className="w-full truncate rounded px-1.5 py-0.5 text-[10px] font-semibold text-left transition-opacity hover:opacity-80 cursor-pointer"
                          style={{ background: p.bg, color: p.text, borderLeft: `3px solid ${p.border}` }}
                          title={`Edit: ${ev.show.name}`}
                        >
                          {ev.show.name}
                        </button>
                      )
                    } else {
                      const show = ev.show
                      const p = show
                        ? paletteFor(show.id, shows)
                        : { bg: '#f1f5f9', text: '#64748b', border: '#94a3b8' }
                      const isUrgent = ev.task.status === 'urgent'
                      const isDone   = ev.task.status === 'done'
                      return (
                        <button
                          key={evIdx}
                          onClick={() => show && onClickTask && onClickTask(show, ev.task)}
                          className="w-full text-left truncate rounded px-1.5 py-0.5 text-[10px] font-medium hover:opacity-75 transition-opacity"
                          style={
                            isDone
                              ? { background: '#dcfce7', color: '#166534' }
                              : isUrgent
                              ? { background: '#fee2e2', color: '#991b1b' }
                              : { background: p.bg, color: p.text }
                          }
                          title={`${ev.task.task_name}${show ? ` – ${show.name}` : ''} · Click to open brief`}
                        >
                          ✦ {ev.task.task_name}
                          {show && <span className="opacity-60 ml-1">({show.name.split(' ')[0]})</span>}
                        </button>
                      )
                    }
                  })}
                  {events.length > 4 && (
                    <p className="text-[10px] text-slate-400 px-1">+{events.length - 4} more</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
