'use client'

import { useState, useEffect } from 'react'
import { Sparkles, AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { ALL_BRANDS, type Brand, type Show, type ShowFormData } from '@/types'

interface Props {
  initial?: Partial<Show>
  onSubmit: (data: ShowFormData) => Promise<void>
  loading?: boolean
}

const AUDIENCE_OPTIONS = ['VIC Leads', 'NSW Leads', 'WA Leads', 'SA Leads', 'QLD Leads', 'ACT Leads', 'All Marketing Contacts']

const empty: ShowFormData = {
  name: '', start_date: '', end_date: '', location: '',
  site_number: '', brands: [], website_url: '', hubspot_audience: [],
}

export function ShowForm({ initial, onSubmit, loading }: Props) {
  const [form, setForm]         = useState<ShowFormData>({ ...empty, ...initial })
  const [url, setUrl]           = useState(initial?.website_url ?? '')
  const [scraping, setScraping] = useState(false)
  const [scrapeError, setScrapeError] = useState<string | null>(null)
  const [errors, setErrors]     = useState<Partial<Record<keyof ShowFormData, string>>>({})

  useEffect(() => {
    if (initial) setForm({ ...empty, ...initial })
  }, [initial])

  async function handleScrape() {
    if (!url) return
    setScraping(true)
    setScrapeError(null)
    try {
      const res  = await fetch('/api/scrape', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
      const json = await res.json()
      if (json.success && json.data) {
        setForm((f) => ({
          ...f,
          name:       json.data.name       ?? f.name,
          start_date: json.data.start_date ?? f.start_date,
          end_date:   json.data.end_date   ?? f.end_date,
          location:   json.data.location   ?? f.location,
          website_url: url,
        }))
      } else {
        setScrapeError(json.error ?? 'Could not extract details. Please fill in manually.')
      }
    } catch {
      setScrapeError('Scrape failed. Please fill in manually.')
    } finally {
      setScraping(false)
    }
  }

  function validate(): boolean {
    const e: typeof errors = {}
    if (!form.name.trim())     e.name       = 'Show name is required'
    if (!form.start_date)      e.start_date = 'Start date is required'
    if (!form.end_date)        e.end_date   = 'End date is required'
    if (!form.location.trim()) e.location   = 'Location is required'
    if (form.brands.length === 0) e.brands  = 'Select at least one brand'
    if (form.start_date && form.end_date && form.end_date < form.start_date)
      e.end_date = 'End date must be on or after start date'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function toggleBrand(brand: Brand) {
    setForm((f) => ({
      ...f,
      brands: f.brands.includes(brand) ? f.brands.filter((b) => b !== brand) : [...f.brands, brand],
    }))
  }

  function set(field: keyof ShowFormData) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    await onSubmit({ ...form, website_url: url || null, site_number: form.site_number || null })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* AI Quick-Add */}
      <div className="rounded-xl border border-zinc-700 bg-zinc-800 p-4 space-y-2">
        <p className="text-sm font-medium flex items-center gap-1.5" style={{ color: '#14C29F' }}>
          <Sparkles className="h-4 w-4" />
          AI Quick-Add — paste a show URL to auto-fill details
        </p>
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.caravanshow.com.au/..."
            className="flex-1 rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#14C29F]/30 focus:border-[#14C29F]"
          />
          <Button type="button" size="sm" loading={scraping} onClick={handleScrape} disabled={!url}>
            Extract
          </Button>
        </div>
        {scrapeError && (
          <p className="flex items-center gap-1.5 text-xs text-red-400">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            {scrapeError}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input id="name" label="Show Name *" value={form.name} onChange={set('name')} placeholder="Sydney Caravan & Camping Show" error={errors.name} />
        <Input id="location" label="Location *" value={form.location} onChange={set('location')} placeholder="Sydney Showground, Homebush" error={errors.location} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input id="start_date" label="Start Date *" type="date" value={form.start_date} onChange={set('start_date')} error={errors.start_date} />
        <Input id="end_date" label="End Date *" type="date" value={form.end_date} onChange={set('end_date')} error={errors.end_date} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input id="site_number" label="Site Number" value={form.site_number ?? ''} onChange={set('site_number')} placeholder="Site 12A" />
        <Input id="website_url" label="Website URL" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
      </div>

      {/* Brands */}
      <div>
        <p className="mb-2 text-sm font-medium text-zinc-300">Brands *</p>
        <div className="flex flex-wrap gap-2">
          {ALL_BRANDS.map((brand) => (
            <button
              key={brand}
              type="button"
              onClick={() => toggleBrand(brand)}
              className="rounded-full px-4 py-1.5 text-sm font-medium border transition-all"
              style={
                form.brands.includes(brand)
                  ? { backgroundColor: '#14C29F', color: '#fff', borderColor: '#14C29F' }
                  : { backgroundColor: 'transparent', color: '#a1a1aa', borderColor: '#52525b' }
              }
            >
              {brand}
            </button>
          ))}
        </div>
        {errors.brands && <p className="mt-1 text-xs text-red-400">{errors.brands}</p>}
      </div>

      {/* HubSpot Audience */}
      <div>
        <p className="mb-2 text-sm font-medium text-zinc-300">HubSpot Audience</p>
        <div className="flex flex-wrap gap-2">
          {AUDIENCE_OPTIONS.map((a) => {
            const selected = (form.hubspot_audience ?? []).includes(a)
            return (
              <button
                key={a}
                type="button"
                onClick={() => setForm(f => ({
                  ...f,
                  hubspot_audience: selected
                    ? (f.hubspot_audience ?? []).filter(x => x !== a)
                    : [...(f.hubspot_audience ?? []), a],
                }))}
                className="rounded-full px-3 py-1 text-xs font-medium border transition-all"
                style={
                  selected
                    ? { backgroundColor: '#14C29F', color: '#fff', borderColor: '#14C29F' }
                    : { backgroundColor: 'transparent', color: '#a1a1aa', borderColor: '#52525b' }
                }
              >
                {a}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" loading={loading} size="lg">
          {initial?.id ? 'Save Changes' : 'Add Show'}
        </Button>
      </div>
    </form>
  )
}
