'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, ExternalLink, Pencil, Trash2, Image as ImageIcon, Sparkles, Upload, X, PlayCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import type { Van, VanFormData } from '@/types'

const BRANDS = ['Vacationer', 'Radiant', 'Atlas', 'OzVenture'] as const

const BRAND_BG: Record<string, string> = {
  Vacationer: 'linear-gradient(135deg, #0d9676 0%, #14C29F 50%, #a7f3e0 100%)',
  Radiant:    'linear-gradient(135deg, #b45309 0%, #f59e0b 50%, #fde68a 100%)',
  Atlas:      'linear-gradient(135deg, #4338ca 0%, #6366f1 50%, #c7d2fe 100%)',
  OzVenture:  'linear-gradient(135deg, #be185d 0%, #ec4899 50%, #fbcfe8 100%)',
}

function getBrandColor(brand: string): string {
  const match = BRANDS.find(b => brand.toLowerCase().includes(b.toLowerCase()))
  return BRAND_BG[match ?? ''] ?? 'linear-gradient(135deg, #3f3f46 0%, #71717a 100%)'
}

const emptyForm: VanFormData = {
  model_name: '', brand: 'Vacationer', year: null, price: null,
  features: '', image_url: '', footage_drive_url: '',
  images_drive_url: '', website_url: '', notes: '',
}

function getYouTubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v')
      if (v) return `https://www.youtube.com/embed/${v}`
    }
    if (u.hostname === 'youtu.be') {
      return `https://www.youtube.com/embed${u.pathname}`
    }
  } catch {}
  return null
}

