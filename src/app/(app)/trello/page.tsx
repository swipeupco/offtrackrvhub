'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Clock, CheckCircle2, Play, Plus, X,
  Sparkles, Loader2, ChevronDown, Check, Pencil, RotateCcw,
  Video, Image, Mail, LayoutGrid, Mic, FileText, CircleDot,
} from 'lucide-react'
import { format, parseISO, isPast } from 'date-fns'
import { useSearchParams, useRouter } from 'next/navigation'

interface TrelloCard {
  id: string; name: string; idList: string; url: string
  due: string | null; labels: { id: string; name: string; color: string }[]
  desc: string | null; campaign: string | null
  type: { text: string; color: string } | null
  sizes: string | null; status: string | null; draftUrl: string | null
}

const LIST_BACKLOG       = '6614e07109c74b4bf05f0da8'
const LIST_IN_PRODUCTION = '666fee9d24fdad7631ab5c7e'
const LIST_APPROVED      = '666fee9d24fdad7631ab5c7f'

const LABEL_COLORS: Record<string, string> = {
  green: '#22c55e', yellow: '#eab308', orange: '#f97316',
  red: '#ef4444', purple: '#a855f7', blue: '#3b82f6',
  sky: '#0ea5e9', pink: '#ec4899', black: '#1f2937', lime: '#84cc16',
}

const CONTENT_TYPES = [
  { id: 'Video',     icon: Video,      color: '#22c55e' },
  { id: 'Graphic',   icon: Image,      color: '#f97316' },
  { id: 'EDM',       icon: Mail,       color: '#ef4444' },
  { id: 'Signage',   icon: LayoutGrid, color: '#0ea5e9' },
  { id: 'Voiceover', icon: Mic,        color: '#a855f7' },
  { id: 'Script',    icon: FileText,   color: '#f59e0b' },
  { id: 'Other',     icon: CircleDot,  color: '#94a3b8' },
] as const

const SIZES = [
  { id: '1:1',  label: '1 × 1',  w: 40, h: 40, desc: 'Square' },
  { id: '4:5',  label: '4 × 5',  w: 36, h: 45, desc: 'Portrait' },
  { id: '9:16', label: '9 × 16', w: 28, h: 50, desc: 'Story / Reel' },
  { id: '16:9', label: '16 × 9', w: 50, h: 28, desc: 'Landscape' },
] as const

