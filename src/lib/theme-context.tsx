'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Theme = 'light' | 'dark'

interface ThemeValue {
  theme: Theme
  isDark: boolean
  setTheme: (t: Theme) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeValue | null>(null)

const STORAGE_KEY = 'swipeup-theme'

function applyClass(theme: Theme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (theme === 'dark') root.classList.add('dark')
  else root.classList.remove('dark')
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Mirror whatever the pre-hydration script already decided on <html>.
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof document === 'undefined') return 'light'
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  })

  // Hydrate from profiles.theme_preference once we know who the user is.
  // localStorage wins during the first paint (pre-hydration script handles it);
  // the DB value then reconciles on this effect — normally a no-op since we
  // write both on every toggle.
  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user || cancelled) return
      const { data } = await supabase
        .from('profiles')
        .select('theme_preference')
        .eq('id', user.id)
        .single()
      const pref = data?.theme_preference as Theme | null | undefined
      if (!pref || cancelled) return
      const current = localStorage.getItem(STORAGE_KEY) as Theme | null
      if (current !== pref) {
        localStorage.setItem(STORAGE_KEY, pref)
        applyClass(pref)
        setThemeState(pref)
      }
    })
    return () => { cancelled = true }
  }, [])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    applyClass(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch {}
    // Persist to DB best-effort — fire-and-forget, don't block UI.
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('profiles')
        .update({ theme_preference: next })
        .eq('id', user.id)
        .then(() => {})
    })
  }, [])

  const toggle = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  return (
    <ThemeContext.Provider value={{ theme, isDark: theme === 'dark', setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    // Safe fallback — render as light if the provider isn't mounted (e.g.
    // during auth pages). Toggling no-ops but reads stay consistent.
    return { theme: 'light' as Theme, isDark: false, setTheme: () => {}, toggle: () => {} }
  }
  return ctx
}
