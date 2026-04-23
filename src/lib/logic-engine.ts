import { addDays, differenceInDays, parseISO, format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import type { Show, DeliverablesConfig } from '@/types'

// ─── Trello helpers ───────────────────────────────────────────────────────────

async function createTrelloCard(show: Show, taskName: string): Promise<string | null> {
  const key  = process.env.NEXT_PUBLIC_TRELLO_API_KEY
  const token = process.env.NEXT_PUBLIC_TRELLO_TOKEN
  const listId = process.env.NEXT_PUBLIC_TRELLO_LIST_ID

  if (!key || !token || !listId) return null

  const desc =
    `Create ${taskName} for ${show.name}.\n` +
    `Brands: ${show.brands.join(', ')}.\n` +
    `Site: ${show.site_number ?? 'TBC'}.\n` +
    `Dates: ${show.start_date} to ${show.end_date}.`

  try {
    const res = await fetch(
      `https://api.trello.com/1/cards?key=${key}&token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `${taskName} – ${show.name}`, desc, idList: listId }),
      }
    )
    if (!res.ok) return null
    const card = await res.json()
    return card.id as string
  } catch {
    return null
  }
}

async function archiveTrelloCard(cardId: string): Promise<void> {
  const key  = process.env.NEXT_PUBLIC_TRELLO_API_KEY
  const token = process.env.NEXT_PUBLIC_TRELLO_TOKEN
  if (!key || !token) return
  try {
    await fetch(`https://api.trello.com/1/cards/${cardId}?key=${key}&token=${token}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ closed: true }),
    })
  } catch {}
}

// ─── Slack helpers ────────────────────────────────────────────────────────────

async function sendSlackAlert(message: string): Promise<void> {
  const webhookUrl = process.env.NEXT_PUBLIC_SLACK_WEBHOOK_URL
  if (!webhookUrl) return
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    })
  } catch {}
}

// ─── Core engine ─────────────────────────────────────────────────────────────

/**
 * Calculate and upsert marketing tasks for a show.
 * Called on create AND update (cascade logic).
 */
export async function syncTasksForShow(show: Show): Promise<void> {
  const supabase = createClient()
  const today = new Date()
  const showStart = parseISO(show.start_date)

  // 1. Fetch deliverables config for this client only
  const { data: configs, error } = await supabase
    .from('deliverables_config')
    .select('*')
    .eq('client_id', show.client_id)
    .order('days_before_show', { ascending: false })

  if (error || !configs) return

  // 2. Delete existing tasks for this show (cascade re-create)
  const { data: existingTasks } = await supabase
    .from('marketing_tasks')
    .select('id, trello_card_id')
    .eq('show_id', show.id)

  // Archive orphaned Trello cards before deleting
  if (existingTasks) {
    for (const task of existingTasks) {
      if (task.trello_card_id) {
        await archiveTrelloCard(task.trello_card_id)
      }
    }
  }

  await supabase.from('marketing_tasks').delete().eq('show_id', show.id)

  // 3. Create fresh tasks
  for (const config of configs as DeliverablesConfig[]) {
    const dueDate = addDays(showStart, -config.days_before_show)
    const daysUntilDue = differenceInDays(dueDate, today)
    const isUrgent = daysUntilDue <= 0 || differenceInDays(showStart, today) < config.days_before_show

    let trelloCardId: string | null = null

    // Push to Trello if within 22-day window or past it (catch-up logic)
    if (config.days_before_show >= 22 || isUrgent) {
      trelloCardId = await createTrelloCard(show, config.name)
    }

    await supabase.from('marketing_tasks').insert({
      show_id: show.id,
      task_name: config.name,
      due_date: format(dueDate, 'yyyy-MM-dd'),
      status: isUrgent ? 'urgent' : 'pending',
      trello_card_id: trelloCardId,
    })

    // Slack alerts for specific milestones
    if (config.days_before_show === 14) {
      await sendSlackAlert(
        `📢 *${show.name}* – Show Announcement EDM is due on *${format(dueDate, 'dd MMM yyyy')}*`
      )
    }
    if (config.days_before_show === 7) {
      await sendSlackAlert(
        `⏰ *${show.name}* – Reminder EDM, SMS & Socials due on *${format(dueDate, 'dd MMM yyyy')}*`
      )
    }
  }
}

/**
 * Archive all Trello cards linked to a deleted show's tasks.
 */
export async function cleanupTasksForShow(showId: string): Promise<void> {
  const supabase = createClient()
  const { data: tasks } = await supabase
    .from('marketing_tasks')
    .select('trello_card_id')
    .eq('show_id', showId)
    .not('trello_card_id', 'is', null)

  if (tasks) {
    for (const task of tasks) {
      if (task.trello_card_id) {
        await archiveTrelloCard(task.trello_card_id)
      }
    }
  }
  // The DB cascade (on delete cascade) removes the rows automatically
}
