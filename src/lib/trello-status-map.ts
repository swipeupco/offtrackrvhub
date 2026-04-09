import type { TaskStatus } from '@/types'

// Maps Trello list IDs → app task status
export const TRELLO_LIST_STATUS: Record<string, TaskStatus> = {
  '666fee9d24fdad7631ab5c7c': 'pending',     // Start Here ⬇️
  '69a62ad85de19df21918ba40': 'pending',     // Inspiration
  '6614e07109c74b4bf05f0da8': 'pending',     // [Backlog] 🙋
  '666fee9d24fdad7631ab5c7e': 'in_progress', // [In Production] ⚡️
  '666fee9d24fdad7631ab5c7f': 'done',        // [Approved] 👍
}

export function statusFromListId(listId: string): TaskStatus | null {
  return TRELLO_LIST_STATUS[listId] ?? null
}
