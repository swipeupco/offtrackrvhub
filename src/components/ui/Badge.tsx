'use client'

import { cn } from '@/lib/utils'

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline'

const variants: Record<Variant, string> = {
  default:  'bg-zinc-800 text-zinc-300',
  success:  'bg-emerald-900/60 text-emerald-400',
  warning:  'bg-amber-900/60 text-amber-400',
  danger:   'bg-red-900/60 text-red-400',
  info:     'text-black',
  outline:  'border border-zinc-700 text-zinc-400',
}

interface Props {
  children: React.ReactNode
  variant?: Variant
  className?: string
}

export function Badge({ children, variant = 'default', className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        variants[variant],
        className
      )}
      style={variant === 'info' ? { backgroundColor: 'var(--brand, #14C29F)' } : {}}
    >
      {children}
    </span>
  )
}
