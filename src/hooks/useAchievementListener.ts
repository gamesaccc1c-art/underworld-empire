import { useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useGameStore } from '@/stores/gameStore'
import { toast } from 'sonner'

export function useAchievementListener() {
  const session = useGameStore(s => s.session)

  useEffect(() => {
    if (!session?.user) return

    const channel = supabase
      .channel('achievement-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_achievements',
          filter: `user_id=eq.${session.user.id}`,
        },
        (payload) => {
          const newRow = payload.new as { is_completed?: boolean; achievement_key?: string }
          const oldRow = payload.old as { is_completed?: boolean }
          if (newRow.is_completed && !oldRow.is_completed) {
            fetchAchievementName(newRow.achievement_key || '').then(name => {
              if (name) {
                toast.success('Basarim Acildi!', {
                  description: name,
                  duration: 5000,
                })
              }
            }).catch(() => {})
          }
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [session?.user?.id])
}

async function fetchAchievementName(key: string): Promise<string | null> {
  if (!key) return null
  const { data } = await supabase
    .from('achievement_definitions')
    .select('name')
    .eq('key', key)
    .maybeSingle()
  return data?.name || null
}
