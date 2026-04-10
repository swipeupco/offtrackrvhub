'use client'

import { format, parseISO, isPast } from 'date-fns'
import { X, CheckCircle2, Circle, Send, AlertTriangle, LayoutKanban } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { MarketingTask, Show, TaskStatus } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { useState, useEffect } from 'react'

// ── Status config ─────────────────────────────────────────────────────────────
type ManualStatus = 'pending' | 'in_progress' | 'done'

const STATUS_BUTTONS: { value: ManualStatus; label: string; icon: React.ElementType }[] = [
  { value: 'pending',     label: 'Backlog',        icon: Circle },
  { value: 'in_progress', label: 'In Production',  icon: Send },
  { value: 'done',        label: 'Complete',        icon: CheckCircle2 },
]

const statusDisplay: Record<TaskStatus, { label: string; badge: 'default' | 'warning' | 'danger' | 'success' | 'info' }> = {
  pending:     { label: 'Backlog',        badge: 'default' },
  urgent:      { label: 'Urgent',         badge: 'danger' },
  in_progress: { label: 'In Production',  badge: 'info' },
  done:        { label: 'Complete',       badge: 'success' },
}

// Pipeline status label from Supabase brief status
const PIPELINE_LABELS: Record<string, string> = {
  backlog:       'Backlog',
  in_production: 'In Production',
  approved:      'Approved',
}

// ── Brief generator ───────────────────────────────────────────────────────────
function generateBrief(task: MarketingTask, show: Show): string {
  const site   = show.site_number?.trim() || 'Missing'
  const brands = show.brands.length ? show.brands.join(', ') : 'Missing'
  const start  = format(parseISO(show.start_date), 'd MMM yyyy')
  const end    = format(parseISO(show.end_date), 'd MMM yyyy')
  const due    = format(parseISO(task.due_date), 'd MMM yyyy')

  return `Brief: ${task.task_name} for ${show.name}.

Site Number: ${site}
Show Dates: ${start} – ${end}
Location: ${show.location}
Brands: ${brands}
Due: ${due}`
}

// ── Card name builder ─────────────────────────────────────────────────────────
function buildCardName(task: MarketingTask, show: Show): string {
  // Use show.location as the prefix (e.g. "Batemans Bay")
  const location = show.location?.trim() || show.name.split(' ').slice(0, 2).join(' ')
  return `${location} ${task.task_name}`
}

