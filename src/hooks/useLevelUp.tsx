import { useEffect, useRef, useState } from 'react'
import { useGuestStore } from '@/stores/guestStore'
import { useGameStore } from '@/stores/gameStore'
import { LevelUpModal } from '@/components/shared/LevelUpModal'

export function useLevelUp() {
  const isGuest = useGuestStore(s => s.isGuest)
  const guestLevel = useGuestStore(s => s.player?.level)
  const authLevel = useGameStore(s => s.player?.level)

  const prevLevelRef = useRef<number | undefined>(undefined)
  const [celebrateLevel, setCelebrateLevel] = useState<number | null>(null)

  const level = isGuest ? guestLevel : authLevel

  useEffect(() => {
    if (level === undefined) return
    if (prevLevelRef.current !== undefined && level > prevLevelRef.current) {
      setCelebrateLevel(level)
    }
    prevLevelRef.current = level
  }, [level])

  const modal = celebrateLevel !== null
    ? <LevelUpModal level={celebrateLevel} onClose={() => setCelebrateLevel(null)} />
    : null

  return { modal }
}