export default function InventoryPage() {
  const [vans, setVans]           = useState<Van[]>([])
  const [loading, setLoading]     = useState(true)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [viewVan, setViewVan]     = useState<Van | null>(null)
  const [editing, setEditing]     = useState<Van | null>(null)
  const [form, setForm]           = useState<VanFormData>(emptyForm)
  const [saving, setSaving]       = useState(false)
  const [scraping, setScraping]   = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Van | null>(null)
  const saveInFlight = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function fetchVans() {
    const supabase = createClient()
    const { data, error } = await supabase.from('vans').select('*').order('brand').order('model_name')
    if (error) console.error('fetchVans error:', error)
    setVans((data as Van[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchVans() }, [])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setSaveError(null)
    setModalOpen(true)
  }

  function openEdit(van: Van) {
    setEditing(van)
    setSaveError(null)
    setForm({
      model_name: van.model_name, brand: van.brand, year: van.year,
      price: van.price, features: van.features ?? '',
      image_url: van.image_url ?? '', footage_drive_url: van.footage_drive_url ?? '',
      images_drive_url: van.images_drive_url ?? '', website_url: van.website_url ?? '',
      notes: van.notes ?? '',
    })
    setModalOpen(true)
  }

  async function handleScrape() {
    if (!form.website_url) return
    setScraping(true)
    try {
      const res  = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: form.website_url, mode: 'van' }),
      })
      const json = await res.json()
      if (json.success && json.data) {
        const d = json.data
        setForm((f) => ({
          ...f,
          model_name: d.model_name ?? f.model_name,
          brand:      d.brand      ?? f.brand,
          price:      d.price      ?? f.price,
          features:   d.features   ?? f.features,
          image_url:  d.image_url  ?? f.image_url,
        }))
      }
    } finally {
      setScraping(false)
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      setForm(f => ({ ...f, image_url: dataUrl }))
      setUploading(false)
    }
    reader.onerror = () => {
      setSaveError('Failed to read image file')
      setUploading(false)
    }
    reader.readAsDataURL(file)
  }

  async function handleSave() {
    if (saveInFlight.current || !form.model_name || !form.brand) return
    saveInFlight.current = true
    setSaving(true)
    setSaveError(null)
    const supabase = createClient()
    const payload = {
      ...form,
      image_url:         form.image_url || null,
      footage_drive_url: form.footage_drive_url || null,
      images_drive_url:  form.images_drive_url || null,
      website_url:       form.website_url || null,
      features:          form.features || null,
      notes:             form.notes || null,
    }
    const { error } = editing
      ? await supabase.from('vans').update(payload).eq('id', editing.id)
      : await supabase.from('vans').insert(payload)

    if (error) {
      setSaveError(error.message)
      setSaving(false)
      saveInFlight.current = false
      return
    }
    await fetchVans()
    setSaving(false)
    saveInFlight.current = false
    setModalOpen(false)
  }

  async function handleDelete(van: Van) {
    const supabase = createClient()
    await supabase.from('vans').delete().eq('id', van.id)
    setDeleteTarget(null)
    fetchVans()
  }

  function set(field: keyof VanFormData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }))
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Van Inventory</h1>
          <p className="text-zinc-500 mt-1">{vans.length} model{vans.length !== 1 ? 's' : ''} in stock</p>
        </div>
        <Button onClick={openCreate} size="lg">
          <Plus className="h-4 w-4" />
          Add Van
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1,2,3,4].map(n => <div key={n} className="h-64 rounded-2xl bg-zinc-200 animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-10">
          {BRANDS.map(brand => {
            const brandVans = vans.filter(v => v.brand.toLowerCase().includes(brand.toLowerCase()))
            return (
              <div key={brand}>
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">{brand}</h2>
                  <span className="text-xs text-zinc-400">{brandVans.length} model{brandVans.length !== 1 ? 's' : ''}</span>
                </div>
                {brandVans.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 py-8 text-center">
                    <p className="text-sm text-zinc-400">No {brand} models added yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {brandVans.map(van => (
                      <VanCard key={van.id} van={van} onEdit={openEdit} onDelete={setDeleteTarget} onView={setViewVan} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Detail / "See more" Modal */}
      {viewVan && (
        <VanDetailModal van={viewVan} onClose={() => setViewVan(null)} onEdit={(v) => { setViewVan(null); openEdit(v) }} />
      )}

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Van' : 'Add Van'} size="lg">
        <div className="space-y-4">
          {/* AI scrape from URL */}
          <div className="rounded-xl border border-zinc-700 bg-zinc-800 p-4 space-y-2">
            <p className="text-sm font-medium flex items-center gap-1.5" style={{ color: '#14C29F' }}>
              <Sparkles className="h-4 w-4" />
              Paste the van's webpage URL to auto-fill details
            </p>
            <div className="flex gap-2">
              <input
                type="url"
                value={form.website_url ?? ''}
                onChange={(e) => setForm(f => ({ ...f, website_url: e.target.value }))}
                placeholder="https://www.offtrackrv.com.au/van-model"
                className="flex-1 rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#14C29F]/30 focus:border-[#14C29F]"
              />
              <Button type="button" size="sm" loading={scraping} onClick={handleScrape} disabled={!form.website_url}>
                Extract
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input id="model_name" label="Model Name *" value={form.model_name} onChange={set('model_name')} placeholder="Vacationer 18ft" />
            {/* Brand dropdown */}
            <div className="flex flex-col gap-1">
              <label htmlFor="brand" className="text-sm font-medium text-zinc-300">Brand *</label>
              <select
                id="brand"
                value={form.brand}
                onChange={(e) => setForm(f => ({ ...f, brand: e.target.value }))}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-[#14C29F] focus:outline-none focus:ring-2 focus:ring-[#14C29F]/20"
              >
                {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input id="year" label="Year" type="number" value={form.year ?? ''} onChange={(e) => setForm(f => ({ ...f, year: parseInt(e.target.value) || null }))} placeholder="2024" />
            <Input id="price" label="Price (AUD)" type="number" value={form.price ?? ''} onChange={(e) => setForm(f => ({ ...f, price: parseFloat(e.target.value) || null }))} placeholder="85000" />
          </div>

          {/* Hero Image Upload */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-300">Hero Image</label>
            <div className="flex items-center gap-3">
              {form.image_url ? (
                <img src={form.image_url} alt="preview" className="h-14 w-20 rounded-lg object-cover border border-zinc-700" />
              ) : (
                <div className="h-14 w-20 rounded-lg border border-zinc-700 bg-zinc-800 flex items-center justify-center">
                  <ImageIcon className="h-5 w-5 text-zinc-500" />
                </div>
              )}
              <div className="flex-1 space-y-1.5">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                <Button type="button" variant="secondary" size="sm" loading={uploading} onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5" />
                  {form.image_url ? 'Replace Image' : 'Upload Image'}
                </Button>
                {form.image_url && (
                  <button type="button" onClick={() => setForm(f => ({ ...f, image_url: '' }))} className="block text-xs text-zinc-500 hover:text-red-400">
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input id="footage_drive_url" label="Walkthrough Video (YouTube)" value={form.footage_drive_url ?? ''} onChange={set('footage_drive_url')} placeholder="https://www.youtube.com/watch?v=..." />
            <Input id="images_drive_url" label="Google Drive — Images" value={form.images_drive_url ?? ''} onChange={set('images_drive_url')} placeholder="https://drive.google.com/..." />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-300">Features / Description</label>
            <textarea
              value={form.features ?? ''}
              onChange={(e) => setForm(f => ({ ...f, features: e.target.value }))}
              rows={4}
              placeholder="Key features, specs, selling points..."
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-[#14C29F] focus:outline-none focus:ring-2 focus:ring-[#14C29F]/20 resize-none"
            />
          </div>

          {saveError && (
            <p className="text-sm text-red-400 rounded-lg bg-red-950 border border-red-800 px-3 py-2">{saveError}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={handleSave} disabled={!form.model_name || !form.brand}>
              {editing ? 'Save Changes' : 'Add Van'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Van" size="sm">
        <p className="text-zinc-400 text-sm">Delete <strong className="text-white">{deleteTarget?.model_name}</strong>?</p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => deleteTarget && handleDelete(deleteTarget)}>Delete</Button>
        </div>
      </Modal>
    </div>
  )
}

function VanCard({ van, onEdit, onDelete, onView }: {
  van: Van
  onEdit: (v: Van) => void
  onDelete: (v: Van) => void
  onView: (v: Van) => void
}) {
  return (
    <div className="group rounded-2xl bg-white border border-zinc-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow flex flex-col">
      {/* Image */}
      <div
        className="h-44 flex items-center justify-center overflow-hidden flex-shrink-0 relative"
        style={{ background: `url('/van-default.png') center/cover no-repeat` }}
      >
        {van.image_url && (
          <img
            src={van.image_url}
            alt={van.model_name}
            className="w-full h-full object-contain drop-shadow-xl"
            style={{ padding: '8px' }}
          />
        )}
      </div>

      <div className="p-4 flex flex-col flex-1 gap-2">
        <div>
          <p className="font-semibold text-zinc-900 leading-tight">{van.model_name}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{van.brand}{van.year ? ` · ${van.year}` : ''}</p>
        </div>

        {van.price && (
          <p className="text-sm font-bold" style={{ color: '#14C29F' }}>
            ${van.price.toLocaleString('en-AU')}
          </p>
        )}

        <div className="mt-auto pt-2 flex items-center justify-between">
          <button
            onClick={() => onView(van)}
            className="rounded-lg px-3 py-1.5 text-xs font-medium border border-zinc-200 text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            See more
          </button>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => onEdit(van)} className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => onDelete(van)} className="rounded-lg p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function VanDetailModal({ van, onClose, onEdit }: { van: Van; onClose: () => void; onEdit: (v: Van) => void }) {
  const embedUrl = van.footage_drive_url ? getYouTubeEmbedUrl(van.footage_drive_url) : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header image */}
        <div
          className="h-56 overflow-hidden rounded-t-2xl flex items-center justify-center"
          style={{ background: `url('/van-default.png') center/cover no-repeat` }}
        >
          {van.image_url && (
            <img src={van.image_url} alt={van.model_name} className="h-full w-full object-contain drop-shadow-2xl" style={{ padding: '16px' }} />
          )}
        </div>

        <div className="p-6 space-y-5">
          {/* Title row */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">{van.model_name}</h2>
              <p className="text-zinc-400 text-sm mt-0.5">{van.brand}{van.year ? ` · ${van.year}` : ''}</p>
              {van.price && (
                <p className="text-lg font-bold mt-1" style={{ color: '#14C29F' }}>
                  ${van.price.toLocaleString('en-AU')}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => onEdit(van)} className="rounded-lg px-3 py-1.5 text-xs font-medium border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors">
                <Pencil className="h-3.5 w-3.5 inline mr-1" />Edit
              </button>
              <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* YouTube embed */}
          {embedUrl && (
            <div>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <PlayCircle className="h-3.5 w-3.5" /> Walkthrough Video
              </h3>
              <div className="relative rounded-xl overflow-hidden" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  src={embedUrl}
                  title="Walkthrough"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                />
              </div>
            </div>
          )}

          {/* Features */}
          {van.features && (
            <div>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Features & Description</h3>
              <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{van.features}</p>
            </div>
          )}

          {/* Links */}
          {(van.images_drive_url || van.website_url || (van.footage_drive_url && !embedUrl)) && (
            <div>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Links</h3>
              <div className="flex flex-wrap gap-2">
                {van.images_drive_url && (
                  <a href={van.images_drive_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors">
                    <ExternalLink className="h-3.5 w-3.5" /> Image Gallery (Drive)
                  </a>
                )}
                {van.website_url && (
                  <a href={van.website_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors">
                    <ExternalLink className="h-3.5 w-3.5" /> Website
                  </a>
                )}
                {van.footage_drive_url && !embedUrl && (
                  <a href={van.footage_drive_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors">
                    <ExternalLink className="h-3.5 w-3.5" /> Walkthrough Video
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
