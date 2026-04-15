'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import {
  CheckCircle2, Play, Plus, X, Send, ExternalLink,
  MessageSquare, RotateCcw, Loader2, ChevronDown, Clock,
  Video, Image, Mail, LayoutGrid, Mic, FileText, CircleDot,
  GripVertical, Upload, Trash2, AtSign, Pencil, Check,
} from 'lucide-react'
import { DragDropContext, Droppable, Draggable, DropResult, DraggableProvidedDragHandleProps } from '@hello-pangea/dnd'
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
  sizes?: string[] | null
  ref_url?: string | null
}

interface Comment {
  id: string
  content: string
  user_name: string | null
  user_email: string | null
  user_id: string | null
  is_internal: boolean
  created_at: string
}

interface MentionUser {
  id: string
  name: string
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

  const { clientId, clientConfig, isAdmin, isStaff, setClientId, loading: clientLoading } = useActiveClient()
  const clientColor = clientConfig.color

  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    if (searchParams.get('newBrief') === '1') {
      setShowBriefModal(true)
      router.replace('/trello')
    }
  }, [searchParams, router])

  // Deep-link: open a specific brief from a notification link (?briefId=&clientId=)
  const [pendingBriefId, setPendingBriefId] = useState<string | null>(null)
  useEffect(() => {
    const bid = searchParams.get('briefId')
    const cid = searchParams.get('clientId')
    if (bid) {
      setPendingBriefId(bid)
      // Switch to the right client if staff/admin are coming from a notification
      if (cid && (isAdmin || isStaff)) setClientId(cid)
      router.replace('/trello')
    }
  }, [searchParams, router, isAdmin, isStaff, setClientId])

  useEffect(() => {
    if (pendingBriefId && briefs.length > 0) {
      const found = briefs.find(b => b.id === pendingBriefId)
      if (found) { setSelectedBrief(found); setPendingBriefId(null) }
    }
  }, [briefs, pendingBriefId])

  async function load(cid: string, silent = false) {
    if (!silent) setLoading(true)
    const supabase = createClient()
    const { data: briefData } = await supabase
      .from('briefs')
      .select('*')
      .eq('client_id', cid)
      .order('sort_order', { ascending: true })

    const all = briefData ?? []

    // Enforce: only 1 brief in production at a time — move extras back to backlog
    const inProd = all.filter(b => ['in_production','client_review','qa_review'].includes(b.pipeline_status))
    if (inProd.length > 1) {
      const toBacklog = inProd.slice(1)
      await Promise.all(toBacklog.map(b =>
        supabase.from('briefs').update({ pipeline_status: 'backlog', internal_status: 'backlog' }).eq('id', b.id)
      ))
      toBacklog.forEach(b => { b.pipeline_status = 'backlog'; b.internal_status = 'backlog' })
    }

    setBriefs(all)
    // Keep selectedBrief in sync so edits on the client portal appear on the hub in real-time
    setSelectedBrief(prev => {
      if (!prev) return null
      const updated = all.find(b => b.id === prev.id)
      return updated ?? prev
    })
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
    const { source, destination, draggableId } = result
    if (!destination) return
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    const supabase = createClient()

    // ── Reorder within Backlog ──
    if (source.droppableId === 'backlog' && destination.droppableId === 'backlog') {
      const items = Array.from(backlogOrder)
      const [moved] = items.splice(source.index, 1)
      items.splice(destination.index, 0, moved)
      setBacklogOrder(items)
      await Promise.all(items.map((b, i) => supabase.from('briefs').update({ sort_order: i }).eq('id', b.id)))
      return
    }

    // ── Backlog → In Production ──
    if (source.droppableId === 'backlog' && destination.droppableId === 'in-production') {
      const currentInProd = briefs.filter(b => ['in_production','client_review','qa_review'].includes(b.pipeline_status))
      // Swap existing production brief back to backlog
      if (currentInProd.length > 0) {
        await Promise.all(currentInProd.map(b =>
          supabase.from('briefs').update({ pipeline_status: 'backlog', internal_status: 'backlog' }).eq('id', b.id)
        ))
      }
      await supabase.from('briefs')
        .update({ pipeline_status: 'in_production', internal_status: 'in_production' })
        .eq('id', draggableId)
      setBriefs(prev => prev.map(b => {
        if (currentInProd.find(p => p.id === b.id)) return { ...b, pipeline_status: 'backlog', internal_status: 'backlog' }
        if (b.id === draggableId) return { ...b, pipeline_status: 'in_production', internal_status: 'in_production' }
        return b
      }))
      return
    }

    // ── In Production → Backlog ──
    if (source.droppableId === 'in-production' && destination.droppableId === 'backlog') {
      await supabase.from('briefs')
        .update({ pipeline_status: 'backlog', internal_status: 'backlog' })
        .eq('id', draggableId)
      setBriefs(prev => prev.map(b =>
        b.id === draggableId ? { ...b, pipeline_status: 'backlog', internal_status: 'backlog' } : b
      ))
      return
    }
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
    console.log('[cover] handleCoverUpload called', { briefId, file: file?.name, size: file?.size })
    if (!file) { console.warn('[cover] no file, aborting'); return }

    const MAX_MB = 10
    if (file.size > MAX_MB * 1024 * 1024) {
      alert(`Image is too large. Please choose a file under ${MAX_MB}MB.`)
      return
    }

    const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    if (!ACCEPTED_TYPES.includes(file.type)) {
      alert(`Unsupported file type "${file.type}". Please upload a JPG, PNG, WebP, or GIF.`)
      return
    }

    // Compress image to max 800px wide, 0.82 quality JPEG before uploading
    let compressed: Blob
    try {
      compressed = await new Promise<Blob>((resolve, reject) => {
        const img = document.createElement('img')
        const url = URL.createObjectURL(file)
        img.onload = () => {
          URL.revokeObjectURL(url)
          const MAX = 800
          const scale = img.width > MAX ? MAX / img.width : 1
          const canvas = document.createElement('canvas')
          canvas.width  = Math.round(img.width  * scale)
          canvas.height = Math.round(img.height * scale)
          const ctx = canvas.getContext('2d')!
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          canvas.toBlob(b => b ? resolve(b) : reject(new Error('Compression failed')), 'image/jpeg', 0.82)
        }
        img.onerror = (e) => reject(new Error(`Image load error: ${e}`))
        img.src = url
      })
      console.log('[cover] compressed size:', compressed.size)
    } catch (compressErr) {
      console.error('[cover] compression failed:', compressErr)
      alert(`Image compression failed: ${compressErr}`)
      return
    }

    const supabase = createClient()
    const path = `brief-covers/${briefId}.jpg`
    console.log('[cover] uploading to storage path:', path)

    const { error: uploadError } = await supabase.storage
      .from('brief-assets')
      .upload(path, compressed, { upsert: true, contentType: 'image/jpeg' })
    if (uploadError) {
      console.error('[cover] storage upload error:', uploadError)
      alert(`Cover upload failed: ${uploadError.message}`)
      return
    }
    console.log('[cover] storage upload success')

    // Cache-bust the URL so the card re-renders with the new image
    const { data: { publicUrl } } = supabase.storage.from('brief-assets').getPublicUrl(path)
    const bustedUrl = `${publicUrl}?t=${Date.now()}`
    console.log('[cover] public URL:', bustedUrl)

    const { error: updateError } = await supabase.from('briefs').update({ cover_url: bustedUrl }).eq('id', briefId)
    if (updateError) {
      console.error('[cover] DB update error:', updateError)
      alert(`Saved image but couldn't update the brief: ${updateError.message}`)
      return
    }
    console.log('[cover] DB updated — setting state')
    setBriefs(prev => prev.map(b => b.id === briefId ? { ...b, cover_url: bustedUrl } : b))
    setSelectedBrief(prev => prev?.id === briefId ? { ...prev, cover_url: bustedUrl } : prev)
  }

  async function handleCoverDelete(briefId: string) {
    const supabase = createClient()
    // Remove from storage (best-effort)
    await supabase.storage.from('brief-assets').remove([`brief-covers/${briefId}.jpg`])
    // Clear DB field
    await supabase.from('briefs').update({ cover_url: null }).eq('id', briefId)
    setBriefs(prev => prev.map(b => b.id === briefId ? { ...b, cover_url: null } : b))
    setSelectedBrief(prev => prev?.id === briefId ? { ...prev, cover_url: null } : prev)
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
                              onCoverDelete={() => handleCoverDelete(brief.id)}
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
              <Droppable droppableId="in-production">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="p-3 space-y-3 min-h-[300px]"
                  >
                    {inProduction.map((brief, index) => (
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
                              reviewMode
                              dragHandleProps={provided.dragHandleProps}
                              isDragging={snapshot.isDragging}
                              onOpen={() => !snapshot.isDragging && setSelectedBrief(brief)}
                              onApprove={() => handleApprove(brief.id)}
                              onRequestRevisions={() => handleRequestRevisions(brief.id)}
                              onCoverUpload={(file) => handleCoverUpload(brief.id, file)}
                              onCoverDelete={() => handleCoverDelete(brief.id)}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {inProduction.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 py-12 text-center">
                        <p className="text-xs text-gray-400">Nothing in production yet</p>
                        <p className="text-[11px] text-gray-300 mt-1">Drag a brief here or approve one</p>
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
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
            onCoverUpload={(file) => handleCoverUpload(selectedBrief.id, file)}
            onCoverDelete={() => handleCoverDelete(selectedBrief.id)}
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

function BriefCard({ brief, clientColor, reviewMode, dragHandleProps, isDragging, onOpen, onApprove, onRequestRevisions, onCoverUpload, onCoverDelete }: {
  brief: Brief
  clientColor: string
  reviewMode?: boolean
  dragHandleProps?: DraggableProvidedDragHandleProps | null
  isDragging?: boolean
  onOpen: () => void
  onApprove: () => void
  onRequestRevisions: () => void
  onCoverUpload?: (file: File | null) => void
  onCoverDelete?: () => void
}) {
  const [approving, setApproving]           = useState(false)
  const [revisioning, setRevisioning]       = useState(false)
  const [coverHover, setCoverHover]         = useState(false)
  const [coverMenuOpen, setCoverMenuOpen]   = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const coverMenuRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Close cover menu on outside click
  useEffect(() => {
    if (!coverMenuOpen) return
    function handler(e: MouseEvent) {
      if (coverMenuRef.current && !coverMenuRef.current.contains(e.target as Node)) {
        setCoverMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [coverMenuOpen])
  const typeInfo    = CONTENT_TYPES.find(t => t.id === brief.content_type)
  const hasDraft    = !!brief.draft_url
  const isRevisions = brief.internal_status === 'revisions_required'

  async function handleCoverChange(file: File | null) {
    if (!file || !onCoverUpload) return
    setUploadingCover(true)
    await onCoverUpload(file)
    setUploadingCover(false)
  }

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
      className={`rounded-2xl bg-white p-4 cursor-pointer transition-all ${isDragging ? 'rotate-1 scale-105' : 'border border-gray-100 shadow-sm hover:shadow-md'}`}
      style={isDragging ? {
        boxShadow: `0 0 0 2px ${clientColor}, 0 20px 40px ${clientColor}55, 0 8px 24px rgba(0,0,0,0.15)`,
      } : {}}
      onClick={onOpen}
    >
      {/* Drag handle row */}
      {dragHandleProps && (
        <div className="flex items-center justify-end mb-1.5" onClick={e => e.stopPropagation()}>
          <div
            {...dragHandleProps}
            className="cursor-grab active:cursor-grabbing p-1 rounded-lg text-gray-200 hover:text-gray-400 transition-colors"
          >
            <GripVertical className="h-4 w-4" />
          </div>
        </div>
      )}

      {/* Thumbnail / Cover */}
      <div
        className="relative h-28 rounded-xl mb-3 overflow-hidden"
        onClick={e => e.stopPropagation()}
        onMouseEnter={() => setCoverHover(true)}
        onMouseLeave={() => setCoverHover(false)}
      >
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

        {/* File input — always mounted so it survives the OS file-picker focus loss */}
        {onCoverUpload && (
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={e => {
              setCoverMenuOpen(false)
              const file = e.target.files?.[0] ?? null
              // Reset so the same file can be re-selected next time
              e.target.value = ''
              handleCoverChange(file)
            }}
          />
        )}

        {/* Upload loading overlay */}
        {uploadingCover && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Loader2 className="h-5 w-5 text-white animate-spin" />
          </div>
        )}

        {/* Cover action button — show on hover */}
        {onCoverUpload && coverHover && !uploadingCover && (
          <div
            className="absolute bottom-2 right-2"
            ref={coverMenuRef}
            onClick={e => e.stopPropagation()}
          >
            <button
              className="rounded-lg bg-black/70 px-2 py-1 flex items-center gap-1 hover:bg-black/85 transition-colors"
              onClick={() => setCoverMenuOpen(v => !v)}
            >
              <Upload className="h-3 w-3 text-white" />
              <span className="text-[10px] font-semibold text-white">Cover</span>
              <ChevronDown className="h-3 w-3 text-white" />
            </button>

            {coverMenuOpen && (
              <div className="absolute bottom-full mb-1 right-0 w-44 rounded-xl bg-white border border-zinc-200 shadow-xl overflow-hidden z-20">
                <button
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5 text-zinc-400" />
                  {brief.cover_url ? 'Replace cover' : 'Upload cover'}
                </button>
                {brief.cover_url && onCoverDelete && (
                  <button
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors"
                    onClick={() => { setCoverMenuOpen(false); onCoverDelete() }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete cover
                  </button>
                )}
              </div>
            )}
          </div>
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

function BriefPanel({ brief, clientColor, onClose, onApprove, onRequestRevisions, onCoverUpload, onCoverDelete }: {
  brief: Brief
  clientColor: string
  onClose: () => void
  onApprove: () => void
  onRequestRevisions: () => void
  onCoverUpload?: (file: File) => void
  onCoverDelete?: () => void
}) {
  const coverFileRef = useRef<HTMLInputElement>(null)
  // ── Comment state ──
  const [comments, setComments]             = useState<Comment[]>([])
  const [newComment, setNewComment]         = useState('')
  const [sending, setSending]               = useState(false)
  const [commentError, setCommentError]     = useState<string | null>(null)
  const [currentUserId, setCurrentUserId]   = useState<string | null>(null)
  const [hoveredCommentId, setHoveredCommentId] = useState<string | null>(null)
  const [editingId, setEditingId]           = useState<string | null>(null)
  const [editText, setEditText]             = useState('')
  const [savingEdit, setSavingEdit]         = useState(false)
  const [mentionUsers, setMentionUsers]     = useState<MentionUser[]>([])
  const [mentionOpen, setMentionOpen]       = useState(false)
  const [mentionQuery, setMentionQuery]     = useState('')
  const [mentionStart, setMentionStart]     = useState(0)
  const endRef   = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Derived from brief prop (used before state hooks so declared early)
  const isReview   = ['in_production', 'client_review', 'qa_review'].includes(brief.pipeline_status)
  const isApproved = brief.pipeline_status === 'approved'
  const hasDraft   = !!brief.draft_url
  const typeInfo   = CONTENT_TYPES.find(t => t.id === brief.content_type)


  // ── Editable brief fields ──
  const [localName, setLocalName]           = useState(brief.name)
  const [localDesc, setLocalDesc]           = useState(brief.description ?? '')
  const [localCampaign, setLocalCampaign]   = useState(brief.campaign ?? '')
  const [localType, setLocalType]           = useState(brief.content_type ?? '')
  const [localSizes, setLocalSizes]         = useState<string[]>(brief.sizes ?? [])
  const [localRefUrl, setLocalRefUrl]       = useState(brief.ref_url ?? '')
  const [localDueDate, setLocalDueDate]     = useState(brief.due_date ?? '')
  const [editingField, setEditingField]     = useState<string | null>(null)
  const [savingField, setSavingField]       = useState<string | null>(null)

  // Re-sync local fields when the brief prop is updated from outside (e.g. real-time hub sync)
  useEffect(() => {
    if (editingField !== 'name')         setLocalName(brief.name)
    if (editingField !== 'description')  setLocalDesc(brief.description ?? '')
    if (editingField !== 'campaign')     setLocalCampaign(brief.campaign ?? '')
    if (editingField !== 'content_type') setLocalType(brief.content_type ?? '')
    if (editingField !== 'sizes')        setLocalSizes(brief.sizes ?? [])
    if (editingField !== 'ref_url')      setLocalRefUrl(brief.ref_url ?? '')
    if (editingField !== 'due_date')     setLocalDueDate(brief.due_date ?? '')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brief])

  async function saveField(field: string, value: unknown) {
    setSavingField(field)
    const supabase = createClient()
    await supabase.from('briefs').update({ [field]: value || null }).eq('id', brief.id)
    setSavingField(null)
    setEditingField(null)
  }

  function toggleSize(s: string) {
    const next = localSizes.includes(s) ? localSizes.filter(x => x !== s) : [...localSizes, s]
    setLocalSizes(next)
    saveField('sizes', next.length ? next : null)
  }

  // Load current user + mentionable users
  useEffect(() => {
    async function loadUsers() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setCurrentUserId(user.id)
      // Fetch all profiles with same client + all staff/admin
      const { data } = await supabase
        .from('profiles')
        .select('id, name')
        .or(`client_id.eq.${brief.client_id},is_staff.eq.true,is_admin.eq.true`)
      setMentionUsers(
        (data ?? [])
          .filter((p: any) => p.name && p.id !== user?.id)
          .map((p: any) => ({ id: p.id, name: p.name }))
      )
    }
    loadUsers()
  }, [brief.client_id])

  async function loadComments() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('brief_comments')
      .select('*')
      .eq('brief_id', brief.id)
      .neq('is_internal', true)   // show everything that isn't explicitly internal
      .order('created_at', { ascending: true })
    if (error) console.error('loadComments error:', error)
    setComments((data as Comment[]) ?? [])
  }

  useEffect(() => {
    loadComments()
    const supabase = createClient()
    const channel = supabase
      .channel(`client-comments-${brief.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'brief_comments',
        filter: `brief_id=eq.${brief.id}`,
      }, () => loadComments())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brief.id])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [comments])

  function handleCommentChange(value: string) {
    setNewComment(value)
    // Detect @mention trigger
    const cursorPos = inputRef.current?.selectionStart ?? value.length
    const textBefore = value.slice(0, cursorPos)
    const atMatch = textBefore.match(/@(\w*)$/)
    if (atMatch) {
      setMentionQuery(atMatch[1])
      setMentionStart(cursorPos - atMatch[0].length)
      setMentionOpen(true)
    } else {
      setMentionOpen(false)
    }
  }

  function insertMention(user: MentionUser) {
    const before = newComment.slice(0, mentionStart)
    const after  = newComment.slice(mentionStart + mentionQuery.length + 1)
    const mention = `@${user.name} `
    setNewComment(before + mention + after)
    setMentionOpen(false)
    setTimeout(() => inputRef.current?.focus(), 10)
  }

  async function handleDeleteComment(id: string) {
    const supabase = createClient()
    await supabase.from('brief_comments').delete().eq('id', id)
    await loadComments()
  }

  async function handleSaveEdit(id: string) {
    if (!editText.trim()) return
    setSavingEdit(true)
    const supabase = createClient()
    await supabase.from('brief_comments').update({ content: editText.trim() }).eq('id', id)
    setEditingId(null)
    setSavingEdit(false)
    await loadComments()
  }

  async function sendComment(e: React.FormEvent) {
    e.preventDefault()
    if (!newComment.trim() || sending) return
    setSending(true)
    setMentionOpen(false)
    const text = newComment.trim()
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile }  = await supabase.from('profiles').select('name').eq('id', user!.id).single()
    const authorName = profile?.name ?? user?.email?.split('@')[0] ?? 'Someone'

    const { error: commentError } = await supabase.from('brief_comments').insert({
      brief_id:    brief.id,
      content:     text,
      user_id:     user?.id,
      user_email:  user?.email,
      user_name:   authorName,
      is_internal: false,
    })

    if (commentError) {
      console.error('Comment insert error:', commentError)
      setCommentError(
        commentError.code === '42P01'
          ? "The comments table doesn't exist yet — run the SQL setup in Supabase."
          : `Failed to send: ${commentError.message}`
      )
      setSending(false)
      return
    }

    // Comment saved — clear input and force reload immediately (don't wait for realtime)
    setCommentError(null)
    setNewComment('')
    setSending(false)
    await loadComments()

    // Fire notification — appears in bell for ALL users on both portals
    try {
      const snippet = text.length > 80 ? text.slice(0, 80) + '…' : text
      const link    = `/trello?briefId=${brief.id}&clientId=${brief.client_id}`
      const { error: notifError } = await supabase.from('notifications').insert({
        message:  `💬 ${authorName} commented on "${brief.name}": ${snippet}`,
        type:     'comment',
        link,
        resolved: false,
      })
      if (notifError) console.warn('Notification insert failed:', notifError.message)
    } catch (err) {
      console.warn('Notification insert failed:', err)
    }
  }

  const filteredMentions = mentionUsers.filter(u =>
    u.name.toLowerCase().includes(mentionQuery.toLowerCase())
  )


  function getInitials(name: string | null) {
    if (!name) return '?'
    const parts = name.trim().split(' ')
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase()
  }

  function renderCommentContent(content: string) {
    // Highlight @mentions in blue
    const parts = content.split(/(@\w+)/g)
    return parts.map((part, i) =>
      part.startsWith('@')
        ? <span key={i} className="font-semibold text-blue-500">{part}</span>
        : <span key={i}>{part}</span>
    )
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden" style={{ maxHeight: '90vh' }}>

        {/* ── Cover image (Trello-style banner) ── */}
        {brief.cover_url && (
          <div className="relative flex-shrink-0 h-44 w-full overflow-hidden rounded-t-2xl group/coverpanel">
            <img src={brief.cover_url} alt="" className="w-full h-full object-cover" />
            {/* dark scrim so header text stays readable */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/40" />
            {/* Cover actions — top right */}
            {onCoverUpload && (
              <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover/coverpanel:opacity-100 transition-opacity">
                <button
                  onClick={() => coverFileRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-lg bg-black/60 hover:bg-black/80 px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors backdrop-blur-sm"
                >
                  <Upload className="h-3 w-3" /> Replace
                </button>
                {onCoverDelete && (
                  <button
                    onClick={onCoverDelete}
                    className="flex items-center gap-1.5 rounded-lg bg-black/60 hover:bg-red-600/80 px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors backdrop-blur-sm"
                  >
                    <Trash2 className="h-3 w-3" /> Remove
                  </button>
                )}
              </div>
            )}
            <input
              ref={coverFileRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file && onCoverUpload) onCoverUpload(file)
              }}
            />
          </div>
        )}

        {/* ── Header bar (brand colour) ── */}
        <div className="flex-shrink-0 px-8 py-6 flex items-start justify-between" style={{ backgroundColor: clientColor }}>
          <div className="flex-1 min-w-0">
            {brief.campaign && (
              <p className="text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.65)' }}>{brief.campaign}</p>
            )}
            <h2 className="text-xl font-bold text-white leading-snug">{brief.name}</h2>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {typeInfo && (
                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold bg-white/20 text-white">
                  <typeInfo.icon className="h-3 w-3" />
                  {typeInfo.id}
                </span>
              )}
              {isApproved && (
                <span className="rounded-full px-3 py-1 text-[11px] font-semibold bg-emerald-400/30 text-white">Approved ✓</span>
              )}
              {isReview && !isApproved && (
                <span className="rounded-full px-3 py-1 text-[11px] font-semibold bg-white/20 text-white">In Production</span>
              )}
              {brief.due_date && (
                <span className="rounded-full px-3 py-1 text-[11px] font-medium bg-white/10 text-white/80">
                  Due {format(new Date(brief.due_date), 'd MMM yyyy')}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="ml-4 flex-shrink-0 rounded-xl p-2 text-white/60 hover:text-white hover:bg-white/10 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Body: two columns ── */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* ── LEFT: Editable brief details ── */}
          <div className="w-[52%] flex-shrink-0 border-r border-gray-100 overflow-y-auto">
            <div className="p-6 space-y-6">

              {/* Draft / action buttons */}
              <div className="space-y-2">
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
                  <div className="space-y-1.5">
                    {isReview && (
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Current Status</p>
                    )}
                    <div
                      className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium bg-gray-50 border border-dashed w-full"
                      style={isReview
                        ? { borderColor: `${clientColor}60`, color: clientColor }
                        : { borderColor: '#e5e7eb', color: '#9ca3af' }}
                    >
                      {isReview ? (
                        <>
                          <span className="relative flex h-2 w-2 flex-shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: clientColor }} />
                            <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: clientColor }} />
                          </span>
                          <span>We&apos;re working on it right now</span>
                        </>
                      ) : (
                        <>
                          <Clock className="h-4 w-4" />
                          Draft coming soon
                        </>
                      )}
                    </div>
                  </div>
                )}
                {isReview && hasDraft && !isApproved && (
                  <div className="flex gap-2">
                    <button onClick={onRequestRevisions}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-red-100 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors">
                      <RotateCcw className="h-3.5 w-3.5" /> Request Revisions
                    </button>
                    <button onClick={onApprove}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-600 transition-colors">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                    </button>
                  </div>
                )}
              </div>

              {/* ── Description ── */}
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Description</p>
                <textarea
                  rows={6}
                  value={localDesc}
                  onChange={e => setLocalDesc(e.target.value)}
                  onFocus={() => setEditingField('description')}
                  onBlur={() => { if (editingField === 'description') saveField('description', localDesc) }}
                  placeholder="Add a more detailed description…"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all resize-none hover:border-gray-300"
                  style={{ '--tw-ring-color': clientColor } as React.CSSProperties}
                />
                {savingField === 'description' && (
                  <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1"><Loader2 className="h-2.5 w-2.5 animate-spin" /> Saving…</p>
                )}
              </div>

              {/* ── Custom Fields ── */}
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Details</p>
                <div className="space-y-3">

                  {/* Campaign Name */}
                  <div className="grid grid-cols-[120px_1fr] items-center gap-3">
                    <span className="text-xs font-medium text-gray-500">Campaign</span>
                    <input
                      type="text"
                      value={localCampaign}
                      onChange={e => setLocalCampaign(e.target.value)}
                      onFocus={() => setEditingField('campaign')}
                      onBlur={() => { if (editingField === 'campaign') saveField('campaign', localCampaign) }}
                      placeholder="Add campaign name…"
                      className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent hover:border-gray-300 transition-all w-full"
                      style={{ '--tw-ring-color': clientColor } as React.CSSProperties}
                    />
                  </div>

                  {/* Due Date */}
                  <div className="grid grid-cols-[120px_1fr] items-center gap-3">
                    <span className="text-xs font-medium text-gray-500">Due Date</span>
                    <input
                      type="date"
                      value={localDueDate}
                      onChange={e => { setLocalDueDate(e.target.value); saveField('due_date', e.target.value) }}
                      className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:border-transparent hover:border-gray-300 transition-all w-full"
                      style={{ '--tw-ring-color': clientColor } as React.CSSProperties}
                    />
                  </div>

                  {/* Link to Inspiration */}
                  <div className="grid grid-cols-[120px_1fr] items-center gap-3">
                    <span className="text-xs font-medium text-gray-500">Inspiration</span>
                    <input
                      type="url"
                      value={localRefUrl}
                      onChange={e => setLocalRefUrl(e.target.value)}
                      onFocus={() => setEditingField('ref_url')}
                      onBlur={() => { if (editingField === 'ref_url') saveField('ref_url', localRefUrl) }}
                      placeholder="https://…"
                      className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent hover:border-gray-300 transition-all w-full"
                      style={{ '--tw-ring-color': clientColor } as React.CSSProperties}
                    />
                  </div>
                </div>
              </div>

              {/* ── Content Type ── */}
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Content Type</p>
                <div className="flex flex-wrap gap-2">
                  {CONTENT_TYPES.map(t => {
                    const active = localType === t.id
                    return (
                      <button
                        key={t.id}
                        onClick={() => { setLocalType(t.id); saveField('content_type', t.id) }}
                        className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold border transition-all"
                        style={active
                          ? { backgroundColor: t.color, color: '#fff', borderColor: t.color }
                          : { backgroundColor: `${t.color}12`, color: t.color, borderColor: `${t.color}30` }
                        }
                      >
                        <t.icon className="h-3.5 w-3.5" />
                        {t.id}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ── Aspect Ratios / Sizes ── */}
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Aspect Ratios</p>
                <div className="flex flex-wrap gap-2">
                  {SIZES.map(s => {
                    const active = localSizes.includes(s)
                    return (
                      <button
                        key={s}
                        onClick={() => toggleSize(s)}
                        className="rounded-xl px-3 py-2 text-xs font-semibold border transition-all"
                        style={active
                          ? { backgroundColor: clientColor, color: '#fff', borderColor: clientColor }
                          : { backgroundColor: '#f9fafb', color: '#6b7280', borderColor: '#e5e7eb' }
                        }
                      >
                        {s}
                      </button>
                    )
                  })}
                </div>
              </div>

            </div>
          </div>

          {/* ── RIGHT: Comments ── */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {/* Comments header */}
            <div className="px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <p className="text-sm font-semibold text-gray-800">
                Comments {comments.length > 0 && <span className="text-gray-400 font-normal">({comments.length})</span>}
              </p>
            </div>

            {/* Comment list */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {comments.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <MessageSquare className="h-8 w-8 text-gray-200 mb-2" />
                  <p className="text-sm text-gray-400 font-medium">No comments yet</p>
                  <p className="text-xs text-gray-300 mt-1">Leave feedback or ask a question below</p>
                </div>
              )}
              {comments.map(c => {
                const isOwn     = c.user_id === currentUserId
                const isHovered = hoveredCommentId === c.id
                const isEditing = editingId === c.id
                return (
                  <div
                    key={c.id}
                    className="flex gap-3"
                    onMouseEnter={() => setHoveredCommentId(c.id)}
                    onMouseLeave={() => setHoveredCommentId(null)}
                  >
                    <div
                      className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: clientColor }}
                    >
                      {getInitials(c.user_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-sm font-semibold text-gray-800">{c.user_name || 'Team'}</span>
                        <span className="text-xs text-gray-400">{format(new Date(c.created_at), 'd MMM · h:mm a')}</span>
                        {isOwn && isHovered && !isEditing && (
                          <div className="ml-auto flex items-center gap-0.5">
                            <button
                              onClick={() => { setEditingId(c.id); setEditText(c.content ?? '') }}
                              className="p-1.5 rounded-lg text-gray-300 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                              title="Edit"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteComment(c.id)}
                              className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                      {isEditing ? (
                        <div>
                          <textarea
                            autoFocus
                            rows={2}
                            value={editText}
                            onChange={e => setEditText(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(c.id) }
                              if (e.key === 'Escape') setEditingId(null)
                            }}
                            className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                          />
                          <div className="flex items-center gap-2 mt-1.5">
                            <button
                              onClick={() => handleSaveEdit(c.id)}
                              disabled={savingEdit}
                              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                              style={{ backgroundColor: clientColor }}
                            >
                              {savingEdit ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                              Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl rounded-tl-sm bg-gray-50 border border-gray-100 px-4 py-3">
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {renderCommentContent(c.content ?? '')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              <div ref={endRef} />
            </div>

            {/* Comment input */}
            <div className="border-t border-gray-100 p-4 flex-shrink-0 relative">
              {mentionOpen && filteredMentions.length > 0 && (
                <div className="absolute bottom-full left-4 right-4 mb-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-10 max-h-36 overflow-y-auto">
                  {filteredMentions.map(u => (
                    <button
                      key={u.id}
                      type="button"
                      onMouseDown={e => { e.preventDefault(); insertMention(u) }}
                      className="flex items-center gap-2.5 w-full px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div
                        className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: clientColor }}
                      >
                        {getInitials(u.name)}
                      </div>
                      <span className="text-sm font-medium text-gray-700">{u.name}</span>
                    </button>
                  ))}
                </div>
              )}
              <form onSubmit={sendComment} className="flex gap-2 items-end">
                <div className="flex-1">
                  <textarea
                    ref={inputRef}
                    rows={2}
                    value={newComment}
                    onChange={e => handleCommentChange(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment(e as any) }
                      if (e.key === 'Escape') setMentionOpen(false)
                    }}
                    placeholder="Write a comment… (@ to mention)"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={sending || !newComment.trim()}
                  className="rounded-xl px-3 py-3 text-white disabled:opacity-40 shadow-sm transition-opacity hover:opacity-90 flex-shrink-0"
                  style={{ backgroundColor: clientColor }}
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </form>
              {commentError ? (
                <p className="text-xs text-red-500 mt-1.5 pl-1 font-medium">{commentError}</p>
              ) : (
                <p className="text-[10px] text-gray-400 mt-1.5 pl-1">
                  <AtSign className="inline h-2.5 w-2.5" /> to mention · Enter to send · Shift+Enter for new line
                </p>
              )}
            </div>
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
    // Check if production slot is currently empty
    const { data: inProd } = await supabase
      .from('briefs')
      .select('id')
      .eq('client_id', clientId)
      .in('pipeline_status', ['in_production','client_review','qa_review'])
    const productionEmpty = (inProd?.length ?? 0) === 0

    const refUrl = (refUrls ?? []).find(u => u.trim()) ?? null
    await supabase.from('briefs').insert({
      name:            name.trim(),
      description:     description.trim() || null,
      campaign:        campaign.trim() || null,
      content_type:    contentType || null,
      sizes:           sizes.length ? sizes : null,
      ref_url:         refUrl,
      client_id:       clientId,
      pipeline_status: productionEmpty ? 'in_production' : 'backlog',
      internal_status: productionEmpty ? 'in_production' : 'backlog',
      sort_order:      productionEmpty ? 0 : 9999,
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
