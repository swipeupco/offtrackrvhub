'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import {
  CheckCircle2, Play, Plus, X, Send, ExternalLink,
  MessageSquare, RotateCcw, Loader2, ChevronDown, Clock,
  Video, Image, Mail, LayoutGrid, Mic, FileText, CircleDot,
  Upload, Trash2, AtSign, Pencil, Check,
} from 'lucide-react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { useSearchParams, useRouter } from 'next/navigation'
import { useActiveClient } from '@/lib/active-client-context'
import { useTheme } from '@/lib/theme-context'
import TagUsersControl from '@/components/briefs/TagUsersControl'

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
  created_by?: string | null
  creator?: { id: string; name: string | null; avatar_url: string | null } | null
  tagged_users?: { id: string; name: string | null; avatar_url: string | null }[]
  cover_attachment?: BriefAttachment | null
}

interface BriefAttachment {
  id: string
  brief_id: string
  file_path: string
  file_name: string
  file_type: string
  file_size: number
  is_cover: boolean
  created_at: string
}

const ATTACHMENT_BUCKET = 'brief-attachments'
const ATTACHMENT_MAX_MB = 10
const ATTACHMENT_ACCEPT = 'image/jpeg,image/jpg,image/png,image/webp,image/gif,application/pdf'
const ATTACHMENT_MIME = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'application/pdf',
] as const

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

function initialsOf(name: string | null | undefined) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0].slice(0, 2).toUpperCase()
}

function attachmentPublicUrl(filePath: string): string {
  const supabase = createClient()
  const { data: { publicUrl } } = supabase.storage.from(ATTACHMENT_BUCKET).getPublicUrl(filePath)
  return publicUrl
}

function UserAvatar({
  user,
  size = 24,
  ring = false,
  tint = '#4950F8',
}: {
  user: { name: string | null; avatar_url: string | null } | null | undefined
  size?: number
  ring?: boolean
  tint?: string
}) {
  const title = user?.name ?? 'Unknown'
  return (
    <div
      title={title}
      className={`rounded-full flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0 ${ring ? 'ring-2 ring-white' : ''}`}
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.4), backgroundColor: tint }}
    >
      {user?.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatar_url} alt={title} className="h-full w-full object-cover" />
      ) : (
        initialsOf(user?.name)
      )}
    </div>
  )
}

