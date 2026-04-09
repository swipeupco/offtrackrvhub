'use client'

import { format, parseISO, isPast } from 'date-fns'
import { X, CheckCircle2, Circle, Send, ExternalLink, AlertTriangle, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { MarketingTask, Show, TaskStatus } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { useState, useEffect } from 'react'

// ── Status config ─────────────────────────────────────────────────────────────
type ManualStatus = 'pending' | 'in_progress' | 'done'

const STATUS_BUTTONS: { value: ManualStatus; label: string; icon: React.ElementType }[] = [
  { value: 'pending',     label: 'Pending',        icon: Circle },
  { value: 'in_progress', label: 'In Production',  icon: Send },
  { value: 'done',        label: 'Complete',        icon: CheckCircle2 },
]

const statusDisplay: Record<TaskStatus, { label: string; badge: 'default' | 'warning' | 'danger' | 'success' | 'info' }> = {
  pending:     { label: 'Pending',       badge: 'default' },
  urgent:      { label: 'Urgent',        badge: 'danger' },
  in_progress: { label: 'In Production', badge: 'info' },
  done:        { label: 'Complete',      badge: 'success' },
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

// ── Trello card creator ───────────────────────────────────────────────────────
async function pushCardToTrello(task: MarketingTask, show: Show, brief: string): Promise<string | null> {
  const key    = process.env.NEXT_PUBLIC_TRELLO_API_KEY
  const token  = process.env.NEXT_PUBLIC_TRELLO_TOKEN
  const listId = process.env.NEXT_PUBLIC_TRELLO_LIST_ID
  if (!key || !token || !listId) return null
  try {
    const res = await fetch(`https://api.trello.com/1/cards?key=${key}&token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `${task.task_name} – ${show.name}`, desc: brief, idList: listId, pos: 'top' }),
    })
    if (!res.ok) return null
    const card = await res.json()
    return card.id as string
  } catch { return null }
}

interface Props {
  show: Show | null
  tasks: MarketingTask[]
  onClose: () => void
  onTasksChange: () => void
}

export function TaskDrawer({ show, tasks, onClose, onTasksChange }: Props) {
  const [updating, setUpdating]     = useState<string | null>(null)
  const [sendingAll, setSendingAll] = useState(false)
  const [sendingOne, setSendingOne] = useState<string | null>(null)
  const [syncing, setSyncing]       = useState(false)
  const [syncMsg, setSyncMsg]       = useState<string | null>(null)
  const [sentCount, setSentCount]   = useState(0)
  const [briefs, setBriefs]         = useState<Record<string, string>>({})

  useEffect(() => {
    if (!show) return
    const s = show
    const initial: Record<string, string> = {}
    tasks.forEach((t) => { initial[t.id] = generateBrief(t, s) })
    setBriefs(initial)
    setSentCount(0)
    setSyncMsg(null)
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

  // ── Send single task to Trello ────────────────────────────────────────────
  async function handleSendOne(task: MarketingTask) {
    setSendingOne(task.id)
    const supabase = createClient()
    const brief = briefs[task.id] ?? generateBrief(task, show!)
    const cardId = await pushCardToTrello(task, show!, brief)
    await supabase
      .from('marketing_tasks')
      .update({ status: 'in_progress', ...(cardId ? { trello_card_id: cardId } : {}) })
      .eq('id', task.id)
    await onTasksChange()
    setSendingOne(null)
  }

  // ── Send ALL tasks to Trello ──────────────────────────────────────────────
  async function handleSendAll() {
    setSendingAll(true)
    setSentCount(0)
    const supabase = createClient()
    let count = 0
    for (const task of sorted) {
      if (task.status === 'done') continue
      const brief = briefs[task.id] ?? generateBrief(task, show!)
      const cardId = await pushCardToTrello(task, show!, brief)
      await supabase
        .from('marketing_tasks')
        .update({ status: 'in_progress', ...(cardId ? { trello_card_id: cardId } : {}) })
        .eq('id', task.id)
      count++
      setSentCount(count)
    }
    await onTasksChange()
    setSendingAll(false)
  }

  // ── Sync FROM Trello (pull status updates + detect removed cards) ─────────
  async function handleSync() {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/trello-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showId: show!.id }),
      })
      const data = await res.json()
      await onTasksChange()
      const parts = []
      if (data.updated  > 0) parts.push(`${data.updated} status${data.updated !== 1 ? 'es' : ''} updated`)
      if (data.archived > 0) parts.push(`${data.archived} removed card${data.archived !== 1 ? 's' : ''} cleared`)
      setSyncMsg(parts.length ? parts.join(', ') : 'Already up to date')
    } catch {
      setSyncMsg('Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const trelloConfigured = !!(
    process.env.NEXT_PUBLIC_TRELLO_API_KEY &&
    process.env.NEXT_PUBLIC_TRELLO_TOKEN &&
    process.env.NEXT_PUBLIC_TRELLO_LIST_ID
  )

  const pendingCount = sorted.filter((t) => t.status !== 'done').length
  const linkedCount  = sorted.filter((t) => t.trello_card_id).length

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
              const cfg    = statusDisplay[task.status]
              const overdue = task.status !== 'done' && isPast(parseISO(task.due_date))

              return (
                <div key={task.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                  {/* Title + status */}
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">{task.task_name}</p>
                    <Badge variant={cfg.badge} className="flex-shrink-0 whitespace-nowrap">
                      {task.status === 'urgent' && <AlertTriangle className="mr-1 h-3 w-3" />}
                      {cfg.label}
                    </Badge>
                  </div>

                  {/* Due date */}
                  <p className={`text-xs ${overdue ? 'text-red-500 font-medium' : 'text-slate-500'}`}>
                    Due: {format(parseISO(task.due_date), 'd MMM yyyy')}{overdue && ' · Overdue!'}
                  </p>

                  {/* Trello card status */}
                  {task.trello_card_id ? (
                    <p className="flex items-center gap-1 text-xs text-blue-500">
                      <ExternalLink className="h-3 w-3" />
                      Trello card linked
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400">No Trello card yet</p>
                  )}

                  {/* Editable brief */}
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Brief</p>
                    <textarea
                      value={briefs[task.id] ?? ''}
                      onChange={(e) => setBriefs((b) => ({ ...b, [task.id]: e.target.value }))}
                      rows={5}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100 resize-none font-mono leading-relaxed"
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
                      className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border border-orange-300 text-orange-600 bg-orange-50 hover:bg-orange-100 transition-all disabled:opacity-40 whitespace-nowrap"
                    >
                      <Send className="h-3 w-3" />
                      {sendingOne === task.id ? 'Sending…' : task.trello_card_id ? 'Resend' : 'Send to Trello'}
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 space-y-2">
          {!trelloConfigured && (
            <p className="text-xs text-amber-600">Trello not configured — add API keys to .env.local.</p>
          )}

          {/* Sync row */}
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="flex-1 justify-center"
              onClick={handleSync}
              loading={syncing}
              disabled={linkedCount === 0}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Sync from Trello
            </Button>
            {syncMsg && <p className="text-xs text-slate-500">{syncMsg}</p>}
          </div>

          {/* Send all row */}
          <Button
            className="w-full justify-center"
            onClick={handleSendAll}
            loading={sendingAll}
            disabled={pendingCount === 0}
          >
            <Send className="h-4 w-4" />
            {sendingAll
              ? `Sending… (${sentCount}/${pendingCount})`
              : 'Send All Briefs to Trello'}
          </Button>
          <p className="text-xs text-slate-400 text-center">
            Syncs card positions from Trello · Auto-sync available after deploying to Netlify
          </p>
        </div>
      </div>
    </div>
  )
}
