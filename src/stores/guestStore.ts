import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GamePlayer, Building } from '@/types/game'
import { BUILDING_DEFINITIONS, getBuildingUpgradeCost, getBuildingUpgradeDuration, getXpForLevel, getTitleForLevel } from '@/lib/game/constants'

type ResourceKey = 'cash' | 'influence' | 'loyalty' | 'weapon_power' | 'black_money' | 'intel' | 'diamonds' | 'xp'
const RESOURCE_KEYS: readonly ResourceKey[] = ['cash', 'influence', 'loyalty', 'weapon_power', 'black_money', 'intel', 'diamonds', 'xp'] as const

function makeGuestPlayer(): GamePlayer {
  return {
    id: 'guest-' + Math.random().toString(36).slice(2, 10),
    email: 'misafir@oyun.com',
    username: 'Misafir Patron',
    avatar_url: null,
    level: 1,
    xp: 0,
    vip_level: 0,
    vip_points: 0,
    power: 10,
    family_id: null,
    title: 'Sokak Serserisi',
    reputation: 0,
    diamonds: 100,
    cash: 50000,
    influence: 200,
    loyalty: 100,
    weapon_power: 100,
    black_money: 0,
    intel: 50,
    police_heat: 0,
    raid_energy: 10,
    dark_job_energy: 5,
    spy_energy: 3,
    max_raid_energy: 10,
    max_dark_job_energy: 5,
    max_spy_energy: 3,
    shield_until: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

interface GuestState {
  isGuest: boolean
  player: GamePlayer | null
  buildings: Building[]
  activeMissionIds: string[]
  claimedDailyReward: string | null
  dailyLoginStreak: number

  initGuest: () => void
  updatePlayer: (updates: Partial<GamePlayer>) => void
  addBuilding: (buildingType: string) => void
  upgradeBuilding: (buildingId: string, buildingType: string) => boolean
  finishUpgrade: (buildingId: string) => void
  addResources: (res: Partial<Pick<GamePlayer, 'cash' | 'influence' | 'loyalty' | 'weapon_power' | 'black_money' | 'intel' | 'diamonds' | 'xp'>>) => void
  spendResources: (res: Partial<Pick<GamePlayer, 'cash' | 'influence' | 'loyalty' | 'weapon_power' | 'black_money' | 'intel' | 'diamonds'>>) => boolean
  addPoliceHeat: (amount: number) => void
  claimDailyReward: () => void
  exitGuest: () => void
}

export const useGuestStore = create<GuestState>()(
  persist(
    (set, get) => ({
      isGuest: false,
      player: null,
      buildings: [],
      activeMissionIds: [],
      claimedDailyReward: null,
      dailyLoginStreak: 0,

      initGuest: () => {
        const existing = get().player
        if (existing && existing.id.startsWith('guest-')) {
          set({ isGuest: true })
          return
        }
        set({ isGuest: true, player: makeGuestPlayer(), buildings: [], activeMissionIds: [] })
      },

      updatePlayer: (updates) => {
        const { player } = get()
        if (!player) return
        set({ player: { ...player, ...updates, updated_at: new Date().toISOString() } })
      },

      addBuilding: (buildingType) => {
        const { buildings } = get()
        const alreadyExists = buildings.some(b => b.building_type === buildingType)
        if (alreadyExists) return
        const validDef = BUILDING_DEFINITIONS.find(d => d.type === buildingType)
        if (!validDef) return
        const newBuilding: Building = {
          id: 'b-' + Math.random().toString(36).slice(2, 10),
          user_id: get().player?.id || 'guest',
          building_type: validDef.type,
          level: 1,
          upgrade_started_at: null,
          upgrade_ends_at: null,
          is_upgrading: false,
          last_collected_at: new Date().toISOString(),
        }
        set({ buildings: [...buildings, newBuilding] })
      },

      upgradeBuilding: (buildingId, buildingType) => {
        const { player, buildings } = get()
        if (!player) return false
        const def = BUILDING_DEFINITIONS.find(d => d.type === buildingType)
        if (!def) return false
        const building = buildings.find(b => b.id === buildingId)
        if (!building) return false

        const cost = getBuildingUpgradeCost(def, building.level)
        const canAfford = Object.entries(cost).every(
          ([res, amount]) => amount === 0 || (RESOURCE_KEYS.includes(res as ResourceKey) && player[res as ResourceKey] >= amount)
        )
        if (!canAfford) return false

        const updatedPlayer = { ...player }
        for (const [res, amount] of Object.entries(cost)) {
          if (amount > 0 && RESOURCE_KEYS.includes(res as ResourceKey)) {
            updatedPlayer[res as ResourceKey] = player[res as ResourceKey] - amount
          }
        }

        const duration = getBuildingUpgradeDuration(def, building.level)
        const now = new Date()
        const endsAt = new Date(now.getTime() + duration * 1000)

        set({
          player: updatedPlayer,
          buildings: buildings.map(b =>
            b.id === buildingId
              ? { ...b, is_upgrading: true, upgrade_started_at: now.toISOString(), upgrade_ends_at: endsAt.toISOString() }
              : b
          )
        })
        return true
      },

      finishUpgrade: (buildingId) => {
        const { buildings, player } = get()
        const building = buildings.find(b => b.id === buildingId)
        if (!building || !player) return
        const newLevel = building.level + 1
        const xpGain = newLevel * 50
        const powerGain = newLevel * 10
        set({
          buildings: buildings.map(b =>
            b.id === buildingId
              ? { ...b, level: newLevel, is_upgrading: false, upgrade_started_at: null, upgrade_ends_at: null }
              : b
          ),
          player: { ...player, xp: player.xp + xpGain, power: player.power + powerGain }
        })
      },

      addResources: (resources) => {
        const { player } = get()
        if (!player) return
        const updated = { ...player }
        for (const [key, val] of Object.entries(resources)) {
          if (val !== undefined && RESOURCE_KEYS.includes(key as ResourceKey)) {
            updated[key as ResourceKey] = Math.max(0, player[key as ResourceKey] + val)
          }
        }
        // Multi-levelup loop
        let xpNeeded = getXpForLevel(updated.level + 1)
        while (updated.xp >= xpNeeded && updated.level < 500) {
          updated.level += 1
          updated.xp = Math.max(0, updated.xp - xpNeeded)
          updated.title = getTitleForLevel(updated.level)
          updated.power += updated.level * 20
          xpNeeded = getXpForLevel(updated.level + 1)
        }
        set({ player: updated })
      },

      spendResources: (resources) => {
        const { player } = get()
        if (!player) return false
        for (const [key, val] of Object.entries(resources)) {
          if (val && RESOURCE_KEYS.includes(key as ResourceKey) && player[key as ResourceKey] < val) return false
        }
        const updated = { ...player }
        for (const [key, val] of Object.entries(resources)) {
          if (val && RESOURCE_KEYS.includes(key as ResourceKey)) {
            updated[key as ResourceKey] = player[key as ResourceKey] - val
          }
        }
        set({ player: updated })
        return true
      },

      addPoliceHeat: (amount) => {
        const { player } = get()
        if (!player) return
        set({ player: { ...player, police_heat: Math.min(100, Math.max(0, player.police_heat + amount)) } })
      },

      claimDailyReward: () => {
        const today = new Date().toDateString()
        const { claimedDailyReward, dailyLoginStreak } = get()
        if (claimedDailyReward === today) return
        const isConsecutive = claimedDailyReward === new Date(Date.now() - 86400000).toDateString()
        const newStreak = isConsecutive ? dailyLoginStreak + 1 : 1
        const bonusCash = 1000 * newStreak
        const bonusDiamonds = newStreak >= 7 ? 50 : 0
        get().addResources({ cash: bonusCash, diamonds: bonusDiamonds })
        set({ claimedDailyReward: today, dailyLoginStreak: newStreak })
      },

      exitGuest: () => {
        set({ isGuest: false, player: null, buildings: [], activeMissionIds: [], claimedDailyReward: null, dailyLoginStreak: 0 })
      },
    }),
    {
      name: 'underworld-guest',
      partialize: (state) => ({
        isGuest: state.isGuest,
        player: state.player,
        buildings: state.buildings,
        activeMissionIds: state.activeMissionIds,
        claimedDailyReward: state.claimedDailyReward,
        dailyLoginStreak: state.dailyLoginStreak,
      }),
    }
  )
)
