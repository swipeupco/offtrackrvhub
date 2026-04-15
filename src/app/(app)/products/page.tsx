'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Trash2, Package, ExternalLink, Sparkles, Search } from 'lucide-react'

interface Product {
  id: string
  client_id: string
  name: string
  sku: string | null
  category: string | null
  price: number | null
  description: string | null
  image_url: string | null
  website_url: string | null
  notes: string | null
  created_at: string
}

type ProductForm = Omit<Product, 'id' | 'client_id' | 'created_at'>

const emptyForm: ProductForm = {
  name: '', sku: '', category: '', price: null,
  description: '', image_url: '', website_url: '', notes: '',
}

export default function ProductsPage() {
  const [products, setProducts]     = useState<Product[]>([])
  const [loading, setLoading]       = useState(true)
  const [clientId, setClientId]     = useState<string | null>(null)
  const [productsLabel, setProductsLabel] = useState('Products')
  const [modalOpen, setModalOpen]   = useState(false)
  const [editing, setEditing]       = useState<Product | null>(null)
  const [viewProduct, setViewProduct] = useState<Product | null>(null)
  const [form, setForm]             = useState<ProductForm>(emptyForm)
  const [saving, setSaving]         = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [search, setSearch]         = useState('')
  const [scraping, setScraping]     = useState(false)
  const saveInFlight = useRef(false)

  async function fetchProducts(cid: string) {
    const supabase = createClient()
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('client_id', cid)
      .order('name')
    setProducts((data as Product[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('client_id')
        .eq('id', user.id)
        .single()
      if (!profile?.client_id) return
      setClientId(profile.client_id)

      const { data: client } = await supabase
        .from('clients')
        .select('products_label')
        .eq('id', profile.client_id)
        .single()
      if (client?.products_label) setProductsLabel(client.products_label)

      fetchProducts(profile.client_id)
    }
    init()
  }, [])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  function openEdit(p: Product) {
    setEditing(p)
    setForm({
      name: p.name, sku: p.sku ?? '', category: p.category ?? '',
      price: p.price, description: p.description ?? '',
      image_url: p.image_url ?? '', website_url: p.website_url ?? '',
      notes: p.notes ?? '',
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (saveInFlight.current || !form.name.trim() || !clientId) return
    saveInFlight.current = true
    setSaving(true)
    const supabase = createClient()

    if (editing) {
      await supabase.from('products').update({
        ...form, price: form.price ? Number(form.price) : null,
      }).eq('id', editing.id)
    } else {
      await supabase.from('products').insert({
        ...form, client_id: clientId, price: form.price ? Number(form.price) : null,
      })
    }

    await fetchProducts(clientId)
    setSaving(false)
    saveInFlight.current = false
    setModalOpen(false)
  }

  async function handleDelete(p: Product) {
    const supabase = createClient()
    await supabase.from('products').delete().eq('id', p.id)
    setDeleteTarget(null)
    if (clientId) fetchProducts(clientId)
  }

  async function handleScrape() {
    if (!form.website_url?.trim()) return
    setScraping(true)
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: form.website_url ?? '' }),
      })
      const data = await res.json()
      if (data) {
        setForm(f => ({
          ...f,
          name: data.title || f.name,
          description: data.description || f.description,
          image_url: data.image || f.image_url,
          price: data.price || f.price,
        }))
      }
    } catch {}
    setScraping(false)
  }

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase())
  )

  const categories = [...new Set(products.map(p => p.category).filter(Boolean))]

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{productsLabel}</h1>
          <p className="text-sm text-zinc-500 mt-1">{products.length} {productsLabel.toLowerCase()} in your catalogue</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-[#14C29F] hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          Add {productsLabel.replace(/s$/, '')}
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${productsLabel.toLowerCase()}…`}
          className="w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#14C29F]/30 focus:border-[#14C29F]"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-48 rounded-2xl bg-zinc-100 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Package className="h-10 w-10 text-zinc-300 mb-3" />
          <p className="text-sm font-medium text-zinc-500">
            {search ? 'No results found' : `No ${productsLabel.toLowerCase()} yet`}
          </p>
          {!search && (
            <button onClick={openCreate} className="mt-3 text-sm font-semibold text-[#14C29F] hover:underline">
              Add your first {productsLabel.replace(/s$/, '').toLowerCase()}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map(product => (
            <div
              key={product.id}
              onClick={() => setViewProduct(product)}
              className="group bg-white rounded-2xl border border-zinc-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
            >
              {/* Image */}
              <div className="h-40 bg-zinc-100 overflow-hidden relative">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <Package className="h-10 w-10 text-zinc-300" />
                  </div>
                )}
                {/* Actions overlay */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={e => { e.stopPropagation(); openEdit(product) }}
                    className="h-7 w-7 rounded-lg bg-white shadow flex items-center justify-center text-zinc-500 hover:text-zinc-800"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setDeleteTarget(product) }}
                    className="h-7 w-7 rounded-lg bg-white shadow flex items-center justify-center text-zinc-500 hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Info */}
              <div className="p-3">
                <p className="text-sm font-semibold text-zinc-800 truncate">{product.name}</p>
                <div className="flex items-center justify-between mt-1">
                  {product.category && (
                    <span className="text-[10px] font-medium rounded-full px-2 py-0.5 bg-zinc-100 text-zinc-500">
                      {product.category}
                    </span>
                  )}
                  {product.price != null && (
                    <span className="text-xs font-bold text-zinc-700">
                      ${Number(product.price).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h2 className="font-semibold text-zinc-900">{editing ? 'Edit' : 'Add'} {productsLabel.replace(/s$/, '')}</h2>
              <button onClick={() => setModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 text-lg">×</button>
            </div>
            <div className="p-6 space-y-4">
              {/* URL scrape */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Website URL</label>
                <div className="flex gap-2">
                  <input
                    value={form.website_url ?? ''}
                    onChange={e => setForm(f => ({ ...f, website_url: e.target.value }))}
                    placeholder="https://yoursite.com/product"
                    className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#14C29F]/30"
                  />
                  <button
                    onClick={handleScrape}
                    disabled={scraping || !form.website_url?.trim()}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white bg-[#14C29F] disabled:opacity-50"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {scraping ? 'Fetching…' : 'Auto-fill'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Product name" className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#14C29F]/30" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">SKU</label>
                  <input value={form.sku ?? ''} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                    placeholder="ABC-123" className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#14C29F]/30" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Category</label>
                  <input value={form.category ?? ''} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    placeholder="e.g. Skincare" className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#14C29F]/30" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Price</label>
                  <input type="number" value={form.price ?? ''} onChange={e => setForm(f => ({ ...f, price: e.target.value ? Number(e.target.value) : null }))}
                    placeholder="49.99" className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#14C29F]/30" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Image URL</label>
                  <input value={form.image_url ?? ''} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                    placeholder="https://..." className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#14C29F]/30" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Description</label>
                  <textarea value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    rows={3} placeholder="Product description…" className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#14C29F]/30 resize-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Notes</label>
                  <textarea value={form.notes ?? ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    rows={2} placeholder="Internal notes…" className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#14C29F]/30 resize-none" />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setModalOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium border border-zinc-200 text-zinc-600 hover:bg-zinc-50">Cancel</button>
                <button onClick={handleSave} disabled={saving || !form.name.trim()}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-white bg-[#14C29F] disabled:opacity-50 hover:opacity-90 transition-opacity">
                  {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Product'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h2 className="font-semibold text-zinc-900 truncate">{viewProduct.name}</h2>
              <button onClick={() => setViewProduct(null)} className="text-zinc-400 hover:text-zinc-600 text-lg">×</button>
            </div>
            <div className="p-6 space-y-4">
              {viewProduct.image_url && (
                <img src={viewProduct.image_url} alt={viewProduct.name} className="w-full h-48 object-cover rounded-xl" />
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {viewProduct.sku && <div><p className="text-xs text-zinc-400">SKU</p><p className="font-medium">{viewProduct.sku}</p></div>}
                {viewProduct.category && <div><p className="text-xs text-zinc-400">Category</p><p className="font-medium">{viewProduct.category}</p></div>}
                {viewProduct.price != null && <div><p className="text-xs text-zinc-400">Price</p><p className="font-medium">${Number(viewProduct.price).toLocaleString()}</p></div>}
              </div>
              {viewProduct.description && (
                <div><p className="text-xs text-zinc-400 mb-1">Description</p><p className="text-sm text-zinc-700 leading-relaxed">{viewProduct.description}</p></div>
              )}
              {viewProduct.website_url && (
                <a href={viewProduct.website_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm font-medium text-[#14C29F] hover:underline">
                  <ExternalLink className="h-4 w-4" /> View product page
                </a>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => { setViewProduct(null); openEdit(viewProduct) }}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium border border-zinc-200 text-zinc-600 hover:bg-zinc-50">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <button onClick={() => { setViewProduct(null); setDeleteTarget(viewProduct) }}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50">
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <h3 className="font-semibold text-zinc-900 mb-2">Delete {deleteTarget.name}?</h3>
            <p className="text-sm text-zinc-500 mb-6">This can't be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} className="rounded-lg px-4 py-2 text-sm font-medium border border-zinc-200 text-zinc-600 hover:bg-zinc-50">Cancel</button>
              <button onClick={() => handleDelete(deleteTarget)} className="rounded-lg px-4 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