function StackedAvatars({
  users,
  max = 3,
  size = 22,
  tint = '#4950F8',
}: {
  users: { id: string; name: string | null; avatar_url: string | null }[]
  max?: number
  size?: number
  tint?: string
}) {
  const visible = users.slice(0, max)
  const extra   = users.length - visible.length
  return (
    <div className="flex items-center">
      {visible.map((u, i) => (
        <div key={u.id} className={i === 0 ? '' : '-ml-2'}>
          <UserAvatar user={u} size={size} ring tint={tint} />
        </div>
      ))}
      {extra > 0 && (
        <div
          className="-ml-2 rounded-full ring-2 ring-white bg-gray-100 text-[10px] font-bold text-gray-600 flex items-center justify-center"
          style={{ width: size, height: size }}
          title={`${extra} more`}
        >
          +{extra}
        </div>
      )}
    </div>
  )
}

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
  const inProductionLimit = clientConfig.in_production_limit ?? 1

  // Lightweight toast — one message at a time, auto-dismiss after 3.5s.
  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = (msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(msg)
    toastTimerRef.current = setTimeout(() => setToast(null), 3500)
  }
  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current) }, [])

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
      .select('id, name, description, campaign, content_type, pipeline_status, internal_status, draft_url, due_date, client_id, sort_order, cover_url, sizes, ref_url, created_by')
      .eq('client_id', cid)
      .order('sort_order', { ascending: true })

    const all = (briefData ?? []) as Brief[]

    // Hub now enforces the in_production cap server-side via a Postgres
    // trigger (auto_promote_backlog). The old client-side "force extras back
    // to backlog" pass was a hardcoded limit-of-1 hack — it's wrong once the
    // limit is configurable, so we just render whatever the DB returns.

    // Enrich with creator + tagged users
    const briefIds   = all.map(b => b.id)
    const creatorIds = [...new Set(all.map(b => b.created_by).filter(Boolean))] as string[]

    const [tagsRes, creatorsRes, coversRes] = await Promise.all([
      briefIds.length
        ? supabase.from('brief_assigned_users').select('brief_id, user_id').in('brief_id', briefIds)
        : Promise.resolve({ data: [] as { brief_id: string; user_id: string }[] }),
      creatorIds.length
        ? supabase.from('profiles').select('id, name, avatar_url').in('id', creatorIds)
        : Promise.resolve({ data: [] as { id: string; name: string | null; avatar_url: string | null }[] }),
      briefIds.length
        ? supabase.from('brief_attachments').select('*').in('brief_id', briefIds).eq('is_cover', true)
        : Promise.resolve({ data: [] as BriefAttachment[] }),
    ])

    const coverByBrief: Record<string, BriefAttachment> = {}
    ;((coversRes.data as BriefAttachment[] | null) ?? []).forEach(a => { coverByBrief[a.brief_id] = a })

    const tagRows    = (tagsRes.data ?? []) as { brief_id: string; user_id: string }[]
    const taggedIds  = [...new Set(tagRows.map(r => r.user_id))]
    const profileIds = [...new Set([...creatorIds, ...taggedIds])]

    const profileMap: Record<string, { id: string; name: string | null; avatar_url: string | null }> = {}
    if (profileIds.length) {
      const seed = (creatorsRes.data ?? []) as { id: string; name: string | null; avatar_url: string | null }[]
      seed.forEach(p => { profileMap[p.id] = p })
      const missing = profileIds.filter(id => !profileMap[id])
      if (missing.length) {
        const { data: extra } = await supabase.from('profiles').select('id, name, avatar_url').in('id', missing)
        ;(extra ?? []).forEach(p => { profileMap[p.id] = p })
      }
    }

    const enriched = all.map(b => ({
      ...b,
      creator: b.created_by ? profileMap[b.created_by] ?? null : null,
      tagged_users: tagRows
        .filter(r => r.brief_id === b.id)
        .map(r => profileMap[r.user_id])
        .filter(Boolean),
      cover_attachment: coverByBrief[b.id] ?? null,
    }))

    setBriefs(enriched)
    // Keep selectedBrief in sync so edits on the client portal appear on the hub in real-time
    setSelectedBrief(prev => {
      if (!prev) return null
      const updated = enriched.find(b => b.id === prev.id)
      return updated ?? null  // null closes the modal if the brief was deleted
    })
    setLoading(false)
  }

  // Realtime: subscribe to brief inserts / updates / deletes scoped to the
  // active client. Hub-side server triggers (auto_promote_backlog, manual
  // status pushes) flow through here so the board reflects changes without a
  // refresh. Each filtered event triggers a silent refetch — pangea/dnd
  // animates the card transition because Draggable IDs are stable across
  // reloads.
  useEffect(() => {
    if (clientLoading) return
    if (!clientId) { setLoading(false); setBriefs([]); return }
    load(clientId)
    const supabase = createClient()
    const channel = supabase
      .channel(`client-briefs-live-${clientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'briefs',
          filter: `client_id=eq.${clientId}`,
        },
        () => load(clientId, true),
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
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

      // Cap enforcement: block the move when the In Production column is
      // already at capacity. Server-side auto-promote fills the column when
      // something gets approved; a manual drag shouldn't bypass the cap.
      if (currentInProd.length >= inProductionLimit) {
        showToast('In Production is full. Complete an existing brief first, or contact us to increase your limit.')
        return
      }

      await supabase.from('briefs')
        .update({ pipeline_status: 'in_production', internal_status: 'in_production' })
        .eq('id', draggableId)
      setBriefs(prev => prev.map(b => {
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

  async function handleDeleteBrief(briefId: string) {
    const supabase = createClient()

    // Delete related records first (cascade handles DB-side too, this is belt-and-suspenders)
    await supabase.from('brief_comments').delete().eq('brief_id', briefId)
    await supabase.from('notifications').delete().eq('link', `/trello?briefId=${briefId}`)

    // Remove cover from storage (best-effort)
    await supabase.storage.from('brief-assets').remove([`brief-covers/${briefId}.jpg`])

    // Delete the brief itself
    const { error } = await supabase.from('briefs').delete().eq('id', briefId)
    if (error) {
      console.error('Failed to delete brief:', error)
      alert(`Could not delete brief: ${error.message}`)
      return
    }

    setBriefs(prev => prev.filter(b => b.id !== briefId))
    setSelectedBrief(null)
  }

  async function handleCoverUpload(briefId: string, file: File | null) {
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
    } catch (compressErr) {
      console.error('[cover] compression failed:', compressErr)
      alert(`Image compression failed: ${compressErr}`)
      return
    }

    const supabase = createClient()
    const path = `brief-covers/${briefId}.jpg`

    const { error: uploadError } = await supabase.storage
      .from('brief-assets')
      .upload(path, compressed, { upsert: true, contentType: 'image/jpeg' })
    if (uploadError) {
      console.error('[cover] storage upload error:', uploadError)
      alert(`Cover upload failed: ${uploadError.message}`)
      return
    }

    // Cache-bust the URL so the card re-renders with the new image
    const { data: { publicUrl } } = supabase.storage.from('brief-assets').getPublicUrl(path)
    const bustedUrl = `${publicUrl}?t=${Date.now()}`

    const { error: updateError } = await supabase.from('briefs').update({ cover_url: bustedUrl }).eq('id', briefId)
    if (updateError) {
      console.error('[cover] DB update error:', updateError)
      alert(`Saved image but couldn't update the brief: ${updateError.message}`)
      return
    }
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

  // Re-run an approved brief: clone the scope-defining fields into a fresh
  // Backlog row. Doesn't touch the original (it stays approved / immutable).
  // Attachments, comments, draft, and due-date are NOT carried over.
  async function handleReRun(source: Brief) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data: newRow, error } = await supabase
      .from('briefs')
      .insert({
        name:            `Re-run: ${source.name}`,
        description:     source.description,
        campaign:        source.campaign,
        content_type:    source.content_type,
        client_id:       source.client_id,
        pipeline_status: 'backlog',
        internal_status: 'backlog',
        // Negative sort_order pushes the new row to the top of the backlog.
        sort_order:      -Date.now(),
        created_by:      user?.id ?? null,
      })
      .select('id')
      .single()
    if (error || !newRow) {
      showToast(`Could not re-run brief: ${error?.message ?? 'unknown error'}`)
      return
    }
    setSelectedBrief(null)
    showToast('New brief created in your Backlog')
    // Reuse the existing pending-open pattern — load() refreshes briefs, the
    // useEffect on pendingBriefId then opens the new drawer once it appears.
    setPendingBriefId(newRow.id)
    if (clientId) load(clientId, true)
  }

  const inProduction  = briefs.filter(b => ['in_production', 'client_review', 'qa_review'].includes(b.pipeline_status))
  const allApproved   = briefs.filter(b => b.pipeline_status === 'approved')
  const approvedCards = showAllApproved ? allApproved : allApproved.slice(0, 10)

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="trello-canvas min-h-[calc(100vh-68px)]">
        {/* Toast — bottom-center, single slot */}
        {toast && (
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg bg-[#22283A] text-white border border-white/10 max-w-[90vw]"
          >
            {toast}
          </div>
        )}
        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Creative Requests</h1>
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
          <div className="flex gap-3 overflow-x-auto pb-2">
            {[1,2,3].map(n => <div key={n} className="h-96 flex-shrink-0 w-[272px] rounded-2xl bg-gray-200 dark:bg-white/5 animate-pulse" />)}
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 items-start">

            {/* ── Backlog ── */}
            <div className="flex-shrink-0 w-[272px] bg-gray-50 dark:bg-[#0F1420] rounded-2xl border border-gray-100 dark:border-white/[0.08] shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-400 flex-shrink-0" />
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-white">Backlog</h3>
                  <span className="text-[11px] font-medium text-gray-400 dark:text-gray-300 bg-gray-100 dark:bg-white/10 rounded-full px-2 py-0.5">
                    {backlogOrder.length}
                  </span>
                </div>
                <button
                  onClick={() => setShowBriefModal(true)}
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
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
                    className="p-3 space-y-3 min-h-[300px] max-h-[calc(100vh-260px)] overflow-y-auto"
                  >
                    {backlogOrder.map((brief, index) => (
                      <Draggable key={brief.id} draggableId={brief.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            style={provided.draggableProps.style}
                            className="rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#4950F8]/40"
                          >
                            <BriefCard
                              brief={brief}
                              clientColor={clientColor}
                              isDragging={snapshot.isDragging}
                              isUpNext={index === 0}
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
                      <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/[0.08] bg-gray-50/50 dark:bg-white/[0.02] py-12 text-center">
                        <p className="text-xs text-gray-400">No briefs in backlog</p>
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>

            {/* ── In Production ── */}
            <div className="flex-shrink-0 w-[272px] bg-gray-50 dark:bg-[#0F1420] rounded-2xl border border-gray-100 dark:border-white/[0.08] shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-400 flex-shrink-0" />
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-white">In Production</h3>
                  <span className="text-[11px] font-medium text-gray-400 dark:text-gray-300 bg-gray-100 dark:bg-white/10 rounded-full px-2 py-0.5">
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
                    className="p-3 space-y-3 min-h-[300px] max-h-[calc(100vh-260px)] overflow-y-auto"
                  >
                    {inProduction.map((brief, index) => (
                      <Draggable key={brief.id} draggableId={brief.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            style={provided.draggableProps.style}
                            className="rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#4950F8]/40"
                          >
                            <BriefCard
                              brief={brief}
                              clientColor={clientColor}
                              reviewMode
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
                      <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/[0.08] bg-gray-50/50 dark:bg-white/[0.02] py-12 text-center">
                        <p className="text-xs text-gray-400">Nothing in production yet</p>
                        <p className="text-[11px] text-gray-300 mt-1">Drag a brief here or approve one</p>
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>

            {/* ── Approved ── */}
            <div className="flex-shrink-0 w-[272px] bg-gray-50 dark:bg-[#0F1420] rounded-2xl border border-gray-100 dark:border-white/[0.08] shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 flex-shrink-0" />
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-white">Approved</h3>
                  <span className="text-[11px] font-medium text-gray-400 dark:text-gray-300 bg-gray-100 dark:bg-white/10 rounded-full px-2 py-0.5">
                    {allApproved.length}
                  </span>
                </div>
                <div className="h-7 w-7" />
              </div>
              <div className="p-3 space-y-3 min-h-[300px] max-h-[calc(100vh-260px)] overflow-y-auto">
                <p className="text-xs text-zinc-500 px-1 -mt-1">
                  Approved briefs auto-delete after 90 days
                </p>
                {approvedCards.map(brief => (
                  <ApprovedBriefCard
                    key={brief.id}
                    brief={brief}
                    onOpen={() => setSelectedBrief(brief)}
                  />
                ))}
                {allApproved.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/[0.08] bg-gray-50/50 dark:bg-white/[0.02] py-12 text-center">
                    <p className="text-xs text-gray-400">No approved briefs yet</p>
                  </div>
                )}
                {allApproved.length > 10 && (
                  <button
                    onClick={() => setShowAllApproved(v => !v)}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
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
            onReRun={() => handleReRun(selectedBrief)}
            onCoverUpload={(file) => handleCoverUpload(selectedBrief.id, file)}
            onCoverDelete={() => handleCoverDelete(selectedBrief.id)}
            onDelete={() => handleDeleteBrief(selectedBrief.id)}
            onReload={() => clientId && load(clientId, true)}
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
      </div>
    </DragDropContext>
  )
}

// ─── Brief Card ───────────────────────────────────────────────────────────────

// Spread on any interactive element inside a draggable card so that
// press-and-hold on the element doesn't kick off a drag on the card.
const STOP_DRAG = {
  onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
  onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
  onTouchStart: (e: React.TouchEvent) => e.stopPropagation(),
}

function BriefCard({ brief, clientColor, reviewMode, isUpNext, isDragging, onOpen, onApprove, onRequestRevisions, onCoverUpload, onCoverDelete }: {
  brief: Brief
  clientColor: string
  reviewMode?: boolean
  isUpNext?: boolean
  isDragging?: boolean
  onOpen: () => void
  onApprove: () => void
  onRequestRevisions: () => void
  onCoverUpload?: (file: File | null) => void
  onCoverDelete?: () => void
}) {
  const { isDark }                          = useTheme()
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
      className={`rounded-2xl p-4 transition-all border ${isDragging
        ? 'cursor-grabbing rotate-1 scale-105 border-gray-200 dark:border-white/[0.08]'
        : 'cursor-grab border-gray-100 dark:border-white/[0.08] shadow-sm hover:border-gray-200 dark:hover:border-white/[0.14] hover:shadow-md'}`}
      style={{
        background: isDark
          ? (isDragging
              ? 'linear-gradient(rgba(255,255,255,0.04), rgba(255,255,255,0.04)), #22283A'
              : '#22283A')
          : '#ffffff',
        ...(isDragging ? { boxShadow: '0 8px 24px rgba(0,0,0,0.45)' } : {}),
      }}
      onClick={onOpen}
    >
      {/* Attribution row */}
      <div className="flex items-center mb-1.5" onClick={e => e.stopPropagation()}>
        {brief.creator && (
          <UserAvatar user={brief.creator} size={24} tint={clientColor} />
        )}
        {(brief.tagged_users?.length ?? 0) > 0 && (
          <div className={brief.creator ? '-ml-2' : ''}>
            <StackedAvatars users={brief.tagged_users ?? []} tint={clientColor} size={22} />
          </div>
        )}
      </div>

      {/* Thumbnail / Cover — only renders when there's an is_cover attachment.
          No attachment = no cover area at all (the legacy briefs.cover_url
          fallback and pastel placeholder were retired here). */}
      {brief.cover_attachment && (
      <div
        className="relative h-28 rounded-xl mb-3 overflow-hidden"
        onClick={e => e.stopPropagation()}
        onMouseEnter={() => setCoverHover(true)}
        onMouseLeave={() => setCoverHover(false)}
      >
        {brief.cover_attachment.file_type === 'application/pdf' ? (
          <div className="h-full w-full flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-rose-500/20 via-[#22283A] to-rose-900/40">
            <FileText className="h-8 w-8 text-rose-300" />
            <p className="text-[10px] font-semibold text-rose-100 truncate max-w-[90%]">{brief.cover_attachment.file_name}</p>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={attachmentPublicUrl(brief.cover_attachment.file_path)} alt="" className="h-full w-full object-cover" />
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
              {...STOP_DRAG}
              className="rounded-lg bg-black/70 px-2 py-1 flex items-center gap-1 hover:bg-black/85 transition-colors"
              onClick={() => setCoverMenuOpen(v => !v)}
            >
              <Upload className="h-3 w-3 text-white" />
              <span className="text-[10px] font-semibold text-white">Cover</span>
              <ChevronDown className="h-3 w-3 text-white" />
            </button>

            {coverMenuOpen && (
              <div className="absolute bottom-full mb-1 right-0 w-44 rounded-xl bg-white dark:bg-[#1E2432] border border-zinc-200 dark:border-white/10 shadow-xl overflow-hidden z-20">
                <button
                  {...STOP_DRAG}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-zinc-700 dark:text-gray-200 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5 text-zinc-400 dark:text-gray-400" />
                  {brief.cover_url ? 'Replace cover' : 'Upload cover'}
                </button>
                {brief.cover_url && onCoverDelete && (
                  <button
                    {...STOP_DRAG}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
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
      )}

      {/* Content type badge */}
      {typeInfo && (
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold mb-2"
          style={{ backgroundColor: `${typeInfo.color}14`, color: typeInfo.color }}
        >
          {typeInfo.id}
        </span>
      )}

      {/* Title */}
      <p className="text-sm font-semibold text-gray-800 dark:text-[#F1F5F9] leading-snug">{brief.name}</p>

      {/* Status badges */}
      <div className="flex gap-1.5 flex-wrap mt-2 mb-3">
        {isRevisions && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-red-50 dark:bg-red-500/15 text-red-500 dark:text-red-300 border border-red-100 dark:border-red-500/25">
            Revisions requested
          </span>
        )}
        {!hasDraft && !reviewMode && (
          isUpNext ? (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold border" style={{ backgroundColor: `${clientColor}15`, color: clientColor, borderColor: `${clientColor}40` }}>
              ⬆ Up next
            </span>
          ) : (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-gray-50 dark:bg-white/[0.03] text-gray-400 border border-gray-100 dark:border-white/[0.08]">
              Not started
            </span>
          )
        )}
        {!hasDraft && reviewMode && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-gray-50 dark:bg-white/[0.03] text-gray-400 border border-gray-100 dark:border-white/[0.08]">
            Awaiting draft
          </span>
        )}
        {brief.due_date && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-gray-50 dark:bg-white/[0.03] text-gray-400 border border-gray-100 dark:border-white/[0.08]">
            Due {format(new Date(brief.due_date), 'd MMM')}
          </span>
        )}
      </div>

      {/* Open Brief button — explicit affordance; full card also opens on click */}
      <button
        {...STOP_DRAG}
        type="button"
        onClick={e => { e.stopPropagation(); onOpen() }}
        className="mb-2 w-full flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold text-white bg-[#4950F8] hover:bg-[#5A61FA] transition-colors"
      >
        <ExternalLink className="h-3 w-3" />
        Open Brief
      </button>

      {/* Action buttons */}
      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
        {hasDraft ? (
          <a
            {...STOP_DRAG}
            href={brief.draft_url!}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-white/10 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          >
            <Play className="h-3 w-3" />
            View Draft
          </a>
        ) : (
          <button
            {...STOP_DRAG}
            disabled
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-gray-100 dark:border-white/5 py-2 text-xs font-medium text-gray-300 dark:text-gray-500 cursor-not-allowed"
          >
            <Play className="h-3 w-3" />
            View Draft
          </button>
        )}

        <button
          {...STOP_DRAG}
          onClick={approve}
          disabled={approving || !reviewMode || !hasDraft}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-colors ${
            reviewMode && hasDraft
              ? 'bg-emerald-500 text-white hover:bg-emerald-600'
              : 'bg-gray-50 dark:bg-white/5 text-gray-300 dark:text-gray-500 border border-gray-100 dark:border-white/10 cursor-not-allowed'
          }`}
        >
          {approving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
          Approve
        </button>
      </div>

      {reviewMode && hasDraft && !isRevisions && (
        <button
          {...STOP_DRAG}
          onClick={e => { e.stopPropagation(); requestRevisions() }}
          disabled={revisioning}
          className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-xl border border-red-100 dark:border-red-500/30 py-2 text-xs font-semibold text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
        >
          {revisioning ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
          Request Revisions
        </button>
      )}
    </div>
  )
}

// ─── Brief Files Section (drawer) ─────────────────────────────────────────────

function BriefFilesSection({ briefId, clientColor, onCoverChanged }: {
  briefId: string
  clientColor: string
  onCoverChanged?: () => void
}) {
  const [attachments, setAttachments] = useState<BriefAttachment[]>([])
  const [loading, setLoading]         = useState(true)
  const [uploading, setUploading]     = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [hoveredId, setHoveredId]     = useState<string | null>(null)
  const [dragOver, setDragOver]       = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function loadAttachments() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('brief_attachments')
      .select('*')
      .eq('brief_id', briefId)
      .order('created_at', { ascending: true })
    if (error) console.error('[files] load error:', error)
    setAttachments((data as BriefAttachment[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadAttachments()
    const supabase = createClient()
    const channel = supabase
      .channel(`brief-attachments-${briefId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'brief_attachments', filter: `brief_id=eq.${briefId}` },
        () => loadAttachments(),
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [briefId])

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files)
    if (list.length === 0) return

    setUploadError(null)
    for (const file of list) {
      if (!(ATTACHMENT_MIME as readonly string[]).includes(file.type)) {
        setUploadError(`"${file.name}" is not a supported type — images and PDFs only.`)
        continue
      }
      if (file.size > ATTACHMENT_MAX_MB * 1024 * 1024) {
        setUploadError(
          `"${file.name}" is larger than ${ATTACHMENT_MAX_MB}MB. Upload to Drive and link it as a comment instead.`,
        )
        continue
      }

      setUploading(true)
      const supabase = createClient()
      const uuid = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36)
      // Sanitise spaces in the original filename so the storage key is URL-safe.
      const safeName = file.name.replace(/\s+/g, '-')
      const path = `${briefId}/${uuid}-${safeName}`

      const { error: upErr } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false })
      if (upErr) {
        console.error('[files] upload error:', upErr)
        setUploadError(`Could not upload "${file.name}": ${upErr.message}`)
        setUploading(false)
        continue
      }

      // First attachment on a brief auto-becomes the cover.
      const hasExistingCover = attachments.some(a => a.is_cover)
      const { error: insErr } = await supabase.from('brief_attachments').insert({
        brief_id:  briefId,
        file_path: path,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        is_cover:  !hasExistingCover,
      })
      if (insErr) {
        console.error('[files] insert error:', insErr)
        setUploadError(`Saved file but couldn't record it: ${insErr.message}`)
      } else if (!hasExistingCover) {
        onCoverChanged?.()
      }
      setUploading(false)
    }
    await loadAttachments()
  }

  async function setCover(att: BriefAttachment) {
    if (att.is_cover) return
    const supabase = createClient()
    // Clear other covers for this brief, then mark the target.
    await supabase.from('brief_attachments')
      .update({ is_cover: false })
      .eq('brief_id', briefId)
      .neq('id', att.id)
    await supabase.from('brief_attachments')
      .update({ is_cover: true })
      .eq('id', att.id)
    await loadAttachments()
    onCoverChanged?.()
  }

  async function deleteAttachment(att: BriefAttachment) {
    const supabase = createClient()
    await supabase.storage.from(ATTACHMENT_BUCKET).remove([att.file_path])
    await supabase.from('brief_attachments').delete().eq('id', att.id)
    setConfirmDeleteId(null)
    await loadAttachments()
    if (att.is_cover) onCoverChanged?.()
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const files = e.dataTransfer?.files
    if (files && files.length > 0) uploadFiles(files)
  }

  return (
    <div>
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Files</p>

      {/* Thumbnail grid */}
      {loading ? (
        <div className="flex gap-2">
          {[1,2,3].map(n => <div key={n} className="h-[72px] w-[72px] rounded-lg bg-gray-100 dark:bg-white/5 animate-pulse" />)}
        </div>
      ) : attachments.length > 0 ? (
        <div className="flex flex-wrap gap-2 mb-3">
          {attachments.map(att => {
            const isImage = att.file_type.startsWith('image/')
            const isCover = att.is_cover
            return (
              <button
                key={att.id}
                type="button"
                onClick={() => setCover(att)}
                onMouseEnter={() => setHoveredId(att.id)}
                onMouseLeave={() => setHoveredId(null)}
                aria-label={isCover ? `${att.file_name} (cover)` : `Set "${att.file_name}" as cover`}
                className={`relative h-[72px] w-[72px] rounded-lg overflow-hidden border transition-all ${
                  isCover
                    ? 'border-[#4950F8] ring-2 ring-[#4950F8]/30'
                    : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
                }`}
                style={isCover ? { borderColor: clientColor, boxShadow: `0 0 0 2px ${clientColor}33` } : undefined}
              >
                {isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={attachmentPublicUrl(att.file_path)} alt={att.file_name} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center gap-0.5 bg-rose-50 dark:bg-rose-500/10">
                    <FileText className="h-5 w-5 text-rose-500 dark:text-rose-300" />
                    <span className="text-[9px] font-semibold text-rose-500 dark:text-rose-300">PDF</span>
                  </div>
                )}

                {/* Cover indicator */}
                {isCover && (
                  <span
                    className="absolute top-1 left-1 rounded-full px-1.5 py-[1px] text-[9px] font-bold text-white shadow-sm"
                    style={{ backgroundColor: clientColor }}
                  >
                    Cover
                  </span>
                )}

                {/* Delete button on hover */}
                {hoveredId === att.id && confirmDeleteId !== att.id && (
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Delete ${att.file_name}`}
                    onClick={e => { e.stopPropagation(); setConfirmDeleteId(att.id) }}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setConfirmDeleteId(att.id) } }}
                    className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/70 hover:bg-black/85 flex items-center justify-center cursor-pointer"
                  >
                    <X className="h-3 w-3 text-white" />
                  </span>
                )}

                {/* Confirm delete overlay */}
                {confirmDeleteId === att.id && (
                  <span
                    className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-1 px-1"
                    onClick={e => e.stopPropagation()}
                  >
                    <span className="text-[9px] font-semibold text-white leading-tight">Delete?</span>
                    <span className="flex gap-1">
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={e => { e.stopPropagation(); deleteAttachment(att) }}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); deleteAttachment(att) } }}
                        className="px-1.5 py-0.5 rounded bg-red-500 hover:bg-red-600 text-[9px] font-semibold text-white cursor-pointer"
                      >
                        Yes
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={e => { e.stopPropagation(); setConfirmDeleteId(null) }}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setConfirmDeleteId(null) } }}
                        className="px-1.5 py-0.5 rounded bg-gray-600 hover:bg-gray-700 text-[9px] font-semibold text-white cursor-pointer"
                      >
                        No
                      </span>
                    </span>
                  </span>
                )}
              </button>
            )
          })}
        </div>
      ) : null}

      {/* Drag-drop + click-to-upload zone */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click() } }}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        aria-label="Upload attachments"
        className={`rounded-xl border border-dashed transition-colors px-4 py-5 text-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#4950F8]/40 ${
          dragOver
            ? 'border-[#4950F8] bg-[#4950F8]/5'
            : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 bg-gray-50/50 dark:bg-white/[0.02]'
        }`}
      >
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Uploading…
          </div>
        ) : (
          <>
            <Upload className="mx-auto h-5 w-5 text-gray-400 mb-1" />
            <p className="text-xs font-medium text-gray-600 dark:text-gray-300">
              Drop files here or click to upload
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Images (JPG, PNG, WebP, GIF) or PDF · {ATTACHMENT_MAX_MB}MB max
            </p>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ATTACHMENT_ACCEPT}
        multiple
        className="hidden"
        onChange={e => {
          const files = e.target.files
          if (files && files.length > 0) uploadFiles(files)
          e.target.value = ''
        }}
      />

      {uploadError && (
        <p
          role="alert"
          className="mt-2 text-[11px] font-medium text-red-500 dark:text-red-400"
        >
          {uploadError}
        </p>
      )}
    </div>
  )
}

// ─── Approved Card ────────────────────────────────────────────────────────────

function ApprovedBriefCard({ brief, onOpen }: { brief: Brief; onOpen?: () => void }) {
  const typeInfo = CONTENT_TYPES.find(t => t.id === brief.content_type)
  return (
    <div
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={onOpen ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } } : undefined}
      aria-label={onOpen ? `Open approved brief: ${brief.name}` : undefined}
      className={`rounded-2xl bg-white dark:bg-[#22283A] border border-gray-100 dark:border-white/[0.08] shadow-sm p-4 ${onOpen ? 'cursor-pointer hover:border-gray-200 dark:hover:border-white/[0.14] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4950F8]/40' : ''}`}
    >
      <div className="flex items-start gap-3">
        <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-emerald-500 dark:text-emerald-400" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 dark:text-[#F1F5F9] leading-snug truncate">{brief.name}</p>
          {brief.campaign && <p className="text-xs text-gray-400 mt-0.5">{brief.campaign}</p>}
          {typeInfo && (
            <span
              className="mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ backgroundColor: `${typeInfo.color}14`, color: typeInfo.color }}
            >
              {typeInfo.id}
            </span>
          )}
        </div>
        {brief.draft_url && (
          <a href={brief.draft_url} target="_blank" rel="noopener noreferrer"
            className="text-gray-300 dark:text-gray-400 hover:text-gray-500 dark:hover:text-gray-200 transition-colors flex-shrink-0 mt-0.5">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  )
}

// ─── Brief Side Panel ────────────────────────────────────────────────────────

function BriefPanel({ brief, clientColor, onClose, onApprove, onRequestRevisions, onCoverUpload, onCoverDelete, onDelete, onReload, onReRun }: {
  brief: Brief
  clientColor: string
  onClose: () => void
  onApprove: () => void
  onRequestRevisions: () => void
  onCoverUpload?: (file: File) => void
  onCoverDelete?: () => void
  onDelete?: () => void
  onReload?: () => void
  onReRun?: () => void
}) {
  const coverFileRef = useRef<HTMLInputElement>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
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
  const [mentionIndex, setMentionIndex]     = useState(0)
  const [pendingMentionIds, setPendingMentionIds] = useState<string[]>([])
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

  // Load current user + mentionable users scoped to this brief's client board:
  //  - profiles where client_id = brief.client_id (client members)
  //  - staff with access to this client via staff_client_access
  // Self is included so users can @mention themselves (useful for follow-ups /
  // self-reminders, and matches the spec's test flow).
  useEffect(() => {
    async function loadUsers() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setCurrentUserId(user.id)

      const [clientRes, staffAccessRes] = await Promise.all([
        supabase.from('profiles').select('id, name').eq('client_id', brief.client_id),
        supabase.from('staff_client_access').select('staff_id').eq('client_id', brief.client_id),
      ])

      const staffIds = (staffAccessRes.data ?? []).map((r: any) => r.staff_id as string)
      const staffProfiles = staffIds.length
        ? (await supabase.from('profiles').select('id, name').in('id', staffIds)).data ?? []
        : []

      const merged: Record<string, { id: string; name: string }> = {}
      ;[...(clientRes.data ?? []), ...staffProfiles].forEach((p: any) => {
        if (p.name) merged[p.id] = { id: p.id, name: p.name }
      })

      setMentionUsers(Object.values(merged).sort((a, b) => a.name.localeCompare(b.name)))
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
    setMentionIndex(0)
    setPendingMentionIds(ids => Array.from(new Set([...ids, user.id])))
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

    const { data: inserted, error: commentError } = await supabase.from('brief_comments').insert({
      brief_id:    brief.id,
      content:     text,
      user_id:     user?.id,
      user_email:  user?.email,
      user_name:   authorName,
      is_internal: false,
    }).select('id').single()

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

    // Persist mentions so the DB trigger can fan out notifications
    const mentionIdsInText = pendingMentionIds.filter(uid => {
      const u = mentionUsers.find(m => m.id === uid)
      return u ? text.includes(`@${u.name}`) : false
    })
    if (inserted?.id && mentionIdsInText.length > 0) {
      const { error: mentionError } = await supabase.from('comment_mentions').insert(
        mentionIdsInText.map(uid => ({ comment_id: inserted.id, user_id: uid }))
      )
      if (mentionError) {
        console.error('comment_mentions insert failed:', mentionError)
        setCommentError('Comment saved, but we could not tag everyone you mentioned. Please try again or tell your admin.')
      }
    }

    // Comment saved — clear input and force reload immediately (don't wait for realtime)
    setCommentError(null)
    setNewComment('')
    setPendingMentionIds([])
    setSending(false)
    await loadComments()

    // Notifications are now emitted by the notify_on_comment DB trigger —
    // see supabase/schema_v6_task5_notifications_mentions.sql.
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
    // Highlight @mention tokens in brand blue. Matches single-word handles
    // only so trailing text after a mention stays in the default colour.
    // Multi-word display names (e.g. "Eden Jannides") only get the first
    // token blued — acceptable trade-off vs. previous greedy regex that
    // swallowed the rest of the message.
    const parts = content.split(/(@[\w-]+)/g)
    return parts.map((part, i) =>
      /^@[\w-]+$/.test(part)
        ? <span key={i} className="font-semibold" style={{ color: '#4950F8' }}>{part}</span>
        : <span key={i}>{part}</span>
    )
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden" style={{ maxHeight: '90vh' }}>

        {/* ── Cover image (Trello-style banner) ── */}
        {brief.cover_url && (
          <div className="relative flex-shrink-0 w-full rounded-t-2xl group/coverpanel overflow-hidden bg-black/80">
            <img src={brief.cover_url} alt="" className="w-full max-h-48 object-contain" />
            {/* Cover actions — top right (hidden on approved: brief is locked) */}
            {onCoverUpload && !isApproved && (
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

        {/* ── Header bar (neutral chrome; client identity lives elsewhere in the drawer) ── */}
        <div className="flex-shrink-0 px-6 py-4 flex items-start justify-between bg-[#F3F4F6] dark:bg-[#1E2435]">
          <div className="flex-1 min-w-0">
            {brief.campaign && (
              <p className="text-xs font-medium mb-1 text-gray-500 dark:text-gray-400">{brief.campaign}</p>
            )}
            <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-snug">{brief.name}</h2>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {typeInfo && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold"
                  style={{ backgroundColor: `${typeInfo.color}22`, color: typeInfo.color }}
                >
                  <typeInfo.icon className="h-3 w-3" />
                  {typeInfo.id}
                </span>
              )}
              {isApproved && (
                <span className="rounded-full px-3 py-1 text-[11px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">Approved ✓</span>
              )}
              {isReview && !isApproved && (
                <span className="rounded-full px-3 py-1 text-[11px] font-semibold bg-gray-200 text-gray-700 dark:bg-white/10 dark:text-gray-200">In Production</span>
              )}
              {brief.due_date && (
                <span className="rounded-full px-3 py-1 text-[11px] font-medium bg-gray-200 text-gray-600 dark:bg-white/10 dark:text-gray-400">
                  Due {format(new Date(brief.due_date), 'd MMM yyyy')}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close brief"
            className="ml-4 flex-shrink-0 rounded-xl p-2 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Body: two columns ── */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* ── LEFT: Editable brief details ── */}
          <div className="w-[52%] flex-shrink-0 border-r border-gray-100 overflow-y-auto">
            <div className="p-6 space-y-6">

              {/* Re-run banner — approved briefs only */}
              {isApproved && onReRun && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10 p-4">
                  <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300 mb-2">
                    This brief is approved and locked. Need another round?
                  </p>
                  <button
                    type="button"
                    onClick={() => onReRun()}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#4950F8] hover:bg-[#5A61FA] px-4 py-2.5 text-sm font-semibold text-white transition-colors"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Re-run this brief
                  </button>
                </div>
              )}

              {/* People */}
              <div className={`space-y-2 ${isApproved ? 'pointer-events-none opacity-70' : ''}`} aria-disabled={isApproved || undefined}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">People</p>
                <TagUsersControl
                  briefId={brief.id}
                  clientId={brief.client_id}
                  tagged={brief.tagged_users ?? []}
                  tint={clientColor}
                  onChange={() => onReload?.()}
                />
              </div>

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
                          Not started yet
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
                  readOnly={isApproved}
                  onChange={e => setLocalDesc(e.target.value)}
                  onFocus={() => !isApproved && setEditingField('description')}
                  onBlur={() => { if (!isApproved && editingField === 'description') saveField('description', localDesc) }}
                  placeholder="Add a more detailed description…"
                  className={`w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all resize-none ${isApproved ? 'cursor-default opacity-70' : 'hover:border-gray-300'}`}
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
                      readOnly={isApproved}
                      onChange={e => setLocalCampaign(e.target.value)}
                      onFocus={() => !isApproved && setEditingField('campaign')}
                      onBlur={() => { if (!isApproved && editingField === 'campaign') saveField('campaign', localCampaign) }}
                      placeholder="Add campaign name…"
                      className={`rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all w-full ${isApproved ? 'cursor-default opacity-70' : 'hover:border-gray-300'}`}
                      style={{ '--tw-ring-color': clientColor } as React.CSSProperties}
                    />
                  </div>

                  {/* Due Date */}
                  <div className="grid grid-cols-[120px_1fr] items-center gap-3">
                    <span className="text-xs font-medium text-gray-500">Due Date</span>
                    <input
                      type="date"
                      value={localDueDate}
                      disabled={isApproved}
                      onChange={e => { if (isApproved) return; setLocalDueDate(e.target.value); saveField('due_date', e.target.value) }}
                      className={`rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:border-transparent transition-all w-full ${isApproved ? 'cursor-default opacity-70' : 'hover:border-gray-300'}`}
                      style={{ '--tw-ring-color': clientColor } as React.CSSProperties}
                    />
                  </div>

                  {/* Link to Inspiration */}
                  <div className="grid grid-cols-[120px_1fr] items-center gap-3">
                    <span className="text-xs font-medium text-gray-500">Inspiration</span>
                    <input
                      type="url"
                      value={localRefUrl}
                      readOnly={isApproved}
                      onChange={e => setLocalRefUrl(e.target.value)}
                      onFocus={() => !isApproved && setEditingField('ref_url')}
                      onBlur={() => { if (!isApproved && editingField === 'ref_url') saveField('ref_url', localRefUrl) }}
                      placeholder="https://…"
                      className={`rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all w-full ${isApproved ? 'cursor-default opacity-70' : 'hover:border-gray-300'}`}
                      style={{ '--tw-ring-color': clientColor } as React.CSSProperties}
                    />
                  </div>
                </div>
              </div>

              {/* ── Content Type ── */}
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Content Type</p>
                <div className={`flex flex-wrap gap-2 ${isApproved ? 'pointer-events-none opacity-70' : ''}`} aria-disabled={isApproved || undefined}>
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
                <div className={`flex flex-wrap gap-2 ${isApproved ? 'pointer-events-none opacity-70' : ''}`} aria-disabled={isApproved || undefined}>
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

              {/* ── Files ── */}
              <div className={isApproved ? 'pointer-events-none opacity-70' : ''} aria-disabled={isApproved || undefined}>
                <BriefFilesSection
                  briefId={brief.id}
                  clientColor={clientColor}
                  onCoverChanged={onReload}
                />
              </div>

              {/* ── Delete brief ── Hidden on approved; the brief is locked. */}
              {onDelete && !isApproved && (
                <div className="pt-2 border-t border-gray-100">
                  {!confirmDelete ? (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="flex items-center gap-1.5 text-xs font-medium text-gray-300 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete brief
                    </button>
                  ) : (
                    <div className="rounded-xl border border-red-100 bg-red-50 p-3 space-y-2">
                      <p className="text-xs font-semibold text-red-600">Delete this brief?</p>
                      <p className="text-[11px] text-red-400">This cannot be undone. All comments and files will be permanently removed.</p>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => setConfirmDelete(false)}
                          className="flex-1 rounded-lg border border-gray-200 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          disabled={deleting}
                          onClick={async () => { setDeleting(true); await onDelete() }}
                          className="flex-1 rounded-lg bg-red-500 hover:bg-red-600 py-1.5 text-xs font-semibold text-white transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                        >
                          {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                          Yes, delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

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
                  {filteredMentions.map((u, idx) => (
                    <button
                      key={u.id}
                      type="button"
                      onMouseEnter={() => setMentionIndex(idx)}
                      onMouseDown={e => { e.preventDefault(); insertMention(u) }}
                      className={`flex items-center gap-2.5 w-full px-3 py-2.5 text-left transition-colors ${idx === mentionIndex ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
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
                      if (mentionOpen && filteredMentions.length > 0) {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault()
                          setMentionIndex(i => Math.min(i + 1, filteredMentions.length - 1))
                          return
                        }
                        if (e.key === 'ArrowUp') {
                          e.preventDefault()
                          setMentionIndex(i => Math.max(i - 1, 0))
                          return
                        }
                        if (e.key === 'Enter' || e.key === 'Tab') {
                          e.preventDefault()
                          const pick = filteredMentions[mentionIndex] ?? filteredMentions[0]
                          if (pick) insertMention(pick)
                          return
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault()
                          setMentionOpen(false)
                          return
                        }
                      }
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
    const { data: { user } } = await supabase.auth.getUser()
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
      created_by:      user?.id ?? null,
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
