'use client'

// Last-resort boundary. Only fires if the root layout itself throws; Next
// wraps this in its own <html> + <body>, so it has to render a full
// document.

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[global error boundary]', error)
  }, [error])

  return (
    <html lang="en">
      <body style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F7F8FA',
        color: '#111827',
        fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
        padding: 24,
        margin: 0,
      }}>
        <div style={{
          maxWidth: 420,
          width: '100%',
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 16,
          padding: 24,
          textAlign: 'center',
        }}>
          <h1 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Portal crashed</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '8px 0 16px' }}>
            Something outside the usual boundaries broke. A reload usually sorts it.
          </p>
          {error.digest && (
            <p style={{ fontSize: 10, color: '#9ca3af', fontFamily: 'monospace', marginBottom: 12 }}>
              Ref: {error.digest}
            </p>
          )}
          <button
            onClick={() => reset()}
            style={{
              background: '#4950F8',
              color: '#fff',
              border: 0,
              borderRadius: 12,
              padding: '8px 14px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  )
}
