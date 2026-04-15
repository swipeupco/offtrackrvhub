'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import {
  CheckCircle2, Play, Plus, X, Send, ExternalLink,
  MessageSquare, RotateCcw, Loader2, ChevronDown, Clock,
  Video, Image, Mail, LayoutGrid, Mic, FileText, CircleDot,
  GripVertical, Upload,
} from 'lucide-react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { useSearchParams, useRouter } from 'next/navigation'
import { useActiveClient } from '@/lib/active-client-context'

interface Brief {
  id: string
  name: string
  description: string | null
  campaign: string | null
  content_type: string | null
  pipeline_status: string
  internal_status: string | null
  draft_url: string | null
  due_date: string | null
  client_id: string
  sort_order?: number
  cover_url?: string | null
}

interface Comment {
  id: string
  content: string
  user_name: string | null
  user_email: string | null
  is_internal: boolean
  created_at: string
}

const CONTENT_TYPES = [
  { id: 'Video',     icon: Video,      color: '#22c55e' },
  { id: 'Graphic',   icon: Image,      color: '#f97316' },
  { id: 'EDM',       icon: Mail,       color: '#ef4444' },
  { id: 'Signage',   icon: LayoutGrid, color: '#0ea5e9' },
  { id: 'Voiceover', icon: Mic,        color: '#a855f7' },
  { id: 'Script',    icon: FileText,   color: '#f59e0b' },
  { id: 'Other',     icon: CircleDot,  color: '#94a3b8' },
]

const SIZES = ['1 x 1 Square', '4 x 5 Portrait', '9 x 16 Story/Reel', '16 x 9 Landscape']

