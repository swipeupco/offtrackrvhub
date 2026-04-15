'use client'

import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { ButtonHTMLAttributes, forwardRef } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

const sizeStyles: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = 'primary', size = 'md', loading, disabled, children, className, style, ...props }, ref) => {
    const base = 'inline-flex items-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:pointer-events-none'

    const variantClass = {
      primary:   '',
      secondary: 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700',
      danger:    'bg-red-600 hover:bg-red-700 text-white',
      ghost:     'hover:bg-zinc-800 text-zinc-300',
    }[variant]

    const primaryStyle = variant === 'primary'
      ? { backgroundColor: 'var(--brand, #14C29F)', color: '#fff', ...style }
      : style

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(base, variantClass, sizeStyles[size], className)}
        style={primaryStyle}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
