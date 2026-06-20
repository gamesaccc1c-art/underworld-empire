import { useEffect, useRef } from 'react'
import { useGuestStore } from '@/stores/guestStore'
import { useGameStore } from '@/stores/gameStore'
import { BUILDING_DEFINITIONS, getProductionPerHour } from '@/lib/game/constants'

const TICK_MS = 30_000

export function useProduction() {
  const isGuest = useGuestStore(s => s.isGuest)
  const guestBuildings = useGuestStore(s => s.buildings)
  const guestAdd = useGuestStore(s => s.addResources)
  const authBuildings = useGameStore(s => s.buildings)
  const loadPlayer = useGameStore(s => s.loadPlayer)

  const lastTickRef = useRef(Date.now())

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now()

      if (!isGuest) {
        loadPlayer().catch(() => {
          // network failure — will retry on next tick
        })
        lastTickRef.current = now
        return
      }

      // Guest: local simulation only
      const elapsed = (now - lastTickRef.current) / 3600000
      lastTickRef.current = now

      const gained: Partial<Record<string, number>> = {}
      for (const b of guestBuildings) {
        if (b.is_upgrading || b.level === 0) continue
        const def = BUILDING_DEFINITIONS.find(d => d.type === b.building_type)
        if (!def || !def.productionType) continue
        const perHour = getProductionPerHour(def, b.level)
        const amount = Math.floor(perHour * elapsed)
        if (amount > 0) {
          gained[def.productionType] = (gained[def.productionType] ?? 0) + amount
        }
      }

      if (Object.keys(gained).length > 0) {
        guestAdd(gained as Parameters<typeof guestAdd>[0])
      }
    }, TICK_MS)

    return () => clearInterval(id)
  }, [isGuest, guestBuildings, guestAdd, authBuildings, loadPlayer])
}