export default function CreativePipeline() {
  const [briefs, setBriefs]                   = useState<Brief[]>([])
  const [backlogOrder, setBacklogOrder]        = useState<Brief[]>([])
  const [loading, setLoading]                  = useState(true)
  const [selectedBrief, setSelectedBrief]      = useState<Brief | null>(null)
  const [showBriefModal, setShowBriefModal]    = useState(false)
  const [showAllApproved, setShowAllApproved]  = useState(false)
  const [showIdeaGenerator, setShowIdeaGenerator] = useState(false)
  const [prefillBrief, setPrefillBrief]        = useState<Partial<{ name: string; campaign: string; contentType: string; description: string; sizes: string[] }> | null>(null)

  const { clientId, clientConfig, loading: clientLoading } = useActiveClient()
  const clientColor = clientConfig.color

  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    if (searchParams.get('newBrief') === '1') {
      setShowBriefModal(true)
      router.replace('/trello')
    }
  }, [searchParams, router])

  async function load(cid: string, silent = false) {
    if (!silent) setLoading(true)
    const supabase = createClient()
    const { data: briefData } = await supabase
      .from('briefs')
      .select('*')
      .eq('client_id', cid)
      .order('sort_order', { ascending: true })
    setBriefs(briefData ?? [])
    setLoading(false)
  }

  useEffect(() => {
    if (clientLoading) return
    if (!clientId) { setLoading(false); setBriefs([]); return }
    load(clientId)
    const supabase = createClient()
    const channel = supabase
      .channel('client-briefs-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'briefs' }, () => load(clientId, true))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, clientLoading])

  // Keep backlogOrder in sync with briefs
  useEffect(() => {
    setBacklogOrder(
      briefs
        .filter(b => b.pipeline_status === 'backlog')
        .sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999))
    )
  }, [briefs])

  async function handleDragEnd(result: DropResult) {
    if (!result.destination) return
    const items = Array.from(backlogOrder)
    const [moved] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, moved)
    setBacklogOrder(items)
    // Persist new order
    const supabase = createClient()
    await Promise.all(
      items.map((brief, index) =>
        supabase.from('briefs').update({ sort_order: index }).eq('id', brief.id)
      )
    )
  }

  async function handleApprove(briefId: string) {
    const supabase = createClient()
    await supabase
      .from('briefs')
      .update({ pipeline_status: 'approved', internal_status: 'approved_by_client' })
      .eq('id', briefId)

    let newBriefs = briefs.map(b =>
      b.id === briefId ? { ...b, pipeline_status: 'approved', internal_status: 'approved_by_client' } : b
    )

    // Auto-promote top backlog brief if in-production is now empty
    const wasInProduction = briefs.filter(b =>
      ['in_production', 'client_review', 'qa_review'].includes(b.pipeline_status)
    )
    const nextBacklog = briefs
      .filter(b => b.pipeline_status === 'backlog')
      .sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999))[0]

    if (wasInProduction.length === 1 && nextBacklog) {
      await supabase
        .from('briefs')
        .update({ pipeline_status: 'in_production', internal_status: 'in_production' })
        .eq('id', nextBacklog.id)
      newBriefs = newBriefs.map(b =>
        b.id === nextBacklog.id ? { ...b, pipeline_status: 'in_production', internal_status: 'in_production' } : b
      )
    }

    setBriefs(newBriefs)
    if (selectedBrief?.id === briefId) {
      setSelectedBrief(prev => prev ? { ...prev, pipeline_status: 'approved', internal_status: 'approved_by_client' } : null)
    }
  }

  async function handleRequestRevisions(briefId: string) {
    const supabase = createClient()
    await supabase
      .from('briefs')
      .update({ pipeline_status: 'client_review', internal_status: 'revisions_required' })
      .eq('id', briefId)
    setBriefs(prev => prev.map(b =>
      b.id === briefId ? { ...b, pipeline_status: 'client_review', internal_status: 'revisions_required' } : b
    ))
    if (selectedBrief?.id === briefId) {
      setSelectedBrief(prev => prev ? { ...prev, pipeline_status: 'client_review', internal_status: 'revisions_required' } : null)
    }
  }

  async function handleCoverUpload(briefId: string, file: File | null) {
    if (!file) return
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `brief-covers/${briefId}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('brief-assets')
      .upload(path, file, { upsert: true })
    if (uploadError) { console.error('Cover upload error:', uploadError); return }
    const { data: { publicUrl } } = supabase.storage.from('brief-assets').getPublicUrl(path)
    await supabase.from('briefs').update({ cover_url: publicUrl }).eq('id', briefId)
    setBriefs(prev => prev.map(b => b.id === briefId ? { ...b, cover_url: publicUrl } : b))
  }

  const inProduction  = briefs.filter(b => ['in_production', 'client_review', 'qa_review'].includes(b.pipeline_status))
  const allApproved   = briefs.filter(b => b.pipeline_status === 'approved')
  const approvedCards = showAllApproved ? allApproved : allApproved.slice(0, 10)

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Creative Requests</h1>
            <p className="text-sm text-gray-400 mt-0.5">Track and review all your creative work</p>
          </div>
          <button
            onClick={() => setShowBriefModal(true)}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ backgroundColor: clientColor }}
          >
            <Plus className="h-4 w-4" />
            Create Brief
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-3 gap-5">
            {[1,2,3].map(n => <div key={n} className="h-96 rounded-2xl bg-gray-200 animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-5 items-start">

            {/* ── Backlog ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-400 flex-shrink-0" />
                  <h3 className="text-sm font-semibold text-gray-800">Backlog</h3>
                  <span className="text-[11px] font-medium text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                    {backlogOrder.length}
                  </span>
                </div>
                <button
                  onClick={() => setShowBriefModal(true)}
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <div className="px-3 pt-3">
                <button
                  onClick={() => setShowIdeaGenerator(true)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
                  style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}
                >
                  ✨ Generate an Idea for me ✨
                </button>
              </div>

              <Droppable droppableId="backlog">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="p-3 space-y-3 min-h-[300px]"
                  >
                    {backlogOrder.map((brief, index) => (
                      <Draggable key={brief.id} draggableId={brief.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            style={provided.draggableProps.style}
                          >
                            <BriefCard
                              brief={brief}
                              clientColor={clientColor}
                              dragHandleProps={provided.dragHandleProps}
                              isDragging={snapshot.isDragging}
                              onOpen={() => !snapshot.isDragging && setSelectedBrief(brief)}
                              onApprove={() => handleApprove(brief.id)}
                              onRequestRevisions={() => handleRequestRevisions(brief.id)}
                              onCoverUpload={(file) => handleCoverUpload(brief.id, file)}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {backlogOrder.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 py-12 text-center">
                        <p className="text-xs text-gray-400">No briefs in backlog</p>
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>

            {/* ── In Production ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-400 flex-shrink-0" />
                  <h3 className="text-sm font-semibold text-gray-800">In Production</h3>
                  <span className="text-[11px] font-medium text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                    {inProduction.length}
                  </span>
                </div>
                <div className="h-7 w-7" />
              </div>
              <div className="p-3 space-y-3 min-h-[300px]">
                {inProduction.map(brief => (
                  <BriefCard
                    key={brief.id}
                    brief={brief}
                    clientColor={clientColor}
                    reviewMode
                    onOpen={() => setSelectedBrief(brief)}
                    onApprove={() => handleApprove(brief.id)}
                    onRequestRevisions={() => handleRequestRevisions(brief.id)}
                    onCoverUpload={(file) => handleCoverUpload(brief.id, file)}
                  />
                ))}
                {inProduction.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 py-12 text-center">
                    <p className="text-xs text-gray-400">Nothing in production yet</p>
                    <p className="text-[11px] text-gray-300 mt-1">Top backlog item auto-promotes here</p>
                  </div>
                )}
              </div>
            </div>

            {/* ── Approved ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 flex-shrink-0" />
                  <h3 className="text-sm font-semibold text-gray-800">Approved</h3>
                  <span className="text-[11px] font-medium text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                    {allApproved.length}
                  </span>
                </div>
                <div className="h-7 w-7" />
              </div>
              <div className="p-3 space-y-3 min-h-[300px]">
                {approvedCards.map(brief => (
                  <ApprovedBriefCard key={brief.id} brief={brief} clientColor={clientColor} />
                ))}
                {allApproved.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 py-12 text-center">
                    <p className="text-xs text-gray-400">No approved briefs yet</p>
                  </div>
                )}
                {allApproved.length > 10 && (
                  <button
                    onClick={() => setShowAllApproved(v => !v)}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white py-2.5 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAllApproved ? 'rotate-180' : ''}`} />
                    {showAllApproved ? 'Show less' : `See all ${allApproved.length} approved`}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Brief detail side panel */}
        {selectedBrief && (
          <BriefPanel
            brief={selectedBrief}
            clientColor={clientColor}
            onClose={() => setSelectedBrief(null)}
            onApprove={() => handleApprove(selectedBrief.id)}
            onRequestRevisions={() => handleRequestRevisions(selectedBrief.id)}
          />
        )}

        {/* Create Brief modal */}
        {showBriefModal && clientId && (
          <CreateBriefModal
            clientId={clientId}
            clientColor={clientColor}
            prefill={prefillBrief}
            onClose={() => { setShowBriefModal(false); setPrefillBrief(null) }}
            onCreated={() => { setShowBriefModal(false); setPrefillBrief(null); load(clientId, true) }}
          />
        )}

        {/* Idea Generator modal */}
        {showIdeaGenerator && (
          <IdeaGeneratorModal
            clientColor={clientColor}
            onClose={() => setShowIdeaGenerator(false)}
            onBriefGenerated={(brief) => {
              setShowIdeaGenerator(false)
              setPrefillBrief(brief)
              setShowBriefModal(true)
            }}
          />
        )}
      </div>
    </DragDropContext>
  )
}

