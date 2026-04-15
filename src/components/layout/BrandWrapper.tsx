'use client'

import { useActiveClient } from '@/lib/active-client-context'

export function BrandWrapper({ children }: { children: React.ReactNode }) {
  const { clientConfig } = useActiveClient()
  return (
    <div
      className="flex h-full min-h-screen"
      style={{ '--brand': clientConfig.color } as React.CSSProperties}
    >
      {children}
    </div>
  )
}
