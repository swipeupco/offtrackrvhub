'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ClientOption {
  id: string
  name: string
  slug: string
  color: string
  logo_url: string | null
}

export interface ClientConfig {
  id: string
  name: string
  slug: string
  color: string
  logo_url: string | null
  has_shopify: boolean
  has_vans: boolean
  products_label: string
  in_production_limit: number
}

const DEFAULT_CONFIG: ClientConfig = {
  id: '',
  name: 'SwipeUp.',
  slug: '',
  color: '#14C29F',
  logo_url: 'https://cdn.prod.website-files.com/69c7af78672744f6f493aa6f/69c7af78672744f6f493aaa0_65efbf2df727d6b871fa6c3d_oxfSjvpwrr6ZmYc8crE9d9LKmu8.webp',
  has_shopify: false,
  has_vans: false,
  products_label: 'Products',
  in_production_limit: 1,
}

interface ActiveClientContextValue {
  clientId: string | null
  clientConfig: ClientConfig
  isAdmin: boolean
  isStaff: boolean
  clients: ClientOption[]
  setClientId: (id: string) => void
  updateClientConfig: (updates: Partial<ClientConfig>) => void
  loading: boolean
}

const ActiveClientContext = createContext<ActiveClientContextValue>({
  clientId: null,
  clientConfig: DEFAULT_CONFIG,
  isAdmin: false,
  isStaff: false,
  clients: [],
  setClientId: () => {},
  updateClientConfig: () => {},
  loading: true,
})

export function useActiveClient() {
  return useContext(ActiveClientContext)
}

const STORAGE_KEY = 'swipeup-admin-client'

export function ActiveClientProvider({ children }: { children: React.ReactNode }) {
  const [clientId, setClientIdState]    = useState<string | null>(null)
  const [clientConfig, setClientConfig] = useState<ClientConfig>(DEFAULT_CONFIG)
  const [isAdmin, setIsAdmin]           = useState(false)
  const [isStaff, setIsStaff]           = useState(false)
  const [clients, setClients]           = useState<ClientOption[]>([])
  const [loading, setLoading]           = useState(true)

  // Load client config whenever clientId changes
  useEffect(() => {
    if (!clientId) { setClientConfig(DEFAULT_CONFIG); return }
    const supabase = createClient()
    supabase
      .from('clients')
      .select('id, name, slug, color, logo_url, has_shopify, has_vans, products_label, in_production_limit')
      .eq('id', clientId)
      .single()
      .then(({ data }) => {
        if (!data) return
        // Forward-compat: if the Hub migration for in_production_limit hasn't
        // reached this environment yet, the column comes back undefined — treat
        // it as the legacy cap of 1 rather than crashing.
        const cfg = data as Partial<ClientConfig> & { in_production_limit?: number | null }
        setClientConfig({
          ...DEFAULT_CONFIG,
          ...cfg,
          in_production_limit: cfg.in_production_limit ?? 1,
        } as ClientConfig)
      })
  }, [clientId])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('client_id, is_admin, is_staff')
        .eq('id', user.id)
        .single()

      if (!profile) { setLoading(false); return }

      if (profile.is_admin) {
        setIsAdmin(true)
        const { data: allClients } = await supabase
          .from('clients')
          .select('id, name, slug, color, logo_url')
          .order('name')
        setClients(allClients ?? [])

        const stored = localStorage.getItem(STORAGE_KEY)
        const match = allClients?.find(c => c.id === stored)
        if (match) {
          setClientIdState(match.id)
        } else if (allClients && allClients.length > 0) {
          setClientIdState(allClients[0].id)
        }
      } else if (profile.is_staff) {
        setIsStaff(true)
        // Load only the clients this staff member has been granted access to
        const { data: accessRows } = await supabase
          .from('staff_client_access')
          .select('client_id, clients(id, name, slug, color, logo_url)')
          .eq('staff_id', user.id)
        const accessibleClients = (accessRows ?? [])
          .map((r: any) => r.clients)
          .filter(Boolean) as ClientOption[]
        setClients(accessibleClients)

        const stored = localStorage.getItem(STORAGE_KEY)
        const match = accessibleClients.find(c => c.id === stored)
        if (match) {
          setClientIdState(match.id)
        } else if (accessibleClients.length > 0) {
          setClientIdState(accessibleClients[0].id)
        }
      } else {
        setClientIdState(profile.client_id ?? null)
      }

      setLoading(false)
    }
    load()
  }, [])

  const setClientId = useCallback((id: string) => {
    setClientIdState(id)
    localStorage.setItem(STORAGE_KEY, id)
  }, [])

  // Called by BrandingPanel after a successful save — updates UI immediately
  const updateClientConfig = useCallback((updates: Partial<ClientConfig>) => {
    setClientConfig(prev => ({ ...prev, ...updates }))
    // Also update the clients list so the switcher shows the new name/logo
    setClients(prev => prev.map(c =>
      c.id === updates.id || c.id === clientId
        ? { ...c, ...updates }
        : c
    ))
  }, [clientId])

  return (
    <ActiveClientContext.Provider value={{
      clientId,
      clientConfig,
      isAdmin,
      isStaff,
      clients,
      setClientId,
      updateClientConfig,
      loading,
    }}>
      {children}
    </ActiveClientContext.Provider>
  )
}
