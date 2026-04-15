'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, CalendarDays, Tent, Settings, Caravan,
  Video, LogOut, Columns2, User, Plus, ShoppingBag,
  BarChart2, Package, ChevronDown,
} from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { useActiveClient } from '@/lib/active-client-context'

export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const [profile, setProfile]           = useState<{ name: string | null; avatar_url: string | null } | null>(null)
  const [switcherOpen, setSwitcherOpen] = useState(false)

  // All config now comes from context — updates instantly when branding saved
  const { clientId, clientConfig, isAdmin, clients, setClientId } = useActiveClient()
  const { color, logo_url, name, has_shopify, has_vans, products_label } = clientConfig

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: profileData } = await supabase
        .from('profiles').select('name, avatar_url').eq('id', user.id).single()
      if (profileData) setProfile({ name: profileData.name, avatar_url: profileData.avatar_url })
    })
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const nav = [
    { href: '/dashboard',                                label: 'Dashboard',        icon: LayoutDashboard, show: true },
    { href: '/trello',                                   label: 'Creative Pipeline', icon: Columns2,       show: true },
    { href: '/calendar',                                 label: 'Calendar',         icon: CalendarDays,   show: true },
    { href: '/shows',                                    label: 'Shows',            icon: Tent,           show: has_vans },
    { href: '/shoots',                                   label: 'Video Shoots',     icon: Video,          show: has_vans },
    { href: has_vans ? '/inventory' : '/products',       label: products_label,     icon: has_vans ? Caravan : Package, show: true },
    { href: '/shopify',                                  label: 'Shopify',          icon: ShoppingBag,    show: has_shopify },
    { href: '/social',                                   label: 'Social',           icon: BarChart2,      show: true },
    { href: '/settings',                                 label: 'Settings',         icon: Settings,       show: true },
  ].filter(item => item.show)

  // Current client entry for the admin switcher button
  const activeClientEntry = clients.find(c => c.id === clientId)

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-black border-r border-zinc-800 text-white">

      {/* Logo / Client Switcher */}
      <div className="border-b border-zinc-800">
        {isAdmin ? (
          <div className="relative">
            <button
              onClick={() => setSwitcherOpen(o => !o)}
              className="flex items-center justify-between w-full px-4 py-3 hover:bg-zinc-900 transition-colors min-h-[64px]"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden"
                  style={{ backgroundColor: color }}
                >
                  {logo_url && logo_url !== 'https://cdn.prod.website-files.com/69c7af78672744f6f493aa6f/69c7af78672744f6f493aaa0_65efbf2df727d6b871fa6c3d_oxfSjvpwrr6ZmYc8crE9d9LKmu8.webp'
                    ? <img src={logo_url} alt="" className="h-full w-full object-contain p-0.5 brightness-0 invert" />
                    : name.slice(0, 2).toUpperCase()
                  }
                </div>
                <span className="text-sm font-semibold text-white truncate">{name}</span>
              </div>
              <ChevronDown className={`h-4 w-4 text-zinc-400 flex-shrink-0 transition-transform ${switcherOpen ? 'rotate-180' : ''}`} />
            </button>

            {switcherOpen && (
              <div className="absolute left-0 right-0 top-full z-50 bg-zinc-900 border border-zinc-700 rounded-b-xl shadow-xl max-h-64 overflow-y-auto">
                {clients.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setClientId(c.id); setSwitcherOpen(false) }}
                    className={`flex items-center gap-2.5 w-full px-4 py-2.5 text-left hover:bg-zinc-800 transition-colors ${c.id === clientId ? 'bg-zinc-800' : ''}`}
                  >
                    <div
                      className="h-6 w-6 rounded-md flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 overflow-hidden"
                      style={{ backgroundColor: c.color }}
                    >
                      {c.logo_url
                        ? <img src={c.logo_url} alt="" className="h-full w-full object-contain p-0.5 brightness-0 invert" />
                        : c.name.slice(0, 2).toUpperCase()
                      }
                    </div>
                    <span className="text-sm text-zinc-200 truncate">{c.name}</span>
                    {c.id === clientId && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-[#14C29F] flex-shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          // Regular client user — show their logo or name
          <div className="flex items-center justify-center px-5 py-4 min-h-[64px]">
            {logo_url ? (
              <img src={logo_url} alt={name} className="max-h-10 max-w-[160px] object-contain brightness-0 invert" />
            ) : (
              <span className="text-lg font-bold text-white tracking-tight">{name}</span>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active ? 'text-white' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
              )}
              style={active ? { backgroundColor: color } : {}}
            >
              <Icon className="h-[18px] w-[18px] flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Create Brief CTA */}
      <div className="px-3 pb-3">
        <Link
          href="/trello?newBrief=1"
          className="flex items-center gap-2.5 w-full rounded-xl px-3 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: color }}
        >
          <Plus className="h-[18px] w-[18px] flex-shrink-0" />
          Create Brief
        </Link>
      </div>

      {/* Notifications + Sign out */}
      <div className="px-3 pb-2 space-y-0.5">
        <div className="flex items-center gap-2 px-3 py-2">
          <NotificationBell />
          <span className="text-sm font-medium text-zinc-400">Notifications</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400 hover:bg-zinc-900 hover:text-white transition-colors"
        >
          <LogOut className="h-[18px] w-[18px] flex-shrink-0" />
          Sign out
        </button>
      </div>

      {/* Profile strip */}
      {profile && (
        <Link href="/settings" className="flex items-center gap-2.5 px-4 py-3 border-t border-zinc-800 hover:bg-zinc-900 transition-colors">
          <div className="h-8 w-8 rounded-full bg-zinc-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt="avatar" className="h-full w-full object-cover" />
              : <User className="h-4 w-4 text-zinc-400" />
            }
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white truncate">{profile.name || 'My Profile'}</p>
          </div>
        </Link>
      )}

      {/* Footer */}
      <div className="px-5 py-4 border-t border-zinc-800 flex flex-col items-center gap-2">
        <p className="text-xs text-zinc-600">Built by</p>
        <a href="https://swipeupco.com" target="_blank" rel="noopener noreferrer">
          <Image
            src="https://cdn.prod.website-files.com/69c7af78672744f6f493aa6f/69c7af78672744f6f493aaa0_65efbf2df727d6b871fa6c3d_oxfSjvpwrr6ZmYc8crE9d9LKmu8.webp"
            alt="SwipeUp"
            width={80}
            height={24}
            className="object-contain opacity-50 hover:opacity-100 transition-opacity brightness-0 invert"
            unoptimized
          />
        </a>
      </div>
    </aside>
  )
}
