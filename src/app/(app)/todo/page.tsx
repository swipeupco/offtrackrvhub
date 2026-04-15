'use client'
export const dynamic = 'force-dynamic'
import { useActiveClient } from '@/lib/active-client-context'
import { ClipboardList } from 'lucide-react'

export default function TodoPage() {
  const { clientConfig } = useActiveClient()
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-zinc-900 mb-2">My To Do List</h1>
      <p className="text-zinc-500">Task tracking coming soon.</p>
      <div className="mt-12 flex flex-col items-center justify-center text-center">
        <div className="h-14 w-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: `${clientConfig.color}15` }}>
          <ClipboardList className="h-7 w-7" style={{ color: clientConfig.color }} />
        </div>
        <p className="text-sm font-medium text-zinc-700">Task tracking coming soon</p>
        <p className="text-xs text-zinc-400 mt-1">This feature is being built for you</p>
      </div>
    </div>
  )
}
