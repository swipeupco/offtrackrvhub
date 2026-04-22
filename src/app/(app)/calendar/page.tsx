'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { syncTasksForShow } from '@/lib/logic-engine'
import { MarketingCalendar } from '@/components/calendar/MarketingCalendar'
import { ShowForm } from '@/components/shows/ShowForm'
import { TaskDrawer } from '@/components/shows/TaskDrawer'
import { Modal } from '@/components/ui/Modal'
import type { Show, MarketingTask, ShowFormData } from '@/types'
import { Link2, Check, Copy } from 'lucide-react'
import { useActiveClient } from '@/lib/active-client-context'

export default function CalendarPage() {
  const [shows, setShows]         = useState<Show[]>([])
  const [tasks, setTasks]         = useState<MarketingTask[]>([])
  const [loading, setLoading]     = useState(true)
  const [editingShow, setEditingShow] = useState<Show | null>(null)
  const [drawerShow, setDrawerShow]   = useState<Show | null>(null)
  const [saving, setSaving]       = useState(false)
  const [shareLink, setShareLink] = useState<string | null>(null)
  const [sharingLoading, setSharingLoading] = useState(false)
  const [copied, setCopied]       = useState(false)
  const saveInFlight = useRef(false)
  const { clientId, loading: clientLoading } = useActiveClient()

  async function fetchData() {
    if (!clientId) return
    const supabase = createClient()
    const { data: showsData } = await supabase
      .from('shows')
      .select('*')
      .eq('client_id', clientId)
    const showIds = (showsData ?? []).map((s: Show) => s.id)
    const { data: tasksData } = showIds.length > 0
      ? await supabase.from('marketing_tasks').select('*').in('show_id', showIds)
      : { data: [] }
    setShows((showsData as Show[]) ?? [])
    setTasks((tasksData as MarketingTask[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    if (clientLoading) return
    fetchData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, clientLoading])

  async function handleSave(data: ShowFormData) {
    if (saveInFlight.current || !editingShow) return
    saveInFlight.current = true
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: updated, error } = await supabase
        .from('shows')
        .update(data)
        .eq('id', editingShow.id)
        .select()
        .single()
      if (!error && updated) {
        await syncTasksForShow(updated as Show)
        await fetchData()
      }
      setEditingShow(null)
    } finally {
      setSaving(false)
      saveInFlight.current = false
    }
  }

  const tasksFor = (showId: string) => tasks.filter(t => t.show_id === showId)

  async function handleShare() {
    setSharingLoading(true)
    try {
      const res = await fetch('/api/shared-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'calendar' }),
      })
      const { token } = await res.json()
      const url = `${window.location.origin}/share/calendar/${token}`
      setShareLink(url)
    } finally {
      setSharingLoading(false)
    }
  }

  async function copyLink() {
    if (!shareLink) return
    await navigator.clipboard.writeText(shareLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Marketing Calendar</h1>
          <p className="text-zinc-500 mt-1">Click a show to edit it. Click a deliverable to open its brief.</p>
        </div>
        <div className="flex items-center gap-2">
          {shareLink ? (
            <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2">
              <p className="text-xs text-zinc-500 max-w-48 truncate">{shareLink}</p>
              <button onClick={copyLink} className="text-zinc-500 hover:text-zinc-700 transition-colors">
                {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          ) : (
            <button
              onClick={handleShare}
              disabled={sharingLoading}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-50"
            >
              <Link2 className="h-3.5 w-3.5" />
              {sharingLoading ? 'Generating…' : 'Share Calendar'}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="h-[600px] rounded-2xl bg-zinc-100 animate-pulse" />
      ) : (
        <MarketingCalendar
          shows={shows}
          tasks={tasks}
          onEditShow={show => setEditingShow(show)}
          onClickTask={(show, _task) => setDrawerShow(show)}
        />
      )}

      <Modal open={!!editingShow} onClose={() => setEditingShow(null)} title="Edit Show" size="lg">
        {editingShow && (
          <ShowForm initial={editingShow} onSubmit={handleSave} loading={saving} />
        )}
      </Modal>

      <TaskDrawer
        show={drawerShow}
        tasks={drawerShow ? tasksFor(drawerShow.id) : []}
        onClose={() => setDrawerShow(null)}
        onTasksChange={fetchData}
      />
    </div>
  )
}
