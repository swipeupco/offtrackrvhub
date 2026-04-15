'use client'

import { format } from 'date-fns'
import { X, MapPin, Calendar, ExternalLink, Users, Hash, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { parseLocalDate, isShowComplete, getFaviconUrl } from '@/lib/date-utils'
import type { Show } from '@/types'

interface Props {
  show: Show
  taskCount: number
  urgentCount: number
  onClose: () => void
  onEdit: (show: Show) => void
  onViewTasks: (show: Show) => void
}

export function ShowDetailModal({ show, taskCount, urgentCount, onClose, onEdit, onViewTasks }: Props) {
  const start = parseLocalDate(show.start_date)
  const end   = parseLocalDate(show.end_date)
  const complete = isShowComplete(show.end_date)
  const favicon = getFaviconUrl(show.website_url)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-6 border-b border-zinc-100">
          <div className="flex items-center gap-3">
            {favicon && (
              <img src={favicon} alt="" className="h-10 w-10 rounded-lg object-contain bg-zinc-50 border border-zinc-100 p-1" />
            )}
            <div>
              <h2 className="text-lg font-bold text-zinc-900 leading-tight">
                {show.name}
                {complete && <span className="ml-2 text-xs font-normal text-zinc-400">(Complete)</span>}
              </h2>
              <div className="flex items-center gap-1 text-sm text-zinc-500 mt-0.5">
                <MapPin className="h-3.5 w-3.5" />
                {show.location}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 flex-shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Dates */}
          <div className="flex items-center gap-2 text-sm text-zinc-700">
            <Calendar className="h-4 w-4 text-zinc-400" />
            {format(start, 'd MMMM yyyy')} – {format(end, 'd MMMM yyyy')}
          </div>

          {/* Site number */}
          <div className="flex items-center gap-2 text-sm">
            <Hash className="h-4 w-4 text-zinc-400" />
            {show.site_number
              ? <span className="text-zinc-700">{show.site_number}</span>
              : <span className="text-amber-600 font-medium">Site number missing ⚠️</span>
            }
          </div>

          {/* Brands */}
          {show.brands.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Brands</p>
              <div className="flex flex-wrap gap-1.5">
                {show.brands.map(b => <Badge key={b} variant="outline">{b}</Badge>)}
              </div>
            </div>
          )}

          {/* HubSpot audience */}
          {show.hubspot_audience && show.hubspot_audience.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> HubSpot Audience
              </p>
              <div className="flex flex-wrap gap-1.5">
                {show.hubspot_audience.map(a => (
                  <span key={a} className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium text-white" style={{ backgroundColor: 'var(--brand, #14C29F)' }}>
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Website */}
          {show.website_url && (
            <a
              href={show.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Show website
            </a>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-100 bg-zinc-50">
          <button
            onClick={() => { onClose(); onViewTasks(show) }}
            className="text-sm font-medium transition-colors"
            style={{ color: 'var(--brand, #14C29F)' }}
          >
            {taskCount} task{taskCount !== 1 ? 's' : ''}
            {urgentCount > 0 && <span className="ml-1 text-red-500">· {urgentCount} urgent</span>}
          </button>
          <button
            onClick={() => { onClose(); onEdit(show) }}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium border border-zinc-200 text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit show
          </button>
        </div>
      </div>
    </div>
  )
}
