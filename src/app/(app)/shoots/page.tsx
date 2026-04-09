'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO, isPast } from 'date-fns'
import { Camera, Video, Trash2, Pencil, CalendarDays, Clock, X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { VideoShoot } from '@/types'

// ── Metadata stored as JSON in the notes field ────────────────────────────────
interface ShootMeta {
  types: string[]
  duration: string
  date2?: string
  date3?: string
  notes?: string
}

function encodeMeta(meta: ShootMeta): string {
  return JSON.stringify(meta)
}

function decodeMeta(raw: string | null): ShootMeta | null {
  if (!raw) return null
  try { return JSON.parse(raw) as ShootMeta } catch { return null }
}

// ── Form state ────────────────────────────────────────────────────────────────
type FormState = {
  title: string
  types: string[]
  duration: string
  date1: string
  date2: string
  date3: string
  notes: string
}

const emptyForm: FormState = {
  title: '', types: [], duration: '', date1: '', date2: '', date3: '', notes: '',
}

const SHOOT_TYPES = [
  { id: 'Video',  icon: Video,   label: 'Video' },
  { id: 'Photos', icon: Camera,  label: 'Photos' },
]

const DURATIONS = [
  { id: 'full-day',  label: 'Full Day',  desc: '8 hrs' },
  { id: 'half-day',  label: 'Half Day',  desc: '4 hrs' },
]

export default function ShootsPage() {
  const [shoots, setShoots]           = useState<VideoShoot[]>([])
  const [loading, setLoading]         = useState(true)
  const [modalOpen, setModalOpen]     = useState(false)
  const [editing, setEditing]         = useState<VideoShoot | null>(null)
  const [form, setForm]               = useState<FormState>(emptyForm)
  const [saving, setSaving]           = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<VideoShoot | null>(null)
  const saveInFlight = useRef(false)

  async function fetchShoots() {
    const supabase = createClient()
    const { data } = await supabase.from('video_shoots').select('*').order('shoot_date', { ascending: true })
    setShoots((data as VideoShoot[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchShoots() }, [])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  function openEdit(shoot: VideoShoot) {
    setEditing(shoot)
    const meta = decodeMeta(shoot.notes)
    setForm({
      title:    shoot.title,
      types:    meta?.types ?? [],
      duration: meta?.duration ?? '',
      date1:    shoot.shoot_date,
      date2:    meta?.date2 ?? '',
      date3:    meta?.date3 ?? '',
      notes:    meta?.notes ?? '',
    })
    setModalOpen(true)
  }

  function toggleType(id: string) {
    setForm(f => ({
      ...f,
      types: f.types.includes(id) ? f.types.filter(t => t !== id) : [...f.types, id],
    }))
  }

  async function handleSave() {
    if (saveInFlight.current || !form.date1 || form.types.length === 0 || !form.duration) return
    saveInFlight.current = true
    setSaving(true)

    const meta: ShootMeta = {
      types:    form.types,
      duration: form.duration,
      date2:    form.date2 || undefined,
      date3:    form.date3 || undefined,
      notes:    form.notes || undefined,
    }

    const title = form.title || form.types.join(' & ') + ' Shoot'
    const payload = { title, shoot_date: form.date1, notes: encodeMeta(meta) }

    const supabase = createClient()
    if (editing) {
      await supabase.from('video_shoots').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('video_shoots').insert(payload)
    }

    await fetchShoots()
    setSaving(false)
    saveInFlight.current = false
    setModalOpen(false)
  }

  async function toggleConfirmed(shoot: VideoShoot) {
    const supabase = createClient()
    await supabase.from('video_shoots').update({ confirmed: !shoot.confirmed }).eq('id', shoot.id)
    fetchShoots()
  }

  async function handleDelete(shoot: VideoShoot) {
    const supabase = createClient()
    await supabase.from('video_shoots').delete().eq('id', shoot.id)
    setDeleteTarget(null)
    fetchShoots()
  }

  const upcoming = shoots.filter(s => !isPast(parseISO(s.shoot_date)))
  const past     = shoots.filter(s =>  isPast(parseISO(s.shoot_date)))
  const canSubmit = form.types.length > 0 && !!form.duration && !!form.date1

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Video Shoots</h1>
          <p className="text-zinc-500 mt-1">Request and manage shoot bookings</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#14C29F' }}
        >
          <CalendarDays className="h-4 w-4" />
          Book Shoot
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(n => <div key={n} className="h-20 rounded-2xl bg-zinc-200 animate-pulse" />)}</div>
      ) : shoots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Video className="h-10 w-10 text-zinc-300 mb-3" />
          <p className="text-zinc-500 font-medium">No shoots booked yet</p>
          <p className="text-zinc-400 text-sm mt-1">Click "Book Shoot" to request your first booking</p>
        </div>
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Upcoming</h2>
              <div className="space-y-3">
                {upcoming.map(shoot => (
                  <ShootRow key={shoot.id} shoot={shoot} onEdit={openEdit} onDelete={setDeleteTarget} />
                ))}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Past</h2>
              <div className="space-y-3 opacity-60">
                {past.slice(-5).reverse().map(shoot => (
                  <ShootRow key={shoot.id} shoot={shoot} onEdit={openEdit} onDelete={setDeleteTarget} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Book Shoot Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <h2 className="text-base font-bold text-zinc-900">{editing ? 'Edit Shoot' : 'Book a Shoot'}</h2>
              <button onClick={() => setModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Title (optional) */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Project Title <span className="font-normal text-zinc-400">(optional)</span></label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Atlas Walkthrough Shoot"
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#14C29F]/40 focus:border-[#14C29F]"
                />
              </div>

              {/* Shoot type */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-2">Type of Shoot * <span className="font-normal text-zinc-400">(select all that apply)</span></label>
                <div className="grid grid-cols-2 gap-3">
                  {SHOOT_TYPES.map(({ id, icon: Icon, label }) => {
                    const active = form.types.includes(id)
                    return (
                      <button
                        key={id}
                        onClick={() => toggleType(id)}
                        className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all ${
                          active
                            ? 'border-[#14C29F] bg-[#14C29F]/10 text-[#14C29F]'
                            : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-2">Duration *</label>
                <div className="grid grid-cols-2 gap-3">
                  {DURATIONS.map(({ id, label, desc }) => {
                    const active = form.duration === id
                    return (
                      <button
                        key={id}
                        onClick={() => setForm(f => ({ ...f, duration: id }))}
                        className={`flex flex-col items-center gap-0.5 rounded-xl border-2 px-4 py-3 transition-all ${
                          active
                            ? 'border-[#14C29F] bg-[#14C29F]/10'
                            : 'border-zinc-200 hover:border-zinc-300'
                        }`}
                      >
                        <span className={`text-sm font-semibold ${active ? 'text-[#14C29F]' : 'text-zinc-700'}`}>{label}</span>
                        <span className="text-[10px] text-zinc-400">{desc}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Date options */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Preferred Dates *</label>
                <p className="text-[11px] text-zinc-400 mb-2">Provide up to 3 options in case one isn't available</p>
                <div className="space-y-2">
                  {[
                    { key: 'date1' as const, label: '1st preference' },
                    { key: 'date2' as const, label: '2nd preference' },
                    { key: 'date3' as const, label: '3rd preference' },
                  ].map(({ key, label }, i) => (
                    <div key={key} className="flex items-center gap-3">
                      <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        i === 0 ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-500'
                      }`}>{i + 1}</span>
                      <input
                        type="date"
                        value={form[key]}
                        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                        className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#14C29F]/40 focus:border-[#14C29F]"
                        required={i === 0}
                      />
                      <span className="text-[10px] text-zinc-400 w-24 flex-shrink-0">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Notes <span className="font-normal text-zinc-400">(optional)</span></label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="Models to feature, location, vans, special requirements…"
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-[#14C29F]/40 focus:border-[#14C29F] resize-none"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={() => setModalOpen(false)} className="flex-1 rounded-lg border border-zinc-200 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !canSubmit}
                  className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: '#14C29F' }}
                >
                  {saving ? 'Saving…' : editing ? 'Save Changes' : 'Request Booking'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Shoot" size="sm">
        <p className="text-zinc-600 text-sm">Delete <strong>{deleteTarget?.title}</strong>?</p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => deleteTarget && handleDelete(deleteTarget)}>Delete</Button>
        </div>
      </Modal>
    </div>
  )
}

function ShootRow({
  shoot, onEdit, onDelete,
}: {
  shoot: VideoShoot
  onEdit: (s: VideoShoot) => void
  onDelete: (s: VideoShoot) => void
}) {
  const meta = decodeMeta(shoot.notes)

  return (
    <div className="group flex items-center justify-between rounded-2xl bg-white border border-zinc-200 px-5 py-4 shadow-sm">
      <div>
        <p className="font-semibold text-zinc-900">{shoot.title}</p>
        <p className="text-sm text-zinc-500">{format(parseISO(shoot.shoot_date), 'EEEE, d MMMM yyyy')}</p>
        {meta && (
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {meta.types.map(t => (
              <span key={t} className="rounded-full bg-zinc-100 text-zinc-600 text-[10px] font-semibold px-2 py-0.5">
                {t}
              </span>
            ))}
            {meta.duration && (
              <span className="flex items-center gap-0.5 rounded-full bg-zinc-100 text-zinc-600 text-[10px] font-semibold px-2 py-0.5">
                <Clock className="h-2.5 w-2.5" />
                {meta.duration === 'full-day' ? 'Full Day' : 'Half Day'}
              </span>
            )}
            {meta.date2 && (
              <span className="text-[10px] text-zinc-400">
                Alt: {format(parseISO(meta.date2), 'd MMM')}{meta.date3 ? `, ${format(parseISO(meta.date3), 'd MMM')}` : ''}
              </span>
            )}
          </div>
        )}
        {meta?.notes && <p className="text-xs text-zinc-400 mt-0.5">{meta.notes}</p>}
      </div>

      <div className="flex items-center gap-2">
        <Badge variant={shoot.confirmed ? 'success' : 'default'}>
          {shoot.confirmed ? 'Confirmed' : 'Pending'}
        </Badge>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(shoot)} className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={() => onDelete(shoot)} className="rounded-lg p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