export default function TrelloPage() {
  const [cards, setCards]     = useState<TrelloCard[]>([])
  const [loading, setLoading] = useState(true)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [deletingId,  setDeletingId]  = useState<string | null>(null)
  const [showAllApproved, setShowAllApproved] = useState(false)
  const [showBriefModal, setShowBriefModal]   = useState(false)
  const [editCard, setEditCard] = useState<TrelloCard | null>(null)

  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    if (searchParams.get('newBrief') === '1') {
      setShowBriefModal(true)
      router.replace('/trello')
    }
  }, [searchParams, router])

  const fetchBoard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch('/api/trello-board', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        const production = (data.cards ?? []).filter((c: TrelloCard) => c.idList === LIST_IN_PRODUCTION)
        const backlog    = (data.cards ?? []).filter((c: TrelloCard) => c.idList === LIST_BACKLOG)
        // Auto-fill if production has open slots
        if (production.length < 3 && backlog.length > 0) {
          await fetch('/api/trello-move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'fill' }),
          })
          const refetched = await fetch('/api/trello-board', { cache: 'no-store' })
          if (refetched.ok) {
            const fresh = await refetched.json()
            setCards(fresh.cards)
            return
          }
        }
        setCards(data.cards)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBoard()
    const interval = setInterval(() => fetchBoard(true), 30_000)
    return () => clearInterval(interval)
  }, [fetchBoard])

  async function handleApprove(cardId: string) {
    setApprovingId(cardId)
    try {
      await fetch('/api/trello-move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, action: 'approve' }),
      })
      await fetchBoard(true)
    } finally {
      setApprovingId(null)
    }
  }

  async function handleSendToBacklog(cardId: string) {
    setRejectingId(cardId)
    try {
      await fetch('/api/trello-move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, action: 'backlog' }),
      })
      await fetchBoard(true)
    } finally {
      setRejectingId(null)
    }
  }

  async function handleDelete(cardId: string) {
    setDeletingId(cardId)
    try {
      await fetch('/api/trello-move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, action: 'delete' }),
      })
      setBacklogCards(prev => prev.filter(c => c.id !== cardId))
      setCards(prev => prev.filter(c => c.id !== cardId))
    } finally {
      setDeletingId(null)
    }
  }

  async function handleSaveEdit(cardId: string, name: string, desc: string, contentType: string) {
    await fetch('/api/trello-card', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardId, name, desc, contentType }),
    })
    const typeInfo = CONTENT_TYPES.find(t => t.id === contentType)
    setCards(prev => prev.map(c => c.id === cardId ? {
      ...c, name, desc,
      type: typeInfo ? { text: typeInfo.id, color: typeInfo.color } : (contentType ? c.type : null),
    } : c))
    setEditCard(null)
  }

  const [backlogCards, setBacklogCards] = useState<TrelloCard[]>([])
  const productionCards = cards.filter(c => c.idList === LIST_IN_PRODUCTION)
  const allApproved     = cards.filter(c => c.idList === LIST_APPROVED)
  const approvedCards   = showAllApproved ? allApproved : allApproved.slice(0, 10)
  const dragCard = useRef<TrelloCard | null>(null)
  const dragOver = useRef<string | null>(null)
  const [dragOverId, setDragOverId]   = useState<string | null>(null)
  const [draggingId, setDraggingId]   = useState<string | null>(null)

  // Keep backlogCards in sync with cards but allow local reorder
  useEffect(() => {
    setBacklogCards(cards.filter(c => c.idList === LIST_BACKLOG))
  }, [cards])

  function handleDragStart(card: TrelloCard) {
    dragCard.current = card
    setDraggingId(card.id)
  }

  function handleDragEnter(overId: string) {
    dragOver.current = overId
    setDragOverId(overId)
  }

  function handleDragEnd() {
    dragCard.current = null
    dragOver.current = null
    setDragOverId(null)
    setDraggingId(null)
  }

  async function handleDrop() {
    if (!dragCard.current || !dragOver.current || dragCard.current.id === dragOver.current) {
      setDragOverId(null)
      setDraggingId(null)
      return
    }
    const from = dragCard.current.id
    const to   = dragOver.current
    dragCard.current = null
    dragOver.current = null
    setDragOverId(null)
    setDraggingId(null)

    // Reorder locally
    setBacklogCards(prev => {
      const list  = [...prev]
      const fromI = list.findIndex(c => c.id === from)
      const toI   = list.findIndex(c => c.id === to)
      if (fromI === -1 || toI === -1) return prev
      const [item] = list.splice(fromI, 1)
      list.splice(toI, 0, item)
      // Persist new positions (fire and forget)
      fetch('/api/trello-move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reorder',
          positions: list.map((c, i) => ({ id: c.id, pos: (i + 1) * 1000 })),
        }),
      })
      return list
    })
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">Creative Pipeline</h1>
        <button
          onClick={() => setShowBriefModal(true)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#14C29F' }}
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

          {/* ── Backlog ── */}
          <div className="flex flex-col gap-3 bg-zinc-50 p-4 border-r border-zinc-200 min-h-[600px]">
            <div className="flex items-center justify-between rounded-xl bg-zinc-200/60 px-4 py-3">
              <h3 className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">Backlog</h3>
              <span className="rounded-full bg-zinc-300 text-zinc-600 text-[10px] font-bold px-2 py-0.5">{backlogCards.length}</span>
            </div>
            <div className="space-y-2">
              {backlogCards.map(card => (
                <div key={card.id}>
                  {dragOverId === card.id && draggingId !== card.id && (
                    <div className="h-0.5 rounded-full mb-2 mx-1" style={{ backgroundColor: '#14C29F' }} />
                  )}
                  <BacklogCard
                    card={card}
                    isDragging={draggingId === card.id}
                    deleting={deletingId === card.id}
                    onDragStart={() => handleDragStart(card)}
                    onDragEnter={() => handleDragEnter(card.id)}
                    onDrop={handleDrop}
                    onDragEnd={handleDragEnd}
                    onEdit={() => setEditCard(card)}
                    onDelete={() => handleDelete(card.id)}
                  />
                </div>
              ))}
              {backlogCards.length === 0 && (
                <div className="rounded-xl border border-dashed border-zinc-300 py-8 text-center">
                  <p className="text-xs text-zinc-400">Backlog is empty</p>
                </div>
              )}
            </div>
          </div>

          {/* ── In Production ── */}
          <div className="flex flex-col gap-3 bg-amber-50 p-4 border-r border-zinc-200 min-h-[600px]">
            <div className="flex items-center justify-between rounded-xl bg-zinc-900 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                <h3 className="text-sm font-semibold text-white">In Production</h3>
              </div>
              <span className="rounded-full bg-zinc-700 text-zinc-300 text-[10px] font-bold px-2 py-0.5">
                {productionCards.length} / 3
              </span>
            </div>
            <div className="space-y-3">
              {productionCards.map(card => (
                <ProductionCard
                  key={card.id}
                  card={card}
                  approving={approvingId === card.id}
                  onApprove={() => handleApprove(card.id)}
                  onEdit={() => setEditCard(card)}
                />
              ))}
              {productionCards.length === 0 && (
                <div className="rounded-xl border border-dashed border-amber-200 py-10 text-center">
                  <p className="text-xs text-zinc-400">Nothing in production</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Approved ── */}
          <div className="flex flex-col gap-3 bg-emerald-50 p-4 min-h-[600px]">
            <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ backgroundColor: '#14C29F' }}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-white" />
                <h3 className="text-sm font-semibold text-white">Approved</h3>
              </div>
            </div>
            <div className="space-y-2">
              {approvedCards.map(card => (
                <ApprovedCard
                  key={card.id}
                  card={card}
                  sending={rejectingId === card.id}
                  onSendToBacklog={() => handleSendToBacklog(card.id)}
                />
              ))}
              {allApproved.length === 0 && (
                <div className="rounded-xl border border-dashed border-emerald-200 py-10 text-center">
                  <p className="text-xs text-zinc-400">No approved cards yet</p>
                </div>
              )}
              {allApproved.length > 10 && (
                <button
                  onClick={() => setShowAllApproved(v => !v)}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-white/60 py-2.5 text-xs font-medium text-zinc-500 hover:bg-white transition-colors"
                >
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAllApproved ? 'rotate-180' : ''}`} />
                  {showAllApproved ? 'Show less' : 'See all approved'}
                </button>
              )}
            </div>
          </div>

        </div>
      )}

      {editCard && (
        <EditBriefModal
          card={editCard}
          onClose={() => setEditCard(null)}
          onSave={(name, desc, contentType) => handleSaveEdit(editCard.id, name, desc, contentType)}
        />
      )}

      {showBriefModal && (
        <CreateBriefModal
          onClose={() => setShowBriefModal(false)}
          onCreated={() => { setShowBriefModal(false); fetchBoard(true) }}
        />
      )}
    </div>
  )
}

// ─── Backlog Card ─────────────────────────────────────────────────────────────

function BacklogCard({ card, isDragging, deleting, onDragStart, onDragEnter, onDrop, onDragEnd, onEdit, onDelete }: {
  card: TrelloCard
  isDragging?: boolean
  deleting?: boolean
  onDragStart?: () => void
  onDragEnter?: () => void
  onDrop?: () => void
  onDragEnd?: () => void
  onEdit?: () => void
  onDelete?: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  function handleDeleteClick() {
    if (confirmDelete) { onDelete?.(); setConfirmDelete(false) }
    else setConfirmDelete(true)
  }

  return (
    <div
      draggable={true}
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragOver={e => e.preventDefault()}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`rounded-xl bg-white border border-zinc-200 p-4 shadow-sm space-y-3 cursor-grab active:cursor-grabbing transition-opacity ${isDragging ? 'opacity-30' : 'opacity-100'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-800 leading-snug">{card.name}</p>
          {card.campaign && <p className="text-xs text-zinc-500 mt-0.5 truncate">{card.campaign}</p>}
        </div>
      </div>

      {card.type && (
        <div>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white" style={{ backgroundColor: card.type.color }}>
            {card.type.text}
          </span>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
        >
          <Pencil className="h-3 w-3" />
          Edit Brief
        </button>
        <button
          onClick={handleDeleteClick}
          onBlur={() => setConfirmDelete(false)}
          disabled={deleting}
          className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
            confirmDelete
              ? 'flex-1 border-red-300 bg-red-50 text-red-600 hover:bg-red-100'
              : 'px-3 border-zinc-200 text-zinc-400 hover:border-red-200 hover:text-red-500 hover:bg-red-50'
          }`}
        >
          <X className="h-3 w-3" />
          {confirmDelete ? 'Confirm delete' : ''}
        </button>
      </div>
    </div>
  )
}

// ─── Production Card ──────────────────────────────────────────────────────────

function ProductionCard({
  card, approving, onApprove, onEdit,
}: {
  card: TrelloCard; approving: boolean; onApprove: () => void; onEdit: () => void
}) {
  const isOverdue = card.due && isPast(parseISO(card.due))
  const canAct = !!card.draftUrl
  return (
    <div
      className="rounded-xl bg-white p-4 shadow-sm space-y-3 transition-all"
      style={canAct ? {
        border: '2px solid #14C29F',
        boxShadow: '0 0 0 0 rgba(20,194,159,0.4), 0 1px 3px rgba(0,0,0,0.08)',
        animation: 'draftGlow 2.4s ease-in-out infinite',
      } : { border: '1px solid #e4e4e7' }}
    >
      {canAct && (
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: '#14C29F' }} />
            <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: '#14C29F' }} />
          </span>
          <span className="text-[10px] font-semibold" style={{ color: '#14C29F' }}>Draft ready</span>
        </div>
      )}

      {card.labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {card.labels.map(l => (
            <span key={l.id} className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
              style={{ backgroundColor: LABEL_COLORS[l.color] ?? '#94a3b8' }}>
              {l.name || l.color}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-800 leading-snug">{card.name}</p>
          {card.campaign && <p className="text-xs text-zinc-500 mt-0.5 truncate">{card.campaign}</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {card.type && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white" style={{ backgroundColor: card.type.color }}>
            {card.type.text}
          </span>
        )}
        {card.due && (
          <span className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${isOverdue ? 'bg-red-100 text-red-700' : 'bg-zinc-100 text-zinc-600'}`}>
            <Clock className="h-2.5 w-2.5" />
            {format(parseISO(card.due), 'd MMM')}
          </span>
        )}
        {!canAct && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
            Awaiting draft link
          </span>
        )}
      </div>

      {/* Edit Brief */}
      <button
        onClick={onEdit}
        className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
      >
        <Pencil className="h-3 w-3" />
        Edit Brief
      </button>

      {/* View Draft + Approved */}
      <div className="flex gap-2">
        <a
          href={canAct ? card.draftUrl! : '#'}
          target={canAct ? '_blank' : '_self'}
          rel="noopener noreferrer"
          onClick={e => !canAct && e.preventDefault()}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition-opacity ${
            canAct ? 'text-white hover:opacity-90' : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
          }`}
          style={canAct ? { backgroundColor: '#0052CC' } : {}}
        >
          <Play className="h-3 w-3" />
          View Draft
        </a>
        <button
          onClick={onApprove}
          disabled={!canAct || approving}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition-opacity ${
            canAct ? 'text-white hover:opacity-90 disabled:opacity-50' : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
          }`}
          style={canAct ? { backgroundColor: '#14C29F' } : {}}
        >
          <CheckCircle2 className="h-3 w-3" />
          {approving ? 'Moving…' : 'Approved ✓'}
        </button>
      </div>

    </div>
  )
}

