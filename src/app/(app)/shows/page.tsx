'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { syncTasksForShow, cleanupTasksForShow } from '@/lib/logic-engine'
import { ShowCard } from '@/components/shows/ShowCard'
import { ShowDetailModal } from '@/components/shows/ShowDetailModal'
import { ShowForm } from '@/components/shows/ShowForm'
import { TaskDrawer } from '@/components/shows/TaskDrawer'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { isShowComplete, daysUntilStart, parseLocalDate, getFaviconUrl } from '@/lib/date-utils'
import { format } from 'date-fns'
import { Plus, Search, LayoutGrid, List, Columns, Eye, EyeOff, MapPin, Calendar, AlertTriangle, Users, ChevronRight, Pencil, Trash2 } from 'lucide-react'
import type { Show, MarketingTask, ShowFormData } from '@/types'

type ViewMode = 'card' | 'list' | 'kanban'

const KANBAN_COLS = [
  { key: 'upcoming',   label: 'Upcoming',    filter: (s: Show) => !isShowComplete(s.end_date) && daysUntilStart(s.start_date) > 30 },
  { key: 'thismonth',  label: 'This Month',  filter: (s: Show) => !isShowComplete(s.end_date) && daysUntilStart(s.start_date) <= 30 },
  { key: 'complete',   label: 'Complete',    filter: (s: Show) => isShowComplete(s.end_date) },
]

