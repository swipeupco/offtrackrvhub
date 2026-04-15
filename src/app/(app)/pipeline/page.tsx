'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import {
  Video, Image, Mail, LayoutGrid, Mic, FileText, CircleDot,
  User, Loader2, X, Check, ChevronDown, ExternalLink, Clock,
} from 'lucide-react'
import {
  DragDropContext, Droppable, Draggable, DropResult,
} from '@hello-pangea/dnd'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { useActiveClient } from '@/lib/active-client-context'

// ─── Constants ────────────────────────────────────────────────────────────────

const CONTENT_TYPES = [
  { id: 'Video',     icon: Video,      color: '#22c55e' },
  { id: 'Graphic',   icon: Image,      color: '#f97316' },
  { id: 'EDM',       icon: Mail,       color: '#ef4444' },
  { id: 'Signage',   icon: LayoutGrid, color: '#0ea5e9' },
  { id: 'Voiceover', icon: Mic,        color: '#a855f7' },
  { id: 'Script',    icon: FileText,   color: '#f59e0b' },
  { id: 'Other',     icon: CircleDot,  color: '#94a3b8' },
]

const STAGES = [
  { id: 'in_production',      label: 'In Production', color: '#3b82f6', bg: '#eff6ff' },
  { id: 'in_review',          label: 'In Review',     color: '#8b5cf6', bg: '#f5f3ff' },
  { id: 'revisions_required', label: 'Revisions',     color: '#ef4444', bg: '#fef2f2' },
  { id: 'approved_by_client', label: 'Approved',      color: '#22c55e', bg: '#f0fdf4' },
]

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface PipelineBrief {
  id: string
  name: string
  campaign: string | null
  content_type: string | null
  pipeline_status: string
  internal_status: string | null
  draft_url: string | null
  due_date: string | null
  client_id: string
  cover_url?: string | null
  assigned_to?: string | null
  client_name: string
  client_color: string
  client_logo: string | null
  assignee_name: string | null
  assignee_avatar: string | null
}

interface StaffMember {
  id: string
  name: string | null
  avatar_url: string | null
  email: string | null
}

interface ClientRow {
  id: string
  name: string
  color: string
  logo: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stageFor(b: PipelineBrief): string {
  const s = b.internal_status ?? ''
  if (STAGES.find(st => st.id === s)) return s
  if (s === 'revisions') return 'revisions_required'
  if (b.pipeline_status === 'approved') return 'approved_by_client'
  return 'in_production'
}

function Initials({ name, color, size = 28 }: { name: string | null; color: string; size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.38 }}
    >
      {name ? name.slice(0, 2).toUpperCase() : '?'}
    </div>
  )
}

// ─── Assignee Picker ──────────────────────────────────────────────────────────

