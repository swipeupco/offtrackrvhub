'use client'

// Route-level error boundary for every page under (app). Next renders this
// whenever a child throws during render/effects. Kept intentionally generic —
// feature pages should still catch their own expected failures (network,
// validation, etc.) closer to the source.

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle, RotateCcw } from 'lucide-react'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app error boundary]', error)
  }, [error])

  return (
    <div className="min-h-[calc(100vh-68px)] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-gray-100 dark:border-white/[0.08] bg-white dark:bg-[#161B26] shadow-sm p-6 text-center">
        <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-red-50 dark:bg-red-500/15 flex items-center justify-center">
          <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-300" />
        </div>
        <h1 className="text-base font-semibold text-gray-900 dark:text-white">Something went wrong</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          This page hit an unexpected error. You can try again, or head back to the dashboard.
        </p>
        {error.digest && (
          <p className="mt-3 text-[10px] font-mono text-gray-400 dark:text-gray-500">Ref: {error.digest}</p>
        )}
        <div className="mt-4 flex gap-2 justify-center">
          <button
            onClick={() => reset()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#4950F8] hover:bg-[#5A61FA] px-3 py-2 text-xs font-semibold text-white transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            Try again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-xl border border-gray-200 dark:border-white/10 px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
