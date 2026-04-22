export type Brand = 'Vacationer' | 'Radiant' | 'Atlas' | 'OzVenture'

export const ALL_BRANDS: Brand[] = ['Vacationer', 'Radiant', 'Atlas', 'OzVenture']

export type TaskStatus = 'pending' | 'urgent' | 'in_progress' | 'done'

export interface Show {
  id: string
  client_id: string
  name: string
  start_date: string   // ISO date yyyy-MM-dd
  end_date: string
  location: string
  site_number: string | null
  brands: Brand[]
  website_url: string | null
  hubspot_audience: string[] | null
  created_at: string
  updated_at: string
}

export interface DeliverablesConfig {
  id: string
  client_id: string
  name: string
  days_before_show: number
  created_at: string
}

export interface MarketingTask {
  id: string
  show_id: string
  task_name: string
  due_date: string
  trello_card_id: string | null
  status: TaskStatus
  created_at: string
  updated_at: string
}

export interface MarketingTaskWithShow extends MarketingTask {
  show: Show
}

// Form types
export type ShowFormData = Omit<Show, 'id' | 'client_id' | 'created_at' | 'updated_at'>
export type DeliverableFormData = Omit<DeliverablesConfig, 'id' | 'client_id' | 'created_at'>

export interface VideoShoot {
  id: string
  client_id: string
  title: string
  shoot_date: string
  notes: string | null
  confirmed: boolean
  created_at: string
}

export interface Van {
  id: string
  client_id: string
  model_name: string
  brand: string
  year: number | null
  price: number | null
  features: string | null
  image_url: string | null
  footage_drive_url: string | null
  images_drive_url: string | null
  website_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type VanFormData = Omit<Van, 'id' | 'client_id' | 'created_at' | 'updated_at'>