// ─── Brief Card ───────────────────────────────────────────────────────────────

function BriefCard({ brief, clientColor, reviewMode, dragHandleProps, isDragging, onOpen, onApprove, onRequestRevisions, onCoverUpload }: {
  brief: Brief
  clientColor: string
  reviewMode?: boolean
  dragHandleProps?: Record<string, unknown> | null
  isDragging?: boolean
  onOpen: () => void
  onApprove: () => void
  onRequestRevisions: () => void
  onCoverUpload?: (file: File | null) => void
}) {
  const [approving, setApproving]     = useState(false)
  const [revisioning, setRevisioning] = useState(false)
  const typeInfo    = CONTENT_TYPES.find(t => t.id === brief.content_type)
  const hasDraft    = !!brief.draft_url
  const isRevisions = brief.internal_status === 'revisions_required'

  async function approve() {
    setApproving(true)
    await onApprove()
    setApproving(false)
  }

  async function requestRevisions() {
    setRevisioning(true)
    await onRequestRevisions()
    setRevisioning(false)
  }

  return (
    <div
      className={`rounded-2xl bg-white border border-gray-100 p-4 cursor-pointer transition-all ${isDragging ? 'shadow-2xl rotate-1 scale-105' : 'shadow-sm hover:shadow-md'}`}
      onClick={onOpen}
    >
      {/* Drag handle row */}
      {dragHandleProps && (
        <div className="flex items-center justify-end mb-1.5" onClick={e => e.stopPropagation()}>
          <div
            {...(dragHandleProps as Record<string, unknown>)}
            className="cursor-grab active:cursor-grabbing p-1 rounded-lg text-gray-200 hover:text-gray-400 transition-colors"
          >
            <GripVertical className="h-4 w-4" />
          </div>
        </div>
      )}

      {/* Thumbnail / Cover */}
      <div className="relative h-28 rounded-xl mb-3 overflow-hidden group/cover" onClick={e => e.stopPropagation()}>
        {brief.cover_url ? (
          <img src={brief.cover_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            className="h-full w-full flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${typeInfo?.color ?? '#6366f1'}22 0%, ${typeInfo?.color ?? '#6366f1'}44 100%)` }}
          >
            {typeInfo ? (
              <typeInfo.icon className="h-10 w-10 opacity-30" style={{ color: typeInfo.color }} />
            ) : (
              <div className="h-10 w-10 rounded-full bg-gray-200 opacity-50" />
            )}
          </div>
        )}

        {/* Campaign badge — top right */}
        {brief.campaign && (
          <div className="absolute top-2 right-2 rounded-lg bg-black/60 backdrop-blur-sm px-2 py-1 max-w-[130px]">
            <p className="text-[10px] font-semibold text-white truncate">{brief.campaign}</p>
          </div>
        )}

        {/* Change cover — hover */}
        {onCoverUpload && (
          <label className="absolute bottom-2 right-2 opacity-0 group-hover/cover:opacity-100 transition-opacity cursor-pointer">
            <div className="rounded-lg bg-black/60 backdrop-blur-sm px-2 py-1 flex items-center gap-1">
              <Upload className="h-3 w-3 text-white" />
              <span className="text-[10px] font-semibold text-white">Change cover</span>
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => onCoverUpload(e.target.files?.[0] ?? null)}
              onClick={e => e.stopPropagation()}
            />
          </label>
        )}
      </div>

      {/* Content type badge */}
      {typeInfo && (
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold mb-2"
          style={{ backgroundColor: `${typeInfo.color}18`, color: typeInfo.color }}
        >
          {typeInfo.id}
        </span>
      )}

      {/* Title */}
      <p className="text-sm font-semibold text-gray-800 leading-snug">{brief.name}</p>

      {/* Status badges */}
      <div className="flex gap-1.5 flex-wrap mt-2 mb-3">
        {isRevisions && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-red-50 text-red-500 border border-red-100">
            Revisions requested
          </span>
        )}
        {!hasDraft && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-gray-50 text-gray-400 border border-gray-100">
            Awaiting draft
          </span>
        )}
        {brief.due_date && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-gray-50 text-gray-400 border border-gray-100">
            Due {format(new Date(brief.due_date), 'd MMM')}
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
        {hasDraft ? (
          <a
            href={brief.draft_url!}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Play className="h-3 w-3" />
            View Draft
          </a>
        ) : (
          <button
            disabled
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-gray-100 py-2 text-xs font-medium text-gray-300 cursor-not-allowed"
          >
            <Play className="h-3 w-3" />
            View Draft
          </button>
        )}

        <button
          onClick={approve}
          disabled={approving || !reviewMode || !hasDraft}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-colors ${
            reviewMode && hasDraft
              ? 'bg-emerald-500 text-white hover:bg-emerald-600'
              : 'bg-gray-50 text-gray-300 border border-gray-100 cursor-not-allowed'
          }`}
        >
          {approving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
          Approve
        </button>
      </div>

      {reviewMode && hasDraft && !isRevisions && (
        <button
          onClick={e => { e.stopPropagation(); requestRevisions() }}
          disabled={revisioning}
          className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-xl border border-red-100 py-2 text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors"
        >
          {revisioning ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
          Request Revisions
        </button>
      )}
    </div>
  )
}

// ─── Approved Card ────────────────────────────────────────────────────────────

function ApprovedBriefCard({ brief, clientColor }: { brief: Brief; clientColor: string }) {
  const typeInfo = CONTENT_TYPES.find(t => t.id === brief.content_type)
  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-emerald-500" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 leading-snug truncate">{brief.name}</p>
          {brief.campaign && <p className="text-xs text-gray-400 mt-0.5">{brief.campaign}</p>}
          {typeInfo && (
            <span
              className="mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ backgroundColor: `${typeInfo.color}18`, color: typeInfo.color }}
            >
              {typeInfo.id}
            </span>
          )}
        </div>
        {brief.draft_url && (
          <a href={brief.draft_url} target="_blank" rel="noopener noreferrer"
            className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0 mt-0.5">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  )
}

// ─── Brief Side Panel ────────────────────────────────────────────────────────

function BriefPanel({ brief, clientColor, onClose, onApprove, onRequestRevisions }: {
  brief: Brief
  clientColor: string
  onClose: () => void
  onApprove: () => void
  onRequestRevisions: () => void
}) {
  const [comments, setComments]     = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [sending, setSending]       = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  async function loadComments() {
    const supabase = createClient()
    const { data } = await supabase
      .from('brief_comments')
      .select('*')
      .eq('brief_id', brief.id)
      .eq('is_internal', false)
      .order('created_at', { ascending: true })
    setComments((data as Comment[]) ?? [])
  }

  useEffect(() => {
    loadComments()
    const supabase = createClient()
    const channel = supabase
      .channel(`client-comments-${brief.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'brief_comments',
        filter: `brief_id=eq.${brief.id}`,
      }, () => loadComments())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [brief.id])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [comments])

  async function sendComment(e: React.FormEvent) {
    e.preventDefault()
    if (!newComment.trim()) return
    setSending(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('name').eq('id', user!.id).single()
    await supabase.from('brief_comments').insert({
      brief_id:    brief.id,
      content:     newComment.trim(),
      user_id:     user?.id,
      user_email:  user?.email,
      user_name:   profile?.name ?? user?.email?.split('@')[0] ?? 'Client',
      is_internal: false,
    })
    setNewComment('')
    setSending(false)
  }

  const typeInfo   = CONTENT_TYPES.find(t => t.id === brief.content_type)
  const hasDraft   = !!brief.draft_url
  const isReview   = ['in_production', 'client_review', 'qa_review'].includes(brief.pipeline_status)
  const isApproved = brief.pipeline_status === 'approved'

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full">

        <div className="px-6 py-5 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex-1 min-w-0">
              {brief.campaign && <p className="text-xs text-gray-400 mb-0.5">{brief.campaign}</p>}
              <h2 className="font-bold text-gray-900 leading-snug text-base">{brief.name}</h2>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {typeInfo && (
                  <span className="text-[11px] font-semibold rounded-full px-2.5 py-1"
                    style={{ backgroundColor: `${typeInfo.color}18`, color: typeInfo.color }}>
                    {typeInfo.id}
                  </span>
                )}
                {isApproved && (
                  <span className="text-[11px] font-semibold rounded-full px-2.5 py-1 bg-emerald-50 text-emerald-600">
                    Approved ✓
                  </span>
                )}
                {isReview && !isApproved && (
                  <span className="text-[11px] font-semibold rounded-full px-2.5 py-1 bg-blue-50 text-blue-600">
                    In Production
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          {hasDraft ? (
            <a
              href={brief.draft_url!}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white w-full hover:opacity-90 transition-opacity shadow-sm"
              style={{ backgroundColor: clientColor }}
            >
              <ExternalLink className="h-4 w-4" />
              View Draft
            </a>
          ) : (
            <div className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-gray-400 bg-gray-50 border border-gray-100 w-full">
              <Clock className="h-4 w-4" />
              Draft coming soon
            </div>
          )}

          {isReview && hasDraft && !isApproved && (
            <div className="flex gap-2 mt-3">
              <button
                onClick={onRequestRevisions}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-red-100 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Request Revisions
              </button>
              <button
                onClick={onApprove}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-600 transition-colors"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approve
              </button>
            </div>
          )}
        </div>

        {brief.description && (
          <div className="px-6 py-4 border-b border-gray-100 flex-shrink-0">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Brief Details</p>
            <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-xl p-3 border border-gray-100">
              {brief.description}
            </p>
          </div>
        )}

        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="px-6 py-3 border-b border-gray-100 flex-shrink-0">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Comments {comments.length > 0 && `(${comments.length})`}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {comments.map(c => (
              <div key={c.id} className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-gray-700">{c.user_name || 'Team'}</span>
                  <span className="text-[10px] text-gray-400">{format(new Date(c.created_at), 'd MMM · h:mm a')}</span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">{c.content}</p>
              </div>
            ))}
            {comments.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <MessageSquare className="h-6 w-6 text-gray-200 mb-2" />
                <p className="text-xs text-gray-400">No comments yet</p>
                <p className="text-[11px] text-gray-300 mt-0.5">Leave feedback or questions below</p>
              </div>
            )}
            <div ref={endRef} />
          </div>
          <div className="border-t border-gray-100 p-4 flex-shrink-0">
            <form onSubmit={sendComment} className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Leave feedback or ask a question…"
                className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all"
              />
              <button
                type="submit"
                disabled={sending || !newComment.trim()}
                className="rounded-xl px-3 py-2 text-white disabled:opacity-40 shadow-sm transition-opacity hover:opacity-90"
                style={{ backgroundColor: clientColor }}
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Create Brief Modal ───────────────────────────────────────────────────────

function CreateBriefModal({ clientId, clientColor, prefill, onClose, onCreated }: {
  clientId: string
  clientColor: string
  prefill?: Partial<{ name: string; campaign: string; contentType: string; description: string; sizes: string[] }> | null
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName]               = useState(prefill?.name ?? '')
  const [description, setDesc]        = useState(prefill?.description ?? '')
  const [campaign, setCampaign]       = useState(prefill?.campaign ?? '')
  const [contentType, setContentType] = useState(prefill?.contentType ?? '')
  const [sizes, setSizes]             = useState<string[]>(prefill?.sizes ?? [])
  const [refUrls, setRefUrls]         = useState<string[]>([''])
  const [saving, setSaving]           = useState(false)
  const [aiPrompt, setAiPrompt]       = useState('')
  const [aiLoading, setAiLoading]     = useState(false)

  function toggleSize(s: string) {
    setSizes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  async function handleAiGenerate() {
    if (!aiPrompt.trim()) return
    setAiLoading(true)
    try {
      const res = await fetch('/api/ai-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt }),
      })
      const data = await res.json()
      if (data.title) setName(data.title)
      if (data.campaign) setCampaign(data.campaign)
      if (data.contentType) setContentType(data.contentType)
      if (data.brief) setDesc(data.brief)
      if (data.sizes?.length) setSizes(data.sizes)
    } catch {}
    setAiLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('briefs').insert({
      name:            name.trim(),
      description:     description.trim() || null,
      campaign:        campaign.trim() || null,
      content_type:    contentType || null,
      client_id:       clientId,
      pipeline_status: 'backlog',
      internal_status: 'in_production',
    })
    setSaving(false)
    onCreated()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Create Brief</h2>
          <button onClick={onClose} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="rounded-xl bg-violet-50 border border-violet-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">✨</span>
              <span className="text-sm font-semibold text-violet-700">AI Brief Generator</span>
              <span className="text-xs text-violet-400">— auto-fills all fields below</span>
            </div>
            <textarea
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              rows={3}
              placeholder="Describe what you need... e.g. 'Short Instagram reel for our upcoming sale, upbeat and energetic, targeting new customers'"
              className="w-full rounded-lg border border-violet-200 bg-white px-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
            />
            <button
              type="button"
              onClick={handleAiGenerate}
              disabled={aiLoading || !aiPrompt.trim()}
              className="mt-3 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>✨</span>}
              {aiLoading ? 'Generating…' : 'Generate & Fill Fields'}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1.5">Title *</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  placeholder="e.g. Summer Sale – Instagram Reel"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1.5">Campaign / Show</label>
                <input
                  type="text"
                  value={campaign}
                  onChange={e => setCampaign(e.target.value)}
                  placeholder="e.g. Summer Campaign 2026"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1.5">Brief <span className="font-normal text-gray-400">— keep it short</span></label>
              <textarea
                value={description}
                onChange={e => setDesc(e.target.value)}
                rows={4}
                placeholder="Objective | Key Message | Tone"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 transition-all resize-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-2">Content Type</label>
              <div className="flex gap-2 flex-wrap">
                {CONTENT_TYPES.map(t => {
                  const Icon = t.icon
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setContentType(contentType === t.id ? '' : t.id)}
                      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-all"
                      style={contentType === t.id
                        ? { backgroundColor: t.color, color: '#fff', borderColor: t.color }
                        : { backgroundColor: 'transparent', color: '#6b7280', borderColor: '#e5e7eb' }
                      }
                    >
                      <Icon className="h-3 w-3" />
                      {t.id}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-2">Sizes <span className="font-normal text-gray-400">(multi-select)</span></label>
              <div className="flex gap-2 flex-wrap">
                {SIZES.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSize(s)}
                    className="rounded-full px-3 py-1.5 text-xs font-semibold border transition-all"
                    style={sizes.includes(s)
                      ? { backgroundColor: '#6366f1', color: '#fff', borderColor: '#6366f1' }
                      : { backgroundColor: 'transparent', color: '#6b7280', borderColor: '#e5e7eb' }
                    }
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-2">Reference URLs</label>
              {refUrls.map((url, i) => (
                <input
                  key={i}
                  type="url"
                  value={url}
                  onChange={e => setRefUrls(prev => prev.map((u, j) => j === i ? e.target.value : u))}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 transition-all mb-2"
                />
              ))}
              <button
                type="button"
                onClick={() => setRefUrls(prev => [...prev, ''])}
                className="text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors"
              >
                + Add URL
              </button>
            </div>

            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: clientColor }}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {saving ? 'Creating…' : 'Send to Backlog ↑'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// ─── Idea Generator Modal ─────────────────────────────────────────────────────

function IdeaGeneratorModal({ clientColor, onClose, onBriefGenerated }: {
  clientColor: string
  onClose: () => void
  onBriefGenerated: (brief: { name: string; campaign: string; contentType: string; description: string; sizes: string[] }) => void
}) {
  const CONTENT_GOAL_OPTIONS = [
    { id: 'Video',     label: 'Video Ad',        emoji: '🎬' },
    { id: 'Graphic',   label: 'Graphic / Static', emoji: '🖼️' },
    { id: 'EDM',       label: 'Email Campaign',   emoji: '📧' },
    { id: 'Script',    label: 'Founder Ad / UGC', emoji: '🎤' },
    { id: 'Voiceover', label: 'Organic Content',  emoji: '📱' },
    { id: 'Signage',   label: 'Paid Ad',          emoji: '💰' },
  ]

  const [selectedType, setSelectedType] = useState('')
  const [goal, setGoal]                 = useState('')
  const [ideas, setIdeas]               = useState<Array<{ name: string; campaign: string; contentType: string; description: string; sizes: string[] }> | null>(null)
  const [loading, setLoading]           = useState(false)
  const [step, setStep]                 = useState<'input' | 'ideas'>('input')

  async function generateIdeas() {
    if (!goal.trim()) return
    setLoading(true)
    try {
      const results = await Promise.all([1,2,3].map(() =>
        fetch('/api/ai-brief', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: `${selectedType ? `Content type: ${selectedType}. ` : ''}${goal}. Make this idea unique and specific.`,
          }),
        }).then(r => r.json())
      ))
      setIdeas(results.map(d => ({
        name:        d.title ?? 'Untitled',
        campaign:    d.campaign ?? '',
        contentType: d.contentType ?? selectedType,
        description: d.brief ?? '',
        sizes:       d.sizes ?? [],
      })))
      setStep('ideas')
    } catch {}
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">✨ Generate an Idea</h2>
            <p className="text-xs text-gray-400 mt-0.5">Let AI spark your next creative request</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5">
          {step === 'input' ? (
            <div className="space-y-5">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-2">What type of content?</label>
                <div className="grid grid-cols-3 gap-2">
                  {CONTENT_GOAL_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setSelectedType(selectedType === opt.id ? '' : opt.id)}
                      className="flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-semibold transition-all"
                      style={selectedType === opt.id
                        ? { borderColor: clientColor, backgroundColor: `${clientColor}15`, color: clientColor }
                        : { borderColor: '#e5e7eb', color: '#6b7280' }
                      }
                    >
                      <span className="text-xl">{opt.emoji}</span>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1.5">Describe your goal or idea</label>
                <textarea
                  value={goal}
                  onChange={e => setGoal(e.target.value)}
                  rows={3}
                  placeholder="e.g. Drive awareness for our new product launch, reach existing customers and warm leads..."
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
                />
              </div>
              <button
                onClick={generateIdeas}
                disabled={loading || !goal.trim()}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>✨</span>}
                {loading ? 'Generating 3 ideas…' : 'Generate Ideas'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 mb-3">Pick an idea to create a full brief →</p>
              {ideas?.map((idea, i) => (
                <button
                  key={i}
                  onClick={() => onBriefGenerated(idea)}
                  className="w-full text-left rounded-xl border border-gray-200 p-4 hover:border-violet-300 hover:bg-violet-50 transition-all group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 group-hover:text-violet-700 transition-colors">{idea.name}</p>
                      {idea.campaign && <p className="text-xs text-gray-400 mt-0.5">{idea.campaign}</p>}
                      <p className="text-xs text-gray-500 mt-2 leading-relaxed">{idea.description}</p>
                    </div>
                    <span className="text-xs font-semibold rounded-full px-2 py-0.5 bg-gray-100 text-gray-500 flex-shrink-0 mt-0.5">
                      {idea.contentType}
                    </span>
                  </div>
                </button>
              ))}
              <button
                onClick={() => setStep('input')}
                className="w-full rounded-xl border border-gray-200 py-2.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
              >
                ← Try different ideas
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