export default function ShowsPage() {
  const [shows, setShows]     = useState<Show[]>([])
  const [tasks, setTasks]     = useState<MarketingTask[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [search, setSearch]   = useState('')
  const [view, setView]       = useState<ViewMode>('card')
  const [showCompleted, setShowCompleted] = useState(false)
  const [modalOpen, setModalOpen]       = useState(false)
  const [editingShow, setEditingShow]   = useState<Show | undefined>()
  const [drawerShow, setDrawerShow]     = useState<Show | null>(null)
  const [detailShow, setDetailShow]     = useState<Show | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Show | null>(null)
  const saveInFlight = useRef(false)

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const [showsRes, tasksRes] = await Promise.all([
      supabase.from('shows').select('*').order('start_date', { ascending: true }),
      supabase.from('marketing_tasks').select('*'),
    ])
    setShows((showsRes.data as Show[]) ?? [])
    setTasks((tasksRes.data as MarketingTask[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleSave(data: ShowFormData) {
    if (saveInFlight.current) return
    saveInFlight.current = true
    setSaving(true)
    try {
      const supabase = createClient()
      let savedShow: Show
      if (editingShow) {
        const { data: updated, error } = await supabase.from('shows').update(data).eq('id', editingShow.id).select().single()
        if (error || !updated) throw error
        savedShow = updated as Show
      } else {
        const { data: created, error } = await supabase.from('shows').insert(data).select().single()
        if (error || !created) throw error
        savedShow = created as Show
      }
      await syncTasksForShow(savedShow)
      await fetchData()
      setModalOpen(false)
      setEditingShow(undefined)
    } finally {
      setSaving(false)
      saveInFlight.current = false
    }
  }

  async function handleDelete(show: Show) {
    await cleanupTasksForShow(show.id)
    const supabase = createClient()
    await supabase.from('shows').delete().eq('id', show.id)
    setDeleteTarget(null)
    await fetchData()
  }

  const taskCountFor   = (id: string) => tasks.filter(t => t.show_id === id).length
  const urgentCountFor = (id: string) => tasks.filter(t => t.show_id === id && t.status === 'urgent').length
  const tasksFor       = (id: string) => tasks.filter(t => t.show_id === id)

  const filtered = shows.filter(s =>
    (s.name.toLowerCase().includes(search.toLowerCase()) || s.location.toLowerCase().includes(search.toLowerCase())) &&
    (showCompleted || !isShowComplete(s.end_date))
  )

  const sharedCardProps = (show: Show) => ({
    show,
    taskCount: taskCountFor(show.id),
    urgentCount: urgentCountFor(show.id),
    onEdit: (s: Show) => { setEditingShow(s); setModalOpen(true) },
    onDelete: (s: Show) => setDeleteTarget(s),
    onViewTasks: (s: Show) => setDrawerShow(s),
    onViewDetails: (s: Show) => setDetailShow(s),
  })

  return (
    <div className="p-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Shows</h1>
          <p className="text-zinc-500 mt-1">{shows.length} show{shows.length !== 1 ? 's' : ''} total</p>
        </div>
        <Button onClick={() => { setEditingShow(undefined); setModalOpen(true) }} size="lg">
          <Plus className="h-4 w-4" />
          Add Show
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search shows..."
            className="w-full rounded-lg border border-zinc-300 bg-white pl-9 pr-4 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#14C29F]/30 focus:border-[#14C29F]"
          />
        </div>

        {/* View toggle */}
        <div className="flex items-center rounded-lg border border-zinc-200 bg-white overflow-hidden">
          {([
            { mode: 'card'   as const, Icon: LayoutGrid, label: 'Card' },
            { mode: 'list'   as const, Icon: List,        label: 'List' },
            { mode: 'kanban' as const, Icon: Columns,     label: 'Kanban' },
          ]).map(({ mode, Icon, label }) => (
            <button
              key={mode}
              onClick={() => setView(mode)}
              title={label}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-r last:border-r-0 border-zinc-200"
              style={view === mode ? { backgroundColor: '#14C29F', color: '#fff' } : { color: '#71717a' }}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Show completed toggle — only in card/list view */}
        {view !== 'kanban' && (
          <button
            onClick={() => setShowCompleted(v => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
          >
            {showCompleted ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {showCompleted ? 'Hide completed' : 'Show completed'}
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(n => <div key={n} className="h-52 rounded-2xl bg-zinc-200 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-zinc-400 text-lg">No shows found</p>
          <p className="text-zinc-400 text-sm mt-1">{search ? 'Try a different search.' : 'Click "Add Show" to get started.'}</p>
        </div>
      ) : view === 'card' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(show => <ShowCard key={show.id} {...sharedCardProps(show)} />)}
        </div>
      ) : view === 'list' ? (
        <ShowListView shows={filtered} tasks={tasks} {...{ onEdit: sharedCardProps(filtered[0]).onEdit, onDelete: sharedCardProps(filtered[0]).onDelete, onViewTasks: sharedCardProps(filtered[0]).onViewTasks, onViewDetails: sharedCardProps(filtered[0]).onViewDetails, taskCountFor, urgentCountFor }} />
      ) : (
        /* Kanban */
        <div className="grid grid-cols-3 gap-4 items-start">
          {KANBAN_COLS.map(col => {
            const colShows = shows.filter(s =>
              col.filter(s) &&
              (s.name.toLowerCase().includes(search.toLowerCase()) || s.location.toLowerCase().includes(search.toLowerCase()))
            )
            return (
              <div key={col.key}>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">{col.label}</h3>
                  <span className="text-xs text-zinc-400 bg-zinc-200 rounded-full px-2 py-0.5">{colShows.length}</span>
                </div>
                <div className="space-y-3" style={{ opacity: col.key === 'complete' ? 0.7 : 1 }}>
                  {colShows.map(show => <ShowCard key={show.id} {...sharedCardProps(show)} />)}
                  {colShows.length === 0 && (
                    <div className="rounded-xl border border-dashed border-zinc-300 py-8 text-center">
                      <p className="text-xs text-zinc-400">No shows</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Detail modal */}
      {detailShow && (
        <ShowDetailModal
          show={detailShow}
          taskCount={taskCountFor(detailShow.id)}
          urgentCount={urgentCountFor(detailShow.id)}
          onClose={() => setDetailShow(null)}
          onEdit={s => { setDetailShow(null); setEditingShow(s); setModalOpen(true) }}
          onViewTasks={s => { setDetailShow(null); setDrawerShow(s) }}
        />
      )}

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditingShow(undefined) }} title={editingShow ? 'Edit Show' : 'Add Show'} size="lg">
        <ShowForm initial={editingShow} onSubmit={handleSave} loading={saving} />
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Show" size="sm">
        <p className="text-zinc-400 text-sm">
          Are you sure you want to delete <strong className="text-white">{deleteTarget?.name}</strong>? All linked tasks will be removed.
        </p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => deleteTarget && handleDelete(deleteTarget)}>Delete Show</Button>
        </div>
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

/* ── List View ─────────────────────────────────────────────── */
function ShowListView({
  shows, tasks, taskCountFor, urgentCountFor, onEdit, onDelete, onViewTasks, onViewDetails,
}: {
  shows: Show[]
  tasks: MarketingTask[]
  taskCountFor: (id: string) => number
  urgentCountFor: (id: string) => number
  onEdit: (s: Show) => void
  onDelete: (s: Show) => void
  onViewTasks: (s: Show) => void
  onViewDetails: (s: Show) => void
}) {
  return (
    <div className="rounded-2xl bg-white border border-zinc-200 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-100 bg-zinc-50">
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Show</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide hidden md:table-cell">Dates</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide hidden lg:table-cell">Audience</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Status</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {shows.map(show => {
            const complete = isShowComplete(show.end_date)
            const days = daysUntilStart(show.start_date)
            const start = parseLocalDate(show.start_date)
            const end = parseLocalDate(show.end_date)
            const favicon = getFaviconUrl(show.website_url)
            const statusVariant: 'default'|'danger'|'warning'|'info' =
              complete ? 'default' : days <= 7 ? 'danger' : days <= 30 ? 'warning' : 'info'
            const statusLabel = complete ? 'Complete' : days === 0 ? 'Today!' : `${days}d away`

            return (
              <tr key={show.id} className="hover:bg-zinc-50 transition-colors group" style={{ opacity: complete ? 0.65 : 1 }}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    {favicon
                      ? <img src={favicon} alt="" className="h-6 w-6 object-contain flex-shrink-0" onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
                      : <div className="h-6 w-6 rounded bg-zinc-100 flex-shrink-0" />}
                    <div>
                      <p className="font-medium text-zinc-900">{show.name}{complete && <span className="ml-1 text-xs font-normal text-zinc-400">(Complete)</span>}</p>
                      <p className="text-xs text-zinc-500 flex items-center gap-1"><MapPin className="h-3 w-3" />{show.location}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-zinc-600 hidden md:table-cell">
                  <div className="flex items-center gap-1 text-xs"><Calendar className="h-3 w-3 text-zinc-400" />{format(start,'d MMM')} – {format(end,'d MMM yyyy')}</div>
                  {!show.site_number && <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-0.5"><AlertTriangle className="h-3 w-3" />Site number missing</p>}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {(show.hubspot_audience ?? []).map(a => (
                      <span key={a} className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white" style={{ backgroundColor: '#14C29F' }}>{a}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3"><Badge variant={statusVariant}>{statusLabel}</Badge></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => onViewDetails(show)} className="rounded-lg px-2 py-1 text-xs font-medium border border-zinc-200 text-zinc-600 hover:bg-zinc-50">Details</button>
                    <button onClick={() => onViewTasks(show)} className="rounded-lg px-2 py-1 text-xs text-zinc-500 hover:text-[#14C29F] flex items-center gap-0.5">
                      {taskCountFor(show.id)} tasks <ChevronRight className="h-3 w-3" />
                    </button>
                    <div className="opacity-0 group-hover:opacity-100 flex items-center transition-opacity">
                      <button onClick={() => onEdit(show)} className="p-1.5 text-zinc-400 hover:text-zinc-700"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => onDelete(show)} className="p-1.5 text-zinc-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