// ── Push brief to Creative Pipeline (Supabase) ────────────────────────────────
async function pushBriefToPipeline(task: MarketingTask, show: Show, brief: string): Promise<string | null> {
  try {
    const res = await fetch('/api/trello-brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: buildCardName(task, show),
        desc: brief,
        campaign: show.location,
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.cardId ?? null
  } catch { return null }
}

interface Props {
  show: Show | null
  tasks: MarketingTask[]
  onClose: () => void
  onTasksChange: () => void
}

export function TaskDrawer({ show, tasks, onClose, onTasksChange }: Props) {
  const [updating, setUpdating]         = useState<string | null>(null)
  const [sendingAll, setSendingAll]     = useState(false)
  const [sendingOne, setSendingOne]     = useState<string | null>(null)
  const [sentCount, setSentCount]       = useState(0)
  const [briefs, setBriefs]             = useState<Record<string, string>>({})
  const [pipelineStatus, setPipelineStatus] = useState<Record<string, string>>({}) // briefId → status

  // Initialise briefs text + fetch pipeline statuses for linked cards
  useEffect(() => {
    if (!show) return
    const s = show
    const initial: Record<string, string> = {}
    tasks.forEach((t) => { initial[t.id] = generateBrief(t, s) })
    setBriefs(initial)
    setSentCount(0)

    // Fetch current pipeline status for any linked briefs
    const linkedIds = tasks.filter(t => t.trello_card_id).map(t => t.trello_card_id!)
    if (linkedIds.length === 0) return

    const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const ids = linkedIds.map(id => `"${id}"`).join(',')

    fetch(`${SUPA_URL}/rest/v1/briefs?select=id,status&id=in.(${ids})`, {
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
    })
      .then(r => r.json())
      .then((rows: { id: string; status: string }[]) => {
        const map: Record<string, string> = {}
        rows.forEach(r => { map[r.id] = r.status })
        setPipelineStatus(map)
      })
      .catch(() => {})
  }, [show?.id, tasks.length])

  if (!show) return null

  const sorted = [...tasks].sort((a, b) => a.due_date.localeCompare(b.due_date))

  async function updateStatus(taskId: string, status: TaskStatus) {
    setUpdating(taskId)
    const supabase = createClient()
    await supabase.from('marketing_tasks').update({ status }).eq('id', taskId)
    onTasksChange()
    setUpdating(null)
  }

  // ── Send single brief to pipeline ─────────────────────────────────────────
  async function handleSendOne(task: MarketingTask) {
    setSendingOne(task.id)
    const supabase = createClient()
    const brief = briefs[task.id] ?? generateBrief(task, show!)
    const briefId = await pushBriefToPipeline(task, show!, brief)
    await supabase
      .from('marketing_tasks')
      .update({ status: 'in_progress', ...(briefId ? { trello_card_id: briefId } : {}) })
      .eq('id', task.id)
    if (briefId) setPipelineStatus(prev => ({ ...prev, [briefId]: 'backlog' }))
    await onTasksChange()
    setSendingOne(null)
  }

  // ── Send ALL pending briefs to pipeline ───────────────────────────────────
  async function handleSendAll() {
    setSendingAll(true)
    setSentCount(0)
    const supabase = createClient()
    let count = 0
    for (const task of sorted) {
      if (task.status === 'done') continue
      const brief = briefs[task.id] ?? generateBrief(task, show!)
      const briefId = await pushBriefToPipeline(task, show!, brief)
      await supabase
        .from('marketing_tasks')
        .update({ status: 'in_progress', ...(briefId ? { trello_card_id: briefId } : {}) })
        .eq('id', task.id)
      if (briefId) setPipelineStatus(prev => ({ ...prev, [briefId]: 'backlog' }))
      count++
      setSentCount(count)
    }
    await onTasksChange()
    setSendingAll(false)
  }

  const pendingCount = sorted.filter((t) => t.status !== 'done').length

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-white shadow-2xl flex flex-col h-full">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 bg-slate-50">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">{show.name}</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {format(parseISO(show.start_date), 'd MMM')} – {format(parseISO(show.end_date), 'd MMM yyyy')}
                {show.site_number && <span className="ml-2">· Site {show.site_number}</span>}
              </p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {show.brands.map((b) => (
                  <span key={b} className="text-xs bg-orange-100 text-orange-700 rounded-full px-2 py-0.5">{b}</span>
                ))}
              </div>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Task list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {sorted.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-10">No tasks yet.</p>
          ) : (
            sorted.map((task) => {
              const cfg     = statusDisplay[task.status]
              const overdue = task.status !== 'done' && isPast(parseISO(task.due_date))
              const briefId = task.trello_card_id
              const pipStatus = briefId ? pipelineStatus[briefId] : null
              const cardName  = buildCardName(task, show)

              return (
                <div key={task.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                  {/* Title + status */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{cardName}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{task.task_name}</p>
                    </div>
                    <Badge variant={cfg.badge} className="flex-shrink-0 whitespace-nowrap">
                      {task.status === 'urgent' && <AlertTriangle className="mr-1 h-3 w-3" />}
                      {cfg.label}
                    </Badge>
                  </div>

                  {/* Due date */}
                  <p className={`text-xs ${overdue ? 'text-red-500 font-medium' : 'text-slate-500'}`}>
                    Due: {format(parseISO(task.due_date), 'd MMM yyyy')}{overdue && ' · Overdue!'}
                  </p>

                  {/* Pipeline status */}
                  {briefId ? (
                    <p className="flex items-center gap-1.5 text-xs text-teal-600 font-medium">
                      <LayoutKanban className="h-3 w-3" />
                      Pipeline: {pipStatus ? PIPELINE_LABELS[pipStatus] ?? pipStatus : 'Backlog'}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400">Not yet on Creative Pipeline</p>
                  )}

                  {/* Editable brief */}
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Brief</p>
                    <textarea
                      value={briefs[task.id] ?? ''}
                      onChange={(e) => setBriefs((b) => ({ ...b, [task.id]: e.target.value }))}
                      rows={5}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100 resize-none font-mono leading-relaxed"
                    />
                  </div>

                  {/* Status buttons + individual send */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex gap-1.5 flex-wrap">
                      {STATUS_BUTTONS.map(({ value, label, icon: Icon }) => (
                        <button
                          key={value}
                          disabled={task.status === value || updating === task.id}
                          onClick={() => updateStatus(task.id, value)}
                          className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border transition-all disabled:opacity-40 ${
                            task.status === value
                              ? 'bg-slate-800 text-white border-slate-800'
                              : 'bg-white text-slate-500 border-slate-300 hover:border-slate-400'
                          }`}
                        >
                          <Icon className="h-3 w-3" />
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* Send single card */}
                    <button
                      disabled={sendingOne === task.id || task.status === 'done'}
                      onClick={() => handleSendOne(task)}
                      className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border border-teal-300 text-teal-700 bg-teal-50 hover:bg-teal-100 transition-all disabled:opacity-40 whitespace-nowrap"
                    >
                      <Send className="h-3 w-3" />
                      {sendingOne === task.id ? 'Sending…' : briefId ? 'Resend' : 'Send to Pipeline'}
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 space-y-2">
          <Button
            className="w-full justify-center"
            onClick={handleSendAll}
            loading={sendingAll}
            disabled={pendingCount === 0}
          >
            <Send className="h-4 w-4" />
            {sendingAll
              ? `Sending… (${sentCount}/${pendingCount})`
              : 'Send All Briefs to Creative Pipeline'}
          </Button>
          <p className="text-xs text-slate-400 text-center">
            Briefs go straight to Backlog on the Creative Pipeline
          </p>
        </div>
      </div>
    </div>
  )
}
