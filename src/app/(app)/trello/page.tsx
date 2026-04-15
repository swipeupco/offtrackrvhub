'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import {
  CheckCircle2, Play, Plus, X, Send, ExternalLink,
  MessageSquare, RotateCcw, Loader2, ChevronDown, Clock,
  Video, Image, Mail, LayoutGrid, Mic, FileText, CircleDot, Link as LinkIcon,
} from 'lucide-react'
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

// Map Supabase pipeline_status → client-facing column
function getColumn(status: string) {
  if (status === 'client_review') return 'client_review'
  if (status === 'approved')      return 'approved'
  return 'in_progress' // backlog / in_production / qa_review → all show as "In Production"
}

export default function CreativePipeline() {
  const [briefs, setBriefs]       = useState<Brief[]>([])
  const [loading, setLoading]     = useState(true)
  const [selectedBrief, setSelectedBrief] = useState<Brief | null>(null)
  const [showBriefModal, setShowBriefModal] = useState(false)
  const [showAllApproved, setShowAllApproved] = useState(false)

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
      .order('created_at', { ascending: false })
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

  // Approve: updates BOTH pipeline_status → approved AND internal_status → approved_by_client
  async function handleApprove(briefId: string) {
    const supabase = createClient()
    await supabase
      .from('briefs')
      .update({ pipeline_status: 'approved', internal_status: 'approved_by_client' })
      .eq('id', briefId)
    setBriefs(prev => prev.map(b =>
      b.id === briefId ? { ...b, pipeline_status: 'approved', internal_status: 'approved_by_client' } : b
    ))
    if (selectedBrief?.id === briefId) {
      setSelectedBrief(prev => prev ? { ...prev, pipeline_status: 'approved', internal_status: 'approved_by_client' } : null)
    }
  }

  // Request revisions: flags internal board, keeps brief in client_review
  async function handleRequestRevisions(briefId: string) {
    const supabase = createClient()
    // Brief stays in client_review column — only internal_status changes
    // Both fields written together in a single update call
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

  const inProgress     = briefs.filter(b => getColumn(b.pipeline_status) === 'in_progress')
  const clientReview   = briefs.filter(b => getColumn(b.pipeline_status) === 'client_review')
  const allApproved    = briefs.filter(b => getColumn(b.pipeline_status) === 'approved')
  const approvedCards  = showAllApproved ? allApproved : allApproved.slice(0, 10)

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">Creative Pipeline</h1>
        <button
          onClick={() => setShowBriefModal(true)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: clientColor }}
        >
          <Plus className="h-3.5 w-3.5" />
          Create Brief
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(n => <div key={n} className="h-96 rounded-2xl bg-zinc-200 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-0 items-start rounded-2xl overflow-hidden border border-zinc-200 shadow-sm">

          {/* ── In Production ── */}
          <div className="flex flex-col gap-3 bg-amber-50 p-4 border-r border-zinc-200 min-h-[600px]">
            <div className="flex items-center justify-between rounded-xl bg-zinc-900 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                <h3 className="text-sm font-semibold text-white">In Production</h3>
              </div>
              <span className="rounded-full bg-zinc-700 text-zinc-300 text-[10px] font-bold px-2 py-0.5">
                {inProgress.length}
              </span>
            </div>
            <div className="space-y-3">
              {inProgress.map(brief => (
                <BriefCard
                  key={brief.id}
                  brief={brief}
                  clientColor={clientColor}
                  onOpen={() => setSelectedBrief(brief)}
                  onApprove={() => handleApprove(brief.id)}
                  onRequestRevisions={() => handleRequestRevisions(brief.id)}
                />
              ))}
              {inProgress.length === 0 && (
                <div className="rounded-xl border border-dashed border-amber-200 py-10 text-center">
                  <p className="text-xs text-zinc-400">Nothing in production</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Ready for Review ── */}
          <div className="flex flex-col gap-3 bg-blue-50 p-4 border-r border-zinc-200 min-h-[600px]">
            <div className="flex items-center justify-between rounded-xl bg-blue-600 px-4 py-3">
              <div className="flex items-center gap-2">
                <Play className="h-3.5 w-3.5 text-white" />
                <h3 className="text-sm font-semibold text-white">Ready for Review</h3>
              </div>
              <span className="rounded-full bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5">
                {clientReview.length}
              </span>
            </div>
            <div className="space-y-3">
              {clientReview.map(brief => (
                <BriefCard
                  key={brief.id}
                  brief={brief}
                  clientColor={clientColor}
                  reviewMode
                  onOpen={() => setSelectedBrief(brief)}
                  onApprove={() => handleApprove(brief.id)}
                  onRequestRevisions={() => handleRequestRevisions(brief.id)}
                />
              ))}
              {clientReview.length === 0 && (
                <div className="rounded-xl border border-dashed border-blue-200 py-10 text-center">
                  <p className="text-xs text-zinc-400">Nothing to review yet</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Approved ── */}
          <div className="flex flex-col gap-3 bg-emerald-50 p-4 min-h-[600px]">
            <div
              className="flex items-center justify-between rounded-xl px-4 py-3"
              style={{ backgroundColor: clientColor }}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-white" />
                <h3 className="text-sm font-semibold text-white">Approved</h3>
              </div>
              <span className="rounded-full bg-white/20 text-white text-[10px] font-bold px-2 py-0.5">
                {allApproved.length}
              </span>
            </div>
            <div className="space-y-2">
              {approvedCards.map(brief => (
                <ApprovedBriefCard key={brief.id} brief={brief} clientColor={clientColor} />
              ))}
              {allApproved.length === 0 && (
                <div className="rounded-xl border border-dashed border-emerald-200 py-10 text-center">
                  <p className="text-xs text-zinc-400">No approved briefs yet</p>
                </div>
              )}
              {allApproved.length > 10 && (
                <button
                  onClick={() => setShowAllApproved(v => !v)}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-white/60 py-2.5 text-xs font-medium text-zinc-500 hover:bg-white transition-colors"
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
          onClose={() => setShowBriefModal(false)}
          onCreated={() => { setShowBriefModal(false); load(clientId, true) }}
        />
      )}
    </div>
  )
}

// ─── Brief Card ───────────────────────────────────────────────────────────────

function BriefCard({ brief, clientColor, reviewMode, onOpen, onApprove, onRequestRevisions }: {
  brief: Brief
  clientColor: string
  reviewMode?: boolean
  onOpen: () => void
  onApprove: () => void
  onRequestRevisions: () => void
}) {
  const [approving, setApproving]   = useState(false)
  const [revisioning, setRevisioning] = useState(false)
  const typeInfo = CONTENT_TYPES.find(t => t.id === brief.content_type)
  const hasDraft = !!brief.draft_url
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
    <div className="rounded-xl bg-white border border-zinc-200 p-4 shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-800 leading-snug">{brief.name}</p>
          {brief.campaign && <p className="text-xs text-zinc-500 mt-0.5 truncate">{brief.campaign}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {typeInfo && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white" style={{ backgroundColor: typeInfo.color }}>
            {typeInfo.id}
          </span>
        )}
        {isRevisions && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-red-100 text-red-700">
            Revisions requested
          </span>
        )}
        {!hasDraft && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-zinc-100 text-zinc-500">
            Awaiting draft link
          </span>
        )}
      </div>

      {/* Edit / comment button */}
      <button
        onClick={onOpen}
        className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
      >
        <MessageSquare className="h-3 w-3" />
        View Brief & Comment
      </button>

      {/* View Draft + Approve */}
      <div className="flex gap-2">
        {hasDraft ? (
          <a
            href={brief.draft_url!}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: clientColor }}
          >
            <ExternalLink className="h-3 w-3" />
            View Draft
          </a>
        ) : (
          <button
            disabled
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 py-2 text-xs font-medium text-zinc-400 cursor-not-allowed"
          >
            <Play className="h-3 w-3" />
            View Draft
          </button>
        )}

        <button
          onClick={approve}
          disabled={approving || !reviewMode}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium transition-colors ${
            reviewMode && hasDraft
              ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
              : 'border-zinc-200 text-zinc-400 cursor-not-allowed'
          }`}
        >
          {approving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
          Approved ✓
        </button>
      </div>

      {/* Request revisions (only in review mode with a draft) */}
      {reviewMode && hasDraft && !isRevisions && (
        <button
          onClick={requestRevisions}
          disabled={revisioning}
          className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-red-200 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
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
    <div className="rounded-xl bg-white border border-zinc-200 p-3 shadow-sm">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: clientColor }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-800 leading-snug truncate">{brief.name}</p>
          {brief.campaign && <p className="text-xs text-zinc-400 mt-0.5">{brief.campaign}</p>}
          {typeInfo && (
            <span className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium text-white" style={{ backgroundColor: typeInfo.color }}>
              {typeInfo.id}
            </span>
          )}
        </div>
        {brief.draft_url && (
          <a href={brief.draft_url} target="_blank" rel="noopener noreferrer"
            className="text-zinc-400 hover:text-zinc-600 transition-colors flex-shrink-0">
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
      .eq('is_internal', false) // clients only see non-internal comments
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
      is_internal: false, // client comments are never internal
    })
    setNewComment('')
    setSending(false)
  }

  const typeInfo = CONTENT_TYPES.find(t => t.id === brief.content_type)
  const hasDraft = !!brief.draft_url
  const isReview = brief.pipeline_status === 'client_review'
  const isApproved = brief.pipeline_status === 'approved'

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full">

        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-100 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {brief.campaign && <p className="text-xs text-zinc-400 mb-0.5">{brief.campaign}</p>}
              <h2 className="font-semibold text-zinc-900 leading-snug">{brief.name}</h2>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {typeInfo && (
                  <span className="text-[10px] font-medium rounded-full px-2 py-0.5 text-white" style={{ backgroundColor: typeInfo.color }}>
                    {typeInfo.id}
                  </span>
                )}
                {isApproved && (
                  <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 text-white" style={{ backgroundColor: clientColor }}>
                    Approved ✓
                  </span>
                )}
                {isReview && (
                  <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-blue-100 text-blue-700">
                    Ready for Review
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Draft link */}
          {hasDraft ? (
            <a
              href={brief.draft_url!}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white w-full hover:opacity-90 transition-opacity"
              style={{ backgroundColor: clientColor }}
            >
              <ExternalLink className="h-4 w-4" />
              View Draft
            </a>
          ) : (
            <div className="mt-3 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-400 bg-zinc-100 w-full">
              <Clock className="h-4 w-4" />
              Draft coming soon
            </div>
          )}

          {/* Approve + Request Revisions */}
          {isReview && hasDraft && !isApproved && (
            <div className="flex gap-2 mt-2">
              <button
                onClick={onRequestRevisions}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-red-200 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Request Revisions
              </button>
              <button
                onClick={onApprove}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold text-white bg-green-600 hover:opacity-90 transition-opacity"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approve
              </button>
            </div>
          )}
        </div>

        {/* Brief description */}
        {brief.description && (
          <div className="px-5 py-4 border-b border-zinc-100 flex-shrink-0">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Brief</p>
            <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed bg-zinc-50 rounded-xl p-3 border border-zinc-100">
              {brief.description}
            </p>
          </div>
        )}

        {/* Comments */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="px-5 py-2 border-b border-zinc-100 flex-shrink-0">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
              Comments {comments.length > 0 && `(${comments.length})`}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {comments.map(c => (
              <div key={c.id} className="rounded-xl bg-zinc-50 border border-zinc-100 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-zinc-700">{c.user_name || 'Team'}</span>
                  <span className="text-[10px] text-zinc-400">{format(new Date(c.created_at), 'd MMM · h:mm a')}</span>
                </div>
                <p className="text-xs text-zinc-600 leading-relaxed">{c.content}</p>
              </div>
            ))}
            {comments.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <MessageSquare className="h-5 w-5 text-zinc-300 mb-2" />
                <p className="text-xs text-zinc-400">No comments yet — leave feedback below</p>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="border-t border-zinc-100 p-4 flex-shrink-0">
            <form onSubmit={sendComment} className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Leave feedback or ask a question…"
                className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-[#14C29F] focus:ring-[#14C29F]/20"
              />
              <button
                type="submit"
                disabled={sending || !newComment.trim()}
                className="rounded-xl px-3 py-2 text-white disabled:opacity-50"
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

function CreateBriefModal({ clientId, clientColor, onClose, onCreated }: {
  clientId: string
  clientColor: string
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName]               = useState('')
  const [description, setDesc]        = useState('')
  const [campaign, setCampaign]       = useState('')
  const [contentType, setContentType] = useState('')
  const [saving, setSaving]           = useState(false)

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
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-zinc-900">New Brief</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wide block mb-1.5">Brief Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="e.g. Summer Sale Banner"
              className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-[#14C29F] focus:ring-[#14C29F]/20"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wide block mb-1.5">Campaign / Context</label>
            <input
              type="text"
              value={campaign}
              onChange={e => setCampaign(e.target.value)}
              placeholder="e.g. Summer 2025"
              className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-[#14C29F] focus:ring-[#14C29F]/20"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wide block mb-1.5">Content Type</label>
            <div className="flex gap-2 flex-wrap">
              {CONTENT_TYPES.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setContentType(contentType === t.id ? '' : t.id)}
                  className={`rounded-full px-3 py-1 text-xs font-medium border transition-all ${
                    contentType === t.id ? 'text-white border-transparent' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'
                  }`}
                  style={contentType === t.id ? { backgroundColor: t.color } : {}}
                >
                  {t.id}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wide block mb-1.5">Brief Details</label>
            <textarea
              value={description}
              onChange={e => setDesc(e.target.value)}
              rows={4}
              placeholder="Describe what you need, any specific requirements, references…"
              className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-[#14C29F] focus:ring-[#14C29F]/20 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ backgroundColor: clientColor }}
          >
            {saving ? 'Submitting…' : 'Submit Brief'}
          </button>
        </form>
      </div>
    </div>
  )
}
