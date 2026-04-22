'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Upload, Loader2, Check } from 'lucide-react'

type ClientRow = {
  id: string
  name: string
  slug: string
  color: string | null
  logo_url: string | null
  description: string | null
  has_shopify: boolean | null
  shopify_domain: string | null
  has_vans: boolean | null
  products_label: string | null
}

export default function OnboardingPage() {
  const router = useRouter()
  const [client, setClient] = useState<ClientRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [logoUrl, setLogoUrl]       = useState<string | null>(null)
  const [color, setColor]           = useState('#4950F8')
  const [slug, setSlug]             = useState('')
  const [description, setDesc]      = useState('')
  const [hasShopify, setHasShopify] = useState(false)
  const [shopifyDomain, setShopDom] = useState('')
  const [hasVans, setHasVans]       = useState(false)
  const [productsLabel, setProdLbl] = useState('Products')

  useEffect(() => {
    (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('client_id').eq('id', user.id).single()
      if (!profile?.client_id) { setLoading(false); return }
      const { data: clientRow } = await supabase.from('clients').select('*').eq('id', profile.client_id).single()
      if (!clientRow) { setLoading(false); return }
      setClient(clientRow as ClientRow)
      setLogoUrl((clientRow as ClientRow).logo_url ?? null)
      setColor((clientRow as ClientRow).color ?? '#4950F8')
      setSlug((clientRow as ClientRow).slug)
      setDesc((clientRow as ClientRow).description ?? '')
      setHasShopify(!!(clientRow as ClientRow).has_shopify)
      setShopDom((clientRow as ClientRow).shopify_domain ?? '')
      setHasVans(!!(clientRow as ClientRow).has_vans)
      setProdLbl((clientRow as ClientRow).products_label ?? 'Products')

      // If branding is already complete, skip straight to dashboard
      if ((clientRow as ClientRow).logo_url && (clientRow as ClientRow).color) {
        router.replace('/dashboard')
        return
      }
      setLoading(false)
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleLogoUpload(file: File) {
    if (!client) return
    if (!file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) return
    setUploading(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop() ?? 'png'
    const path = `${client.id}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('client-logos')
      .upload(path, file, { upsert: true })
    if (uploadError) {
      console.error('Logo upload failed:', uploadError)
      setUploading(false)
      return
    }
    const { data: { publicUrl } } = supabase.storage.from('client-logos').getPublicUrl(path)
    setLogoUrl(publicUrl)
    setUploading(false)
  }

  async function handleFinish() {
    if (!client) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('clients').update({
      logo_url: logoUrl,
      color,
      slug,
      description: description || null,
      has_shopify: hasShopify,
      shopify_domain: hasShopify && shopifyDomain ? shopifyDomain : null,
      has_vans: hasVans,
      products_label: productsLabel || 'Products',
    }).eq('id', client.id)
    setSaving(false)
    router.push('/dashboard')
    router.refresh()
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
  }

  if (!client) {
    return (
      <div className="max-w-md mx-auto p-8 text-center">
        <p className="text-sm text-gray-600">We couldn't find your account. Please <a href="/login" className="underline text-[#4950F8]">sign in again</a>.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome to SwipeUp</h1>
      <p className="text-sm text-gray-500 mb-8">Set up your portal. You can change any of this later from settings.</p>

      <div className="space-y-6 rounded-2xl bg-white border border-gray-200 p-6">

        {/* Logo */}
        <div>
          <label className="text-sm font-semibold text-gray-900">Logo</label>
          <p className="text-xs text-gray-500 mb-3">PNG/JPG up to 5MB</p>
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden">
              {logoUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={logoUrl} alt="Logo" className="h-full w-full object-contain p-1" />
                : <Upload className="h-5 w-5 text-gray-300" />
              }
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) handleLogoUpload(f)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {uploading ? 'Uploading…' : logoUrl ? 'Replace logo' : 'Upload logo'}
            </button>
          </div>
        </div>

        {/* Brand colour */}
        <div>
          <label className="text-sm font-semibold text-gray-900">Brand colour</label>
          <div className="flex items-center gap-3 mt-2">
            <input
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
              className="h-10 w-14 rounded-lg border border-gray-200 cursor-pointer"
            />
            <input
              type="text"
              value={color}
              onChange={e => setColor(e.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#4950F8]/20 focus:border-[#4950F8]"
              placeholder="#4950F8"
            />
          </div>
        </div>

        {/* Slug */}
        <div>
          <label className="text-sm font-semibold text-gray-900">Portal slug</label>
          <p className="text-xs text-gray-500 mb-2">Used in URLs. Lowercase letters, numbers, and hyphens.</p>
          <input
            type="text"
            value={slug}
            onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4950F8]/20 focus:border-[#4950F8]"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-sm font-semibold text-gray-900">Business description</label>
          <p className="text-xs text-gray-500 mb-2">Optional — shown on your portal's home.</p>
          <textarea
            rows={2}
            value={description}
            onChange={e => setDesc(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4950F8]/20 focus:border-[#4950F8] resize-none"
          />
        </div>

        {/* Feature toggles */}
        <div>
          <label className="text-sm font-semibold text-gray-900">Features</label>
          <p className="text-xs text-gray-500 mb-3">Toggle modules on or off — you can change these anytime.</p>
          <div className="space-y-3">
            <FeatureToggle
              label="Shopify integration"
              description="Sync products, orders, and customers."
              enabled={hasShopify}
              onToggle={setHasShopify}
            >
              {hasShopify && (
                <input
                  type="text"
                  value={shopifyDomain}
                  onChange={e => setShopDom(e.target.value)}
                  placeholder="your-store.myshopify.com"
                  className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4950F8]/20 focus:border-[#4950F8]"
                />
              )}
            </FeatureToggle>
            <FeatureToggle
              label="Vans / shows module"
              description="Caravan shows, route planning, and marketing calendar."
              enabled={hasVans}
              onToggle={setHasVans}
            />
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Products label</label>
              <input
                type="text"
                value={productsLabel}
                onChange={e => setProdLbl(e.target.value)}
                placeholder="Products"
                className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4950F8]/20 focus:border-[#4950F8]"
              />
              <p className="text-[10px] text-gray-400 mt-1">How the nav should refer to products (e.g. "Vehicles", "Stock", "Artworks")</p>
            </div>
          </div>
        </div>

      </div>

      <button
        type="button"
        onClick={handleFinish}
        disabled={saving}
        className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white bg-[#4950F8] hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {saving ? 'Saving…' : 'Complete setup'}
      </button>
    </div>
  )
}

function FeatureToggle({
  label, description, enabled, onToggle, children,
}: {
  label: string
  description: string
  enabled: boolean
  onToggle: (v: boolean) => void
  children?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-gray-200 px-4 py-3">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">{label}</p>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => onToggle(!enabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${enabled ? 'bg-[#4950F8]' : 'bg-gray-200'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>
      {children}
    </div>
  )
}
