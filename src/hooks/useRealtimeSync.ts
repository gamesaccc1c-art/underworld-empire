import { useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useGameStore } from '@/stores/gameStore'
import { useNotificationStore } from '@/stores/notificationStore'

/**
 * Subscribes to Supabase Realtime channels for the current user:
 * - players row UPDATE  → refreshes player state immediately
 * - notifications INSERT → refreshes notification badge
 * - player_mail INSERT   → increments mail badge
 */
export function useRealtimeSync() {
  const session = useGameStore(s => s.session)
  const loadPlayer = useGameStore(s => s.loadPlayer)
  const loadNotifs = useNotificationStore(s => s.load)
  const bumpMail = useNotificationStore(s => s.bumpMailCount)

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) return

    const channel = supabase
      .channel(`sync:${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'players', filter: `id=eq.${userId}` },
        () => { loadPlayer() },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => { loadNotifs() },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'player_mail', filter: `receiver_id=eq.${userId}` },
        () => { bumpMail() },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [session?.user?.id, loadPlayer, loadNotifs, bumpMail])
}
