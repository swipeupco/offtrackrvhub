'use client'

import { format } from 'date-fns'
import { MapPin, Calendar, Pencil, Trash2, ChevronRight, AlertTriangle, Users } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { isShowComplete, daysUntilStart, getFaviconUrl } from '@/lib/date-utils'
import { parseLocalDate } from '@/lib/date-utils'
import type { Show } from '@/types'

interface Props {
  show: Show
  taskCount: number
  urgentCount: number
  onEdit: (show: Show) => void
  onDelete: (show: Show) => void
  onViewTasks: (show: Show) => void
  onViewDetails: (show: Show) => void
}

export function ShowCard({ show, taskCount, urgentCount, onEdit, onDelete, onViewTasks, onViewDetails }: Props) {
  const start    = parseLocalDate(show.start_date)
  const end      = parseLocalDate(show.end_date)
  const complete = isShowComplete(show.end_date)
  const days     = daysUntilStart(show.start_date)
  const favicon  = getFaviconUrl(show.website_url)

  const statusLabel =
    complete    ? { label: 'Complete',           variant: 'default'  as const } :
    days === 0  ? { label: 'Today!',             variant: 'danger'   as const } :
    days <= 7   ? { label: `${days}d away`,      variant: 'danger'   as const } :
    days <= 30  ? { label: `${days}d away`,      variant: 'warning'  as const } :
                  { label: `${days}d away`,      variant: 'info'     as const }

  return (
    <div
      className="group rounded-2xl border border-zinc-200 bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden"
      style={{ opacity: complete ? 0.65 : 1 }}
    >
      {/* Logo banner */}
      <div className="h-16 bg-zinc-50 border-b border-zinc-100 flex items-center justify-center px-4 gap-3">
        {favicon
          ? <img src={favicon} alt="" className="h-8 w-8 object-contain flex-shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
          : <div className="h-8 w-8 rounded-lg bg-zinc-200 flex-shrink-0" />
        }
        <Badge variant={statusLabel.variant} className="ml-auto">{statusLabel.label}</Badge>
      </div>

      <div className="p-4 flex flex-col flex-1 gap-2.5">
        <div>
          <h3 className="font-semibold text-zinc-900 leading-tight text-sm">
            {show.name}
            {complete && <span className="ml-1 text-xs font-normal text-zinc-400">(Complete)</span>}
          </h3>
          <div className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{show.location}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-xs text-zinc-600">
          <Calendar className="h-3 w-3 text-zinc-400" />
          {format(start, 'd MMM')} – {format(end, 'd MMM yyyy')}
        </div>

        {/* Site number warning */}
        {!show.site_number && (
          <div className="flex items-center gap-1 text-xs text-amber-600 font-medium">
            <AlertTriangle className="h-3 w-3" />
            Site number missing
          </div>
        )}

        {/* Audience pills */}
        {show.hubspot_audience && show.hubspot_audience.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            <Users className="h-3 w-3 text-zinc-400 flex-shrink-0" />
            {show.hubspot_audience.map(a => (
              <span key={a} className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white" style={{ backgroundColor: '#14C29F' }}>
                {a}
              </span>
            ))}
          </div>
        )}

        {/* Brand badges */}
        {show.brands.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {show.brands.map(b => <Badge key={b} variant="outline" className="text-[10px] py-0">{b}</Badge>)}
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto pt-3 border-t border-zinc-100 flex items-center justify-between gap-2">
          <button
            onClick={() => onViewTasks(show)}
            className="flex items-center gap-0.5 text-xs text-zinc-500 hover:text-[#14C29F] transition-colors"
          >
            <span>{taskCount} task{taskCount !== 1 ? 's' : ''}</span>
            {urgentCount > 0 && <Badge variant="danger" className="ml-1 text-[10px]">{urgentCount} urgent</Badge>}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>

          <div className="flex items-center gap-1">
            <button
              onClick={() => onViewDetails(show)}
              className="rounded-lg px-2 py-1 text-xs font-medium border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              Details
            </button>
            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="sm" onClick={() => onEdit(show)} className="!p-1 text-zinc-400 hover:text-zinc-700">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onDelete(show)} className="!p-1 text-zinc-400 hover:!text-red-400">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