function AssigneePicker({
  brief, staff, isAdmin, onAssign,
}: {
  brief: PipelineBrief
  staff: StaffMember[]
  isAdmin: boolean
  onAssign: (userId: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={e => { e.stopPropagation(); if (isAdmin) setOpen(v => !v) }}
        className={`flex items-center justify-center rounded-full border-2 border-white shadow-sm ${isAdmin ? 'hover:opacity-80 transition-opacity' : ''}`}
        style={{ width: 28, height: 28 }}
        title={brief.assignee_name ?? 'Unassigned'}
      >
        {brief.assignee_avatar ? (
          <img src={brief.assignee_avatar} alt="" className="h-7 w-7 rounded-full object-cover" />
        ) : brief.assignee_name ? (
          <Initials name={brief.assignee_name} color="#6366f1" size={28} />
        ) : (
          <div className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center">
            <User className="h-3.5 w-3.5 text-gray-400" />
          </div>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full mb-1 right-0 w-48 rounded-xl bg-white border border-zinc-200 shadow-xl z-30 overflow-hidden">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 px-3 pt-2.5 pb-1">Assign to</p>
          {staff.map(s => (
            <button
              key={s.id}
              onClick={e => { e.stopPropagation(); onAssign(s.id); setOpen(false) }}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              {s.avatar_url
                ? <img src={s.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover flex-shrink-0" />
                : <Initials name={s.name} color="#6366f1" size={24} />
              }
              <span className="truncate">{s.name ?? s.email}</span>
              {brief.assigned_to === s.id && <Check className="h-3 w-3 text-emerald-500 ml-auto flex-shrink-0" />}
            </button>
          ))}
          {brief.assigned_to && (
            <button
              onClick={e => { e.stopPropagation(); onAssign(null); setOpen(false) }}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-400 hover:bg-red-50 transition-colors border-t border-zinc-100"
            >
              <X className="h-3.5 w-3.5" /> Unassign
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Client Assignment Panel ──────────────────────────────────────────────────

function ClientAssignmentPanel({
  clients, staff, assignments, onSet,
}: {
  clients: ClientRow[]
  staff: StaffMember[]
  assignments: Record<string, string>
  onSet: (clientId: string, userId: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium border border-gray-200 bg-white text-gray-600 hover:border-gray-300 transition-colors"
      >
        <User className="h-3.5 w-3.5" />
        Client assignments
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 rounded-2xl bg-white border border-zinc-200 shadow-2xl z-30 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100">
            <p className="text-xs font-semibold text-zinc-800">Default assignee per client</p>
            <p className="text-[10px] text-zinc-400 mt-0.5">All new production briefs from this client auto-assign to this person</p>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {clients.length === 0 && (
              <p className="text-xs text-zinc-400 px-4 py-6 text-center">No active clients in pipeline</p>
            )}
            {clients.map(client => {
              const assignedId = assignments[client.id] ?? null
              const assignee = assignedId ? staff.find(s => s.id === assignedId) : null
              return (
                <div key={client.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-50 last:border-0">
                  <div
                    className="h-6 w-6 rounded-md flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 overflow-hidden"
                    style={{ backgroundColor: client.color }}
                  >
                    {client.logo
                      ? <img src={client.logo} alt="" className="h-full w-full object-contain p-0.5" />
                      : client.name.slice(0, 2).toUpperCase()
                    }
                  </div>
                  <span className="text-xs font-medium text-zinc-700 flex-1 truncate">{client.name}</span>
                  <select
                    value={assignedId ?? ''}
                    onChange={e => onSet(client.id, e.target.value || null)}
                    className="text-[11px] text-zinc-600 border border-zinc-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  >
                    <option value="">Unassigned</option>
                    {staff.map(s => (
                      <option key={s.id} value={s.id}>{s.name ?? s.email}</option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Pipeline Card ────────────────────────────────────────────────────────────

function PipelineCard({
  brief, staff, isAdmin, isDragging, onAssign,
}: {
  brief: PipelineBrief
  staff: StaffMember[]
  isAdmin: boolean
  isDragging: boolean
  onAssign: (userId: string | null) => void
}) {
  const typeInfo = CONTENT_TYPES.find(t => t.id === brief.content_type)

  return (
    <div
      className={`rounded-2xl bg-white border transition-all ${
        isDragging
          ? 'rotate-1 scale-105 shadow-2xl border-transparent'
          : 'border-gray-100 shadow-sm hover:shadow-md'
      }`}
      style={isDragging ? { boxShadow: `0 0 0 2px ${brief.client_color}, 0 20px 40px ${brief.client_color}44` } : {}}
    >
      {/* Cover */}
      {brief.cover_url && (
        <div className="h-24 rounded-t-2xl overflow-hidden">
          <img src={brief.cover_url} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      {/* No cover — colour accent bar */}
      {!brief.cover_url && (
        <div className="h-1.5 rounded-t-2xl" style={{ backgroundColor: brief.client_color }} />
      )}

      <div className="p-3">
        {/* Client + assignee row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <div
              className="h-4 w-4 rounded flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0 overflow-hidden"
              style={{ backgroundColor: brief.client_color }}
            >
              {brief.client_logo
                ? <img src={brief.client_logo} alt="" className="h-full w-full object-contain" />
                : brief.client_name.slice(0, 2).toUpperCase()
              }
            </div>
            <span className="text-[10px] font-semibold text-gray-400 truncate">{brief.client_name}</span>
          </div>
          <AssigneePicker brief={brief} staff={staff} isAdmin={isAdmin} onAssign={onAssign} />
        </div>

        {/* Content type badge */}
        {typeInfo && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold mb-1.5"
            style={{ backgroundColor: `${typeInfo.color}18`, color: typeInfo.color }}
          >
            <typeInfo.icon className="h-2.5 w-2.5" />
            {typeInfo.id}
          </span>
        )}

        {/* Brief name */}
        <p className="text-xs font-semibold text-gray-800 leading-snug mb-2">{brief.name}</p>

        {/* Footer: due date + draft link */}
        <div className="flex items-center justify-between gap-2">
          {brief.due_date ? (
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <Clock className="h-2.5 w-2.5" />
              {format(new Date(brief.due_date), 'd MMM')}
            </span>
          ) : <span />}

          {brief.draft_url && (
            <a
              href={brief.draft_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-1 text-[10px] font-semibold text-indigo-500 hover:text-indigo-700 transition-colors"
            >
              <ExternalLink className="h-2.5 w-2.5" />
              View draft
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const { isAdmin, isStaff, loading: clientLoading } = useActiveClient()
  const [briefs, setBriefs]                 = useState<PipelineBrief[]>([])
  const [staff, setStaff]                   = useState<StaffMember[]>([])
  const [clientAssignments, setClientAssignments] = useState<Record<string, string>>({})
  const [loading, setLoading]               = useState(true)
  const [currentUserId, setCurrentUserId]   = useState<string | null>(null)
  const [myBriefsOnly, setMyBriefsOnly]     = useState(false)

  async function load() {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (user) setCurrentUserId(user.id)

    // All non-backlog briefs across every client
    const { data: briefData } = await supabase
      .from('briefs')
      .select('*')
      .neq('pipeline_status', 'backlog')
      .order('created_at', { ascending: false })

    if (!briefData?.length) { setBriefs([]); setLoading(false); return }

    // Fetch client metadata
    const clientIds = [...new Set(briefData.map(b => b.client_id))]
    const { data: clientData } = await supabase
      .from('clients')
      .select('id, name, color, logo_url')
      .in('id', clientIds)

    // Fetch assignee profiles
    const assigneeIds = [...new Set(briefData.map(b => b.assigned_to).filter(Boolean))] as string[]
    let assigneeData: { id: string; name: string | null; avatar_url: string | null }[] = []
    if (assigneeIds.length > 0) {
      const { data } = await supabase.from('profiles').select('id, name, avatar_url').in('id', assigneeIds)
      assigneeData = data ?? []
    }

    const enriched: PipelineBrief[] = briefData.map(b => {
      const client  = clientData?.find(c => c.id === b.client_id)
      const assignee = assigneeData.find(p => p.id === b.assigned_to)
      return {
        ...b,
        client_name:    client?.name    ?? 'Unknown',
        client_color:   client?.color   ?? '#6366f1',
        client_logo:    client?.logo_url ?? null,
        assignee_name:  assignee?.name  ?? null,
        assignee_avatar: null, // avatars not stored in current schema
      }
    })
    setBriefs(enriched)

    // Staff members for assignment picker
    const { data: staffData } = await supabase
      .from('profiles')
      .select('id, name, avatar_url, email')
      .or('is_staff.eq.true,is_admin.eq.true')
    setStaff(staffData ?? [])

    // Client-level default assignments
    const { data: caData } = await supabase.from('client_assignments').select('client_id, assigned_to')
    const caMap: Record<string, string> = {}
    caData?.forEach(ca => { caMap[ca.client_id] = ca.assigned_to })
    setClientAssignments(caMap)

    setLoading(false)
  }

  useEffect(() => {
    if (clientLoading) return
    load()
    const supabase = createClient()
    const channel = supabase
      .channel('pipeline-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'briefs' }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientLoading])

  async function handleDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result
    if (!destination || source.droppableId === destination.droppableId) return
    const newStatus = destination.droppableId
    const supabase = createClient()
    await supabase.from('briefs').update({ internal_status: newStatus }).eq('id', draggableId)
    setBriefs(prev => prev.map(b => b.id === draggableId ? { ...b, internal_status: newStatus } : b))
  }

  async function assignBrief(briefId: string, userId: string | null) {
    const supabase = createClient()
    await supabase.from('briefs').update({ assigned_to: userId }).eq('id', briefId)
    const assignee = userId ? staff.find(s => s.id === userId) : null
    setBriefs(prev => prev.map(b => b.id === briefId ? {
      ...b, assigned_to: userId,
      assignee_name: assignee?.name ?? null,
      assignee_avatar: null,
    } : b))
  }

  async function setClientDefault(clientId: string, userId: string | null) {
    const supabase = createClient()
    if (!userId) {
      await supabase.from('client_assignments').delete().eq('client_id', clientId)
      setClientAssignments(prev => { const n = { ...prev }; delete n[clientId]; return n })
    } else {
      await supabase.from('client_assignments').upsert(
        { client_id: clientId, assigned_to: userId },
        { onConflict: 'client_id' },
      )
      setClientAssignments(prev => ({ ...prev, [clientId]: userId }))
      // Auto-assign any unassigned in-production briefs from this client
      setBriefs(prev => prev.map(b =>
        b.client_id === clientId && !b.assigned_to
          ? { ...b, assigned_to: userId, assignee_name: staff.find(s => s.id === userId)?.name ?? null }
          : b
      ))
    }
  }

  const filtered = myBriefsOnly ? briefs.filter(b => b.assigned_to === currentUserId) : briefs

  const byStage = STAGES.reduce((acc, stage) => {
    acc[stage.id] = filtered.filter(b => stageFor(b) === stage.id)
    return acc
  }, {} as Record<string, PipelineBrief[]>)

  const uniqueClients: ClientRow[] = [
    ...new Map(briefs.map(b => [b.client_id, {
      id: b.client_id, name: b.client_name, color: b.client_color, logo: b.client_logo,
    }])).values(),
  ]

  if (clientLoading || loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
    </div>
  )

  if (!isAdmin && !isStaff) return (
    <div className="flex items-center justify-center h-[60vh]">
      <p className="text-sm text-gray-400">Access restricted to SwipeUp team members.</p>
    </div>
  )

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Production Pipeline</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {briefs.length} active brief{briefs.length !== 1 ? 's' : ''} across {uniqueClients.length} client{uniqueClients.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMyBriefsOnly(v => !v)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium border transition-colors ${
              myBriefsOnly
                ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            <User className="h-3.5 w-3.5" />
            My briefs{myBriefsOnly && ` (${filtered.length})`}
          </button>
          {isAdmin && (
            <ClientAssignmentPanel
              clients={uniqueClients}
              staff={staff}
              assignments={clientAssignments}
              onSet={setClientDefault}
            />
          )}
        </div>
      </div>

      {/* Kanban */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-4 gap-4 items-start">
          {STAGES.map(stage => (
            <div key={stage.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-visible">
              {/* Column header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
                <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
                <h3 className="text-sm font-semibold text-gray-800 flex-1">{stage.label}</h3>
                <span
                  className="text-[11px] font-semibold rounded-full px-2 py-0.5"
                  style={{ backgroundColor: stage.bg, color: stage.color }}
                >
                  {byStage[stage.id].length}
                </span>
              </div>

              <Droppable droppableId={stage.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`p-3 space-y-3 min-h-[160px] rounded-b-2xl transition-colors ${
                      snapshot.isDraggingOver ? 'bg-gray-50/80' : ''
                    }`}
                  >
                    {byStage[stage.id].map((brief, index) => (
                      <Draggable key={brief.id} draggableId={brief.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            style={provided.draggableProps.style}
                          >
                            <PipelineCard
                              brief={brief}
                              staff={staff}
                              isAdmin={isAdmin}
                              isDragging={snapshot.isDragging}
                              onAssign={uid => assignBrief(brief.id, uid)}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {byStage[stage.id].length === 0 && !snapshot.isDraggingOver && (
                      <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center">
                        <p className="text-xs text-gray-300">Nothing here</p>
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  )
}
