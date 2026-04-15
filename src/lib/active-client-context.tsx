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

interface ActiveClientContextValue {
  clientId: string | null
  isAdmin: boolean
  clients: ClientOption[]          // populated for admins only
  activeClient: ClientOption | null
  setClientId: (id: string) => void
  loading: boolean
}

const ActiveClientContext = createContext<ActiveClientContextValue>({
  clientId: null,
  isAdmin: false,
  clients: [],
  activeClient: null,
  setClientId: () => {},
  loading: true,
})

export function useActiveClient() {
  return useContext(ActiveClientContext)
}

const STORAGE_KEY = 'swipeup-admin-client'

export function ActiveClientProvider({ children }: { children: React.ReactNode }) {
  const [clientId, setClientIdState]  = useState<string | null>(null)
  const [isAdmin, setIsAdmin]         = useState(false)
  const [clients, setClients]         = useState<ClientOption[]>([])
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('client_id, is_admin')
        .eq('id', user.id)
        .single()

      if (!profile) { setLoading(false); return }

      if (profile.is_admin) {
        setIsAdmin(true)
        // Load all clients for the switcher
        const { data: allClients } = await supabase
          .from('clients')
          .select('id, name, slug, color, logo_url')
          .order('name')
        setClients(allClients ?? [])

        // Restore last selected client from localStorage
        const stored = localStorage.getItem(STORAGE_KEY)
        const match = allClients?.find(c => c.id === stored)
        if (match) {
          setClientIdState(match.id)
        } else if (allClients && allClients.length > 0) {
          setClientIdState(allClients[0].id)
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

  const activeClient = clients.find(c => c.id === clientId) ?? null

  return (
    <ActiveClientContext.Provider value={{ clientId, isAdmin, clients, activeClient, setClientId, loading }}>
      {children}
    </ActiveClientContext.Provider>
  )
}
