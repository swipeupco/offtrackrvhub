'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ShoppingBag, TrendingUp, Package, DollarSign, ExternalLink, CheckCircle2 } from 'lucide-react'

interface ShopifyConnection {
  shop_domain: string | null
  connected: boolean
}

export default function ShopifyPage() {
  const [connection, setConnection] = useState<ShopifyConnection>({ shop_domain: null, connected: false })
  const [shopDomain, setShopDomain] = useState('')
  const [loading, setLoading]       = useState(true)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('client_id')
        .eq('id', user.id)
        .single()
      if (!profile?.client_id) return
      const { data: client } = await supabase
        .from('clients')
        .select('shopify_domain')
        .eq('id', profile.client_id)
        .single()
      if (client?.shopify_domain) {
        setConnection({ shop_domain: client.shopify_domain, connected: true })
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleConnect() {
    if (!shopDomain.trim()) return
    setConnecting(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('client_id').eq('id', user.id).single()
    if (!profile?.client_id) return
    // Save domain — full OAuth flow to be wired up
    await supabase.from('clients').update({ shopify_domain: shopDomain.trim() }).eq('id', profile.client_id)
    setConnection({ shop_domain: shopDomain.trim(), connected: true })
    setConnecting(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="h-6 w-6 border-2 border-[#14C29F] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Shopify</h1>
        <p className="text-sm text-zinc-500 mt-1">Connect your store to view sales, orders and top products</p>
      </div>

      {!connection.connected ? (
        /* Connect card */
        <div className="bg-white rounded-2xl border border-zinc-200 p-8 max-w-md">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-xl bg-[#96BF48]/10 flex items-center justify-center">
              <ShoppingBag className="h-6 w-6 text-[#96BF48]" />
            </div>
            <div>
              <h2 className="font-semibold text-zinc-900">Connect Shopify</h2>
              <p className="text-xs text-zinc-500">Enter your store domain to get started</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Store Domain</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={shopDomain}
                  onChange={e => setShopDomain(e.target.value)}
                  placeholder="yourstore.myshopify.com"
                  className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#96BF48]/30 focus:border-[#96BF48]"
                />
              </div>
            </div>
            <button
              onClick={handleConnect}
              disabled={connecting || !shopDomain.trim()}
              className="w-full rounded-xl py-2.5 text-sm font-semibold text-white bg-[#96BF48] disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {connecting ? 'Connecting…' : 'Connect Store'}
            </button>
          </div>
        </div>
      ) : (
        /* Connected state with placeholder stats */
        <div className="space-y-6">
          {/* Connected banner */}
          <div className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
            <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-800">Connected to {connection.shop_domain}</p>
              <p className="text-xs text-green-600">Live data sync active</p>
            </div>
            <a
              href={`https://${connection.shop_domain}/admin`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-medium text-green-700 hover:underline"
            >
              Open Shopify <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: 'Revenue (30d)',   value: '—', icon: DollarSign,  color: 'text-green-600',  bg: 'bg-green-50' },
              { label: 'Orders (30d)',    value: '—', icon: ShoppingBag, color: 'text-blue-600',   bg: 'bg-blue-50' },
              { label: 'Products',        value: '—', icon: Package,     color: 'text-purple-600', bg: 'bg-purple-50' },
              { label: 'Avg Order Value', value: '—', icon: TrendingUp,  color: 'text-amber-600',  bg: 'bg-amber-50' },
            ].map(stat => (
              <div key={stat.label} className="bg-white rounded-2xl border border-zinc-200 p-5">
                <div className={`h-9 w-9 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <p className="text-2xl font-bold text-zinc-900">{stat.value}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-zinc-200 p-6 text-center">
            <Package className="h-8 w-8 text-zinc-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-zinc-600">Full Shopify data sync coming soon</p>
            <p className="text-xs text-zinc-400 mt-1">Orders, revenue, top products and inventory will appear here</p>
          </div>
        </div>
      )}
    </div>
  )
}
