'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, Check, AlertCircle, Palette, X } from 'lucide-react'
import { useActiveClient } from '@/lib/active-client-context'

interface ClientBranding {
  id: string
  name: string
  color: string
  logo_url: string | null
}

const PRESET_COLORS = [
  '#14C29F', '#3B82F6', '#8B5CF6', '#F59E0B',
  '#EF4444', '#EC4899', '#06B6D4', '#10B981',
  '#F97316', '#6366F1', '#84CC16', '#0EA5E9',
]

interface Toast { type: 'success' | 'error'; message: string }

interface Props {
  onBrandingChange?: (branding: ClientBranding) => void
}

export function BrandingPanel({ onBrandingChange }: Props) {
  const { clientId, loading: clientLoading } = useActiveClient()
  const [branding, setBranding]       = useState<ClientBranding | null>(null)
  const [loaded, setLoaded]           = useState(false)
  const [color, setColor]             = useState('#14C29F')
  const [displayName, setDisplayName] = useState('')
  const [logoUrl, setLogoUrl]         = useState<string | null>(null)
  const [uploading, setUploading]     = useState(false)
  const [saving, setSaving]           = useState(false)
  const [dragging, setDragging]       = useState(false)
  const [toast, setToast]             = useState<Toast | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  function showToast(type: Toast['type'], message: string) {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => {
    if (clientLoading) return
    if (!clientId) { setLoaded(true); return }

    async function load() {
      const supabase = createClient()
      const { data: client } = await supabase
        .from('clients').select('*').eq('id', clientId).single()
      if (client) {
        setBranding(client)
        setColor(client.color ?? '#14C29F')
        setDisplayName(client.name)
        setLogoUrl(client.logo_url)
      }
      setLoaded(true)
    }
    load()
  }, [clientId, clientLoading])

  async function uploadLogo(file: File) {
    if (!branding) return
    if (!file.type.startsWith('image/')) {
      showToast('error', 'Please upload an image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('error', 'File must be under 5MB')
      return
    }

    setUploading(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `logos/${branding.id}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('client-assets')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      showToast('error', 'Upload failed — ' + uploadError.message)
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('client-assets')
      .getPublicUrl(path)

    setLogoUrl(publicUrl)
    setUploading(false)
    showToast('success', 'Logo uploaded')
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadLogo(file)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadLogo(file)
  }, [branding])

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragging(true)
  }

  function handleDragLeave() { setDragging(false) }

  async function saveBranding() {
    if (!branding) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('clients')
      .update({ color, name: displayName, logo_url: logoUrl })
      .eq('id', branding.id)

    setSaving(false)
    if (error) {
      showToast('error', 'Failed to save branding')
    } else {
      showToast('success', 'Branding saved!')
      const updated = { ...branding, color, name: displayName, logo_url: logoUrl }
      setBranding(updated)
      onBrandingChange?.(updated)
    }
  }

  async function removeLogo() {
    setLogoUrl(null)
  }

  if (!loaded) return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-100 flex items-center gap-2">
        <Palette className="h-4 w-4 text-zinc-500" />
        <h2 className="font-semibold text-zinc-900 text-sm">Portal Branding</h2>
      </div>
      <div className="p-6 space-y-2">
        <div className="h-4 w-48 bg-zinc-100 rounded animate-pulse" />
        <div className="h-4 w-32 bg-zinc-100 rounded animate-pulse" />
      </div>
    </div>
  )

  if (!branding) return null

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${
          toast.type === 'success' ? 'bg-zinc-900' : 'bg-red-600'
        }`}>
          {toast.type === 'success' ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {toast.message}
        </div>
      )}

      <div className="px-6 py-4 border-b border-zinc-100 flex items-center gap-2">
        <Palette className="h-4 w-4 text-zinc-500" />
        <h2 className="font-semibold text-zinc-900 text-sm">Portal Branding</h2>
      </div>

      <div className="p-6 space-y-6">
        {/* Preview */}
        <div
          className="flex items-center gap-3 rounded-xl p-4 border border-zinc-100"
          style={{ backgroundColor: color + '10' }}
        >
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
            style={{ backgroundColor: color }}
          >
            {logoUrl ? (
              <img src={logoUrl} alt="Logo preview" className="h-full w-full object-contain p-1" />
            ) : (
              <span className="text-white font-bold text-sm">
                {displayName.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <p className="font-semibold text-zinc-900 text-sm">{displayName || 'Your Company'}</p>
            <p className="text-xs" style={{ color }}>Command Centre</p>
          </div>
          <div
            className="ml-auto h-6 w-16 rounded-full text-[10px] font-semibold text-white flex items-center justify-center"
            style={{ backgroundColor: color }}
          >
            Preview
          </div>
        </div>

        {/* Display name */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Display Name</label>
          <input
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Off Track RV"
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:border-transparent"
            style={{ '--tw-ring-color': color } as React.CSSProperties}
          />
        </div>

        {/* Logo upload */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Logo</label>
          <div
            ref={dropRef}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => !logoUrl && fileInputRef.current?.click()}
            className={`relative rounded-xl border-2 border-dashed transition-all ${
              dragging
                ? 'border-opacity-100 bg-opacity-5 scale-[1.01]'
                : 'border-zinc-200 hover:border-zinc-300'
            } ${!logoUrl ? 'cursor-pointer' : ''}`}
            style={dragging ? { borderColor: color, backgroundColor: color + '08' } : {}}
          >
            {logoUrl ? (
              <div className="flex items-center gap-3 p-4">
                <div className="h-14 w-14 rounded-lg bg-zinc-100 overflow-hidden flex items-center justify-center flex-shrink-0">
                  <img src={logoUrl} alt="Logo" className="h-full w-full object-contain p-1" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-800">Logo uploaded</p>
                  <p className="text-xs text-zinc-400 truncate">{logoUrl}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-medium border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                  >
                    Replace
                  </button>
                  <button
                    onClick={removeLogo}
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                {uploading ? (
                  <div className="h-6 w-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: color }} />
                ) : (
                  <>
                    <div className="h-10 w-10 rounded-full bg-zinc-100 flex items-center justify-center">
                      <Upload className="h-5 w-5 text-zinc-400" />
                    </div>
                    <p className="text-sm font-medium text-zinc-600">Drop your logo here</p>
                    <p className="text-xs text-zinc-400">PNG, SVG, JPG up to 5MB</p>
                  </>
                )}
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Accent colour */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-2">Accent Colour</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`h-8 w-8 rounded-full transition-transform hover:scale-110 ${
                  color === c ? 'ring-2 ring-offset-2 scale-110' : ''
                }`}
                style={{ backgroundColor: c, outlineColor: c }}
                title={c}
              />
            ))}
          </div>
          {/* Custom hex input */}
          <div className="flex items-center gap-2">
            <div
              className="h-8 w-8 rounded-lg border border-zinc-200 flex-shrink-0"
              style={{ backgroundColor: color }}
            />
            <input
              type="text"
              value={color}
              onChange={e => {
                const v = e.target.value
                if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) setColor(v)
              }}
              placeholder="#14C29F"
              className="flex-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-mono text-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#14C29F]/40"
            />
            <input
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
              className="h-8 w-10 cursor-pointer rounded border border-zinc-200 p-0.5"
              title="Pick a colour"
            />
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            onClick={saveBranding}
            disabled={saving}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ backgroundColor: color }}
          >
            {saving ? 'Saving…' : 'Save Branding'}
          </button>
        </div>
      </div>
    </div>
  )
}