// ─── Approved Card ────────────────────────────────────────────────────────────

function ApprovedCard({ card, sending, onSendToBacklog }: { card: TrelloCard; sending: boolean; onSendToBacklog: () => void }) {
  const [showActions, setShowActions] = useState(false)

  return (
    <div className="rounded-xl bg-zinc-50 border border-zinc-200 px-4 py-3 opacity-60 hover:opacity-80 transition-opacity">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-zinc-700 truncate">{card.name}</p>
          {card.campaign && <p className="text-[10px] text-zinc-400 truncate">{card.campaign}</p>}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {card.type && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white" style={{ backgroundColor: card.type.color }}>
              {card.type.text}
            </span>
          )}
          <button
            onClick={() => setShowActions(v => !v)}
            className="text-zinc-400 hover:text-zinc-600 transition-colors"
            title="More options"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showActions ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>
      {showActions && (
        <div className="mt-2 pt-2 border-t border-zinc-200">
          <button
            onClick={onSendToBacklog}
            disabled={sending}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-zinc-300 py-1.5 text-[10px] font-semibold text-zinc-600 hover:bg-zinc-100 transition-colors disabled:opacity-50"
          >
            <RotateCcw className="h-2.5 w-2.5" />
            {sending ? 'Moving…' : 'Send back to Backlog'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Edit Brief Modal ─────────────────────────────────────────────────────────

function EditBriefModal({ card, onClose, onSave }: {
  card: TrelloCard
  onClose: () => void
  onSave: (name: string, desc: string, contentType: string) => Promise<void>
}) {
  // Parse existing desc to pre-fill fields
  function parseDesc(raw: string | null) {
    const lines = (raw ?? '').split('\n')
    let campaign = '', contentType = '', sizes: string[] = [], briefLines: string[] = []
    for (const line of lines) {
      if (line.startsWith('Campaign: ')) campaign = line.replace('Campaign: ', '')
      else if (line.startsWith('Type: ')) contentType = line.replace('Type: ', '')
      else if (line.startsWith('Sizes: ')) sizes = line.replace('Sizes: ', '').split(', ').filter(Boolean)
      else briefLines.push(line)
    }
    return { campaign, contentType, sizes, brief: briefLines.join('\n').trim() }
  }

  const parsed = parseDesc(card.desc)

  const [name, setName]               = useState(card.name)
  const [campaign, setCampaign]       = useState(parsed.campaign || card.campaign || '')
  const [contentType, setContentType] = useState(parsed.contentType || card.type?.text || '')
  const [selectedSizes, setSelectedSizes] = useState<string[]>(parsed.sizes)
  const [desc, setDesc]               = useState(parsed.brief)
  const [saving, setSaving]           = useState(false)

  function toggleSize(id: string) {
    setSelectedSizes(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
  }

  async function handleSave() {
    setSaving(true)
    const fullDesc = [
      campaign    ? `Campaign: ${campaign}` : '',
      contentType ? `Type: ${contentType}` : '',
      selectedSizes.length ? `Sizes: ${selectedSizes.join(', ')}` : '',
      desc,
    ].filter(Boolean).join('\n')
    await onSave(name, fullDesc, contentType)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-zinc-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h2 className="text-lg font-bold text-zinc-900">Edit Brief</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Title + Campaign */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Title *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Ballarat Show – Reel"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#14C29F]/40 focus:border-[#14C29F]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Campaign / Show</label>
              <input type="text" value={campaign} onChange={e => setCampaign(e.target.value)}
                placeholder="e.g. Ballarat Caravan Show 2026"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#14C29F]/40 focus:border-[#14C29F]" />
            </div>
          </div>

          {/* Brief — primary field */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Brief <span className="font-normal text-zinc-400">— keep it short</span></label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              rows={7}
              placeholder="Objective | Key Message | Tone"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-[#14C29F]/40 focus:border-[#14C29F] resize-none"
            />
          </div>

          {/* Content Type */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Content Type</label>
            <div className="flex flex-wrap gap-1.5">
              {CONTENT_TYPES.map(({ id, icon: Icon, color }) => {
                const active = contentType === id
                return (
                  <button
                    key={id}
                    onClick={() => setContentType(active ? '' : id)}
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
                      active ? 'text-white shadow-sm' : 'border-zinc-200 text-zinc-600 bg-white hover:border-zinc-300'
                    }`}
                    style={active ? { backgroundColor: color, borderColor: color } : {}}
                  >
                    <Icon className="h-3 w-3" />
                    {id}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Sizes */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Sizes <span className="font-normal text-zinc-400">(multi-select)</span></label>
            <div className="flex flex-wrap gap-1.5">
              {SIZES.map(({ id, label, desc: sDesc }) => {
                const active = selectedSizes.includes(id)
                return (
                  <button
                    key={id}
                    onClick={() => toggleSize(id)}
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
                      active ? 'border-[#14C29F] bg-[#14C29F]/10 text-[#14C29F]' : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300'
                    }`}
                  >
                    {label}
                    <span className={`text-[10px] ${active ? 'text-[#14C29F]/70' : 'text-zinc-400'}`}>{sDesc}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 rounded-lg border border-zinc-200 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#14C29F' }}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Create Brief Modal ───────────────────────────────────────────────────────

function CreateBriefModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle]         = useState('')
  const [campaign, setCampaign]   = useState('')
  const [contentType, setContentType] = useState('')
  const [selectedSizes, setSelectedSizes] = useState<string[]>([])
  const [desc, setDesc]           = useState('')
  const [aiPrompt, setAiPrompt]   = useState('')
  const [urls, setUrls]           = useState<string[]>([''])
  const [generating, setGenerating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  async function generateBrief() {
    if (!aiPrompt.trim()) return
    setGenerating(true)
    try {
      const res = await fetch('/api/ai-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt }),
      })
      const data = await res.json()
      if (data.title)       setTitle(data.title)
      if (data.campaign)    setCampaign(data.campaign)
      if (data.contentType) setContentType(data.contentType)
      if (data.sizes?.length) setSelectedSizes(data.sizes)
      if (data.brief)       setDesc(data.brief)
    } finally {
      setGenerating(false)
    }
  }

  function toggleSize(id: string) {
    setSelectedSizes(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
  }

  async function handleSubmit() {
    if (!title.trim()) { setError('Title is required'); return }
    setSubmitting(true)
    setError(null)
    try {
      const fullDesc = [
        campaign    ? `Campaign: ${campaign}` : '',
        contentType ? `Type: ${contentType}` : '',
        selectedSizes.length ? `Sizes: ${selectedSizes.join(', ')}` : '',
        desc,
      ].filter(Boolean).join('\n')

      const res = await fetch('/api/trello-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: title, desc: fullDesc, referenceUrls: urls.filter(Boolean) }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Failed'); return }
      onCreated()
    } finally {
      setSubmitting(false)
    }
  }

  function addUrl() { setUrls(u => [...u, '']) }
  function updateUrl(i: number, v: string) { setUrls(u => u.map((x, idx) => idx === i ? v : x)) }
  function removeUrl(i: number) { setUrls(u => u.filter((_, idx) => idx !== i)) }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-zinc-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h2 className="text-lg font-bold text-zinc-900">Create Brief</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* AI Generator — at the top */}
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <p className="text-xs font-semibold text-purple-700">AI Brief Generator</p>
              <span className="text-[10px] text-purple-500">— auto-fills all fields below</span>
            </div>
            <textarea
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              rows={2}
              placeholder="Describe what you need… e.g. 'Short reel for Ballarat show featuring Atlas caravan, for families, story format'"
              className="w-full rounded-lg border border-purple-200 bg-white px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
            />
            <button
              onClick={generateBrief}
              disabled={generating || !aiPrompt.trim()}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#7c3aed' }}
            >
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {generating ? 'Generating…' : 'Generate & Fill Fields'}
            </button>
          </div>

          {/* Title + Campaign */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Title *</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Ballarat Show – Reel"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#14C29F]/40 focus:border-[#14C29F]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Campaign / Show</label>
              <input type="text" value={campaign} onChange={e => setCampaign(e.target.value)}
                placeholder="e.g. Ballarat Caravan Show 2026"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#14C29F]/40 focus:border-[#14C29F]" />
            </div>
          </div>

          {/* Brief — primary field */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Brief <span className="font-normal text-zinc-400">— keep it short</span></label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              rows={7}
              placeholder="Objective | Key Message | Tone"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-[#14C29F]/40 focus:border-[#14C29F] resize-none"
            />
          </div>

          {/* Content Type */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Content Type</label>
            <div className="flex flex-wrap gap-1.5">
              {CONTENT_TYPES.map(({ id, icon: Icon, color }) => {
                const active = contentType === id
                return (
                  <button
                    key={id}
                    onClick={() => setContentType(active ? '' : id)}
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
                      active ? 'text-white shadow-sm' : 'border-zinc-200 text-zinc-600 bg-white hover:border-zinc-300'
                    }`}
                    style={active ? { backgroundColor: color, borderColor: color } : {}}
                  >
                    <Icon className="h-3 w-3" />
                    {id}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Sizes */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Sizes <span className="font-normal text-zinc-400">(multi-select)</span></label>
            <div className="flex flex-wrap gap-1.5">
              {SIZES.map(({ id, label, desc: sDesc }) => {
                const active = selectedSizes.includes(id)
                return (
                  <button
                    key={id}
                    onClick={() => toggleSize(id)}
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
                      active ? 'border-[#14C29F] bg-[#14C29F]/10 text-[#14C29F]' : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300'
                    }`}
                  >
                    {label}
                    <span className={`text-[10px] ${active ? 'text-[#14C29F]/70' : 'text-zinc-400'}`}>{sDesc}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Reference URLs */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Reference URLs</label>
            <div className="space-y-2">
              {urls.map((url, i) => (
                <div key={i} className="flex gap-2">
                  <input type="url" value={url} onChange={e => updateUrl(i, e.target.value)}
                    placeholder="https://…"
                    className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-[#14C29F]/40 focus:border-[#14C29F]" />
                  {urls.length > 1 && (
                    <button onClick={() => removeUrl(i)} className="text-zinc-400 hover:text-red-500 transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={addUrl} className="flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-700 transition-colors">
                <Plus className="h-3.5 w-3.5" /> Add URL
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 rounded-lg border border-zinc-200 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">Cancel</button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !title.trim()}
              className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#14C29F' }}
            >
              {submitting ? 'Sending to Trello…' : 'Send to Backlog ↑'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
