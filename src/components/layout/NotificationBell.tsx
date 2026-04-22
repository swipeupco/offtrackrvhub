'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bell, Check, X } from 'lucide-react'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'

interface Notification {
  id: string
  message: string
  type: string
  link: string | null
  resolved: boolean
  created_at: string
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const router   = useRouter()

  const unresolved = notifications.filter(n => !n.resolved).length

  async function fetchNotifications() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setNotifications([]); return }
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
    setNotifications((data as Notification[]) ?? [])
  }

  useEffect(() => {
    fetchNotifications()
    const supabase = createClient()
    let unsub: (() => void) | null = null
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      const channel = supabase
        .channel(`notifications-${user.id}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        }, fetchNotifications)
        .subscribe()
      unsub = () => { supabase.removeChannel(channel) }
    })
    return () => { if (unsub) unsub() }
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function markResolved(id: string) {
    const supabase = createClient()
    await supabase.from('notifications').update({ resolved: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, resolved: true } : n))
  }

  async function markAllResolved() {
    const supabase = createClient()
    const ids = notifications.filter(n => !n.resolved).map(n => n.id)
    if (!ids.length) return
    await supabase.from('notifications').update({ resolved: true }).in('id', ids)
    setNotifications(prev => prev.map(n => ({ ...n, resolved: true })))
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(v => !v)}
        className="relative flex items-center justify-center h-9 w-9 rounded-lg text-zinc-400 hover:bg-zinc-900 hover:text-white transition-colors"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unresolved > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
            {unresolved > 9 ? '9+' : unresolved}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-full ml-2 top-0 z-50 w-80 rounded-2xl bg-white border border-zinc-200 shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
            <p className="text-sm font-semibold text-zinc-900">Notifications</p>
            <div className="flex items-center gap-2">
              {unresolved > 0 && (
                <button onClick={markAllResolved} className="text-[10px] font-medium text-zinc-500 hover:text-zinc-700 transition-colors">
                  Mark all resolved
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-600 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="h-6 w-6 mx-auto text-zinc-300 mb-2" />
                <p className="text-xs text-zinc-400">No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => {
                    if (n.link) {
                      markResolved(n.id); setOpen(false)
                      n.link.startsWith('/') ? router.push(n.link) : window.open(n.link, '_blank')
                    }
                  }}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-zinc-50 transition-colors ${
                    n.resolved ? 'opacity-50' : 'bg-white hover:bg-zinc-50'
                  } ${n.link ? 'cursor-pointer' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-700 leading-relaxed">{n.message}</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">
                      {format(new Date(n.created_at), 'd MMM · h:mm a')}
                    </p>
                    {n.link && (
                      <button
                        onClick={() => {
                          markResolved(n.id)
                          setOpen(false)
                          if (n.link!.startsWith('/')) {
                            router.push(n.link!)
                          } else {
                            window.open(n.link!, '_blank')
                          }
                        }}
                        className="text-[10px] font-semibold mt-1 inline-block hover:underline text-left"
                        style={{ color: 'var(--brand, #14C29F)' }}
                      >
                        View brief →
                      </button>
                    )}
                  </div>
                  {!n.resolved && (
                    <button
                      onClick={() => markResolved(n.id)}
                      className="flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-zinc-100 text-zinc-500 hover:bg-green-100 hover:text-green-600 transition-colors mt-0.5"
                      title="Mark resolved"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
