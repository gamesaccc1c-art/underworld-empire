import { useGameStore } from '@/stores/gameStore'
import { useGuestStore } from '@/stores/guestStore'

export function usePlayer() {
  const guestStore = useGuestStore()
  const gameStore = useGameStore()

  const isGuest = guestStore.isGuest
  const player = isGuest ? guestStore.player : gameStore.player
  const buildings = isGuest ? guestStore.buildings : gameStore.buildings

  // Resource mutations are only available in guest mode.
  // Auth users go through server RPCs — use useGameStore actions directly.
  const addResources = guestStore.addResources
  const spendResources = guestStore.spendResources
  const addPoliceHeat = guestStore.addPoliceHeat

  return { isGuest, player, buildings, addResources, spendResources, addPoliceHeat }
}
