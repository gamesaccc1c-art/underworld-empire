import { create } from 'zustand'
import { supabase } from '@/lib/supabase/client'

export interface AppNotification {
  id: string
  type: string
  title: string
  body: string | null
  is_read: boolean
  metadata: Record<string, unknown>
  created_at: string
}

interface NotificationState {
  notifications: AppNotification[]
  unreadCount: number
  unreadMailCount: number
  loading: boolean
  load: () => Promise<void>
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  bumpMailCount: () => void
  resetMailCount: () => void
  loadMailCount: () => Promise<void>
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  unreadMailCount: 0,
  loading: false,

  load: async () => {
    set({ loading: true })
    try {
      const { data, error } = await supabase.rpc('get_notifications', { p_limit: 30 })
      if (!error && data?.ok) {
        set({
          notifications: (data.notifications || []) as AppNotification[],
          unreadCount: Number(data.unread_count) || 0,
        })
      }
    } catch {
      // network failure — leave existing state
    } finally {
      set({ loading: false })
    }
  },

  markRead: async (id: string) => {
    const { error } = await supabase.rpc('mark_notification_read', { p_notification_id: id })
    if (!error) {
      set(s => ({
        notifications: s.notifications.map(n => n.id === id ? { ...n, is_read: true } : n),
        unreadCount: Math.max(0, s.unreadCount - 1),
      }))
    }
  },

  markAllRead: async () => {
    const { error } = await supabase.rpc('mark_all_notifications_read')
    if (!error) {
      set(s => ({
        notifications: s.notifications.map(n => ({ ...n, is_read: true })),
        unreadCount: 0,
      }))
    }
  },

  bumpMailCount: () => set(s => ({ unreadMailCount: s.unreadMailCount + 1 })),

  resetMailCount: () => set({ unreadMailCount: 0 }),

  loadMailCount: async () => {
    try {
      const { data } = await supabase.rpc('get_inbox', { p_limit: 1, p_offset: 0 })
      if (data?.ok) set({ unreadMailCount: Number(data.unread) || 0 })
    } catch {
      // leave existing state
    }
  },
}))
