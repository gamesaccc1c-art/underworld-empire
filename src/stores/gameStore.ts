import { create } from 'zustand'
import { toast } from 'sonner'
import type { GamePlayer, Building, BuildingDefinitionDB, UserEnforcer, UserMission, Mission, Enforcer, Troop, TroopTrainingQueue, UserResearch, ResearchDefinition, BattleReport, AttackTarget, NpcTarget, AttackResult } from '@/types/game'
import * as db from '@/lib/supabase/database'
import type { Session } from '@supabase/supabase-js'

interface GameState {
  session: Session | null
  player: GamePlayer | null
  buildings: Building[]
  buildingDefinitions: BuildingDefinitionDB[]
  enforcers: UserEnforcer[]
  missions: UserMission[]
  availableMissions: Mission[]
  allEnforcers: Enforcer[]
  troops: Troop[]
  trainingQueue: TroopTrainingQueue[]
  userResearch: UserResearch[]
  researchDefinitions: ResearchDefinition[]
  battleReports: BattleReport[]
  attackTargets: AttackTarget[]
  npcTargets: NpcTarget[]
  loading: boolean
  error: string | null

  setSession: (session: Session | null) => void
  loadPlayer: () => Promise<void>
  loadBuildings: () => Promise<void>
  loadBuildingDefinitions: () => Promise<void>
  loadEnforcers: () => Promise<void>
  loadMissions: () => Promise<void>
  loadTroops: () => Promise<void>
  loadResearch: () => Promise<void>
  loadBattleData: () => Promise<void>
  loadAllData: () => Promise<void>

  upgradeBuilding: (buildingId: string, buildingType: string, currentLevel: number) => Promise<void>
  finishUpgrade: (buildingId: string) => Promise<void>
  speedupUpgrade: (buildingId: string, diamondCost: number) => Promise<void>
  collectProduction: (buildingId: string) => Promise<void>
  collectAllProduction: () => Promise<void>
  buildNew: (buildingType: string) => Promise<void>
  startMission: (missionId: string, enforcerId?: string) => Promise<void>
  claimMissionReward: (userMissionId: string) => Promise<false | { ok: boolean; rewards?: Record<string, number>; police_raid?: boolean; raid_penalty?: number; enforcer_bonus?: number }>
  trainTroops: (troopType: string, amount: number) => Promise<void>
  claimTroopTraining: (queueId: string) => Promise<void>
  startResearchAction: (researchId: string) => Promise<void>
  completeResearchAction: (researchId: string) => Promise<void>
  upgradeEnforcerAction: (userEnforcerId: string) => Promise<void>
  attackPlayerAction: (targetId: string, battleType?: string) => Promise<AttackResult | null>
  attackNpcAction: (npcId: string) => Promise<AttackResult | null>
  healWounded: (troopType: string, amount: number) => Promise<void>
}

export const useGameStore = create<GameState>((set, get) => ({
  session: null,
  player: null,
  buildings: [],
  buildingDefinitions: [],
  enforcers: [],
  missions: [],
  availableMissions: [],
  allEnforcers: [],
  troops: [],
  trainingQueue: [],
  userResearch: [],
  researchDefinitions: [],
  battleReports: [],
  attackTargets: [],
  npcTargets: [],
  loading: false,
  error: null,

  setSession: (session) => set({ session }),

  loadPlayer: async () => {
    const { session } = get()
    if (!session?.user) return
    try {
      const player = await db.getOrCreatePlayer(
        session.user.email ?? '',
        session.user.user_metadata?.username,
      )
      set({ player })
    } catch (e: unknown) {
      set({ error: (e as Error).message })
    }
  },

  loadBuildings: async () => {
    const { session } = get()
    if (!session?.user) return
    try {
      const buildings = await db.getBuildings(session.user.id)
      set({ buildings })
    } catch (e: unknown) {
      set({ error: (e as Error).message })
    }
  },

  loadBuildingDefinitions: async () => {
    try {
      const defs = await db.getBuildingDefinitions()
      set({ buildingDefinitions: defs })
    } catch (e: unknown) {
      set({ error: (e as Error).message })
    }
  },

  loadEnforcers: async () => {
    const { session } = get()
    if (!session?.user) return
    try {
      const [enforcers, allEnforcers] = await Promise.all([
        db.getUserEnforcers(session.user.id),
        db.getEnforcers(),
      ])
      set({ enforcers, allEnforcers })
    } catch (e: unknown) {
      set({ error: (e as Error).message })
    }
  },

  loadMissions: async () => {
    const { session } = get()
    if (!session?.user) return
    try {
      const [missions, availableMissions] = await Promise.all([
        db.getUserMissions(session.user.id),
        db.getMissions(),
      ])
      set({ missions, availableMissions })
    } catch (e: unknown) {
      set({ error: (e as Error).message })
    }
  },

  loadTroops: async () => {
    const { session } = get()
    if (!session?.user) return
    try {
      const [troops, trainingQueue] = await Promise.all([
        db.getTroops(session.user.id),
        db.getTroopTrainingQueue(session.user.id),
      ])
      set({ troops, trainingQueue })
    } catch (e: unknown) {
      set({ error: (e as Error).message })
    }
  },

  loadResearch: async () => {
    const { session } = get()
    if (!session?.user) return
    try {
      const [userResearch, researchDefinitions] = await Promise.all([
        db.getUserResearch(session.user.id),
        db.getResearchDefinitions(),
      ])
      set({ userResearch, researchDefinitions })
    } catch (e: unknown) {
      set({ error: (e as Error).message })
    }
  },

  loadBattleData: async () => {
    const { session } = get()
    if (!session?.user) return
    try {
      const [targetsResult, npcTargets, battleReports] = await Promise.all([
        db.getAttackTargets(),
        db.getNpcTargets(),
        db.getBattleReports(session.user.id),
      ])
      set({
        attackTargets: targetsResult.targets,
        npcTargets,
        battleReports,
      })
    } catch (e: unknown) {
      set({ error: (e as Error).message })
    }
  },

  loadAllData: async () => {
    set({ loading: true, error: null })
    const store = get()
    try {
      await Promise.all([
        store.loadPlayer(),
        store.loadBuildings(),
        store.loadBuildingDefinitions(),
        store.loadEnforcers(),
        store.loadMissions(),
        store.loadTroops(),
        store.loadResearch(),
      ])
    } catch (e: unknown) {
      set({ error: (e as Error).message })
    } finally {
      set({ loading: false })
    }
  },

  upgradeBuilding: async (buildingId, buildingType, currentLevel) => {
    const result = await db.startBuildingUpgrade(buildingId, buildingType, currentLevel)
    if (!result.ok) {
      toast.error(result.error || 'Yukseltme baslatılamadi')
      return
    }
    await Promise.all([get().loadBuildings(), get().loadPlayer()])
  },

  finishUpgrade: async (buildingId) => {
    const result = await db.finishBuildingUpgrade(buildingId)
    if (!result.ok) {
      toast.error(result.error || 'Yukseltme tamamlanamadi')
      return
    }
    await Promise.all([get().loadBuildings(), get().loadPlayer()])
    toast.success(`Bina Lv.${result.new_level ?? ''} oldu! +${result.xp_gain ?? 0} XP, +${result.power_gain ?? 0} Güç`)
  },

  speedupUpgrade: async (buildingId, diamondCost) => {
    const result = await db.speedupBuildingUpgrade(buildingId, diamondCost)
    if (!result.ok) {
      toast.error(result.error || 'Hızlandırma başarısız')
      return
    }
    await Promise.all([get().loadBuildings(), get().loadPlayer()])
    toast.success(`Hızlandırıldı! Bina Lv.${result.new_level ?? ''} oldu!`)
  },

  collectProduction: async (buildingId) => {
    const result = await db.collectBuildingProduction(buildingId)
    if (!result.ok) {
      toast.error(result.error || 'Toplama başarısız')
      return
    }
    await Promise.all([get().loadBuildings(), get().loadPlayer()])
    toast.success(`+${result.amount?.toLocaleString()} ${result.resource} toplandı!`)
  },

  collectAllProduction: async () => {
    const result = await db.collectAllProduction()
    if (!result.ok) {
      toast.error(result.error || 'Toplama başarısız')
      return
    }
    await Promise.all([get().loadBuildings(), get().loadPlayer()])
    if (result.collected === 0) {
      toast.info('Toplanacak üretim yok')
      return
    }
    const summary = Object.entries(result.totals)
      .map(([k, v]) => `+${v.toLocaleString()} ${k}`)
      .join(', ')
    toast.success(`${result.collected} binadan toplandı: ${summary}`)
  },

  buildNew: async (buildingType) => {
    const result = await db.buildNewBuilding(buildingType)
    if (!result.ok) {
      toast.error(result.error || 'Bina kurulamadı')
      return
    }
    await Promise.all([get().loadBuildings(), get().loadPlayer()])
    toast.success('Bina kuruldu!')
  },

  startMission: async (missionId, enforcerId) => {
    const result = await db.startMission(missionId, enforcerId)
    if (!result.ok) {
      toast.error(result.error || 'Görev başlatılamadı')
      return
    }
    await Promise.all([get().loadMissions(), get().loadPlayer()])
    toast.success('Görev başlatıldı!')
  },

  claimMissionReward: async (userMissionId) => {
    const result = await db.claimMissionReward(userMissionId)
    if (!result.ok) {
      toast.error(result.error || 'Ödül alınamadı')
      return false
    }
    await Promise.all([get().loadMissions(), get().loadPlayer()])
    return result
  },

  trainTroops: async (troopType, amount) => {
    const result = await db.startTroopTraining(troopType, amount)
    if (!result.ok) {
      toast.error(result.error || 'Eğitim başlatılamadı')
      return
    }
    await Promise.all([get().loadTroops(), get().loadPlayer()])
    toast.success(`${amount} birlik eğitimi başladı!`)
  },

  claimTroopTraining: async (queueId) => {
    const result = await db.completeTroopTraining(queueId)
    if (!result.ok) {
      toast.error(result.error || 'Eğitim tamamlanamadı')
      return
    }
    await Promise.all([get().loadTroops(), get().loadPlayer()])
    toast.success(`+${result.amount} ${result.troop_type} ordunuza katıldı!`)
  },

  startResearchAction: async (researchId) => {
    const result = await db.startResearch(researchId)
    if (!result.ok) {
      toast.error(result.error || 'Araştırma başlatılamadı')
      return
    }
    await Promise.all([get().loadResearch(), get().loadPlayer()])
    toast.success('Araştırma başladı!')
  },

  completeResearchAction: async (researchId) => {
    const result = await db.completeResearch(researchId)
    if (!result.ok) {
      toast.error(result.error || 'Araştırma tamamlanamadı')
      return
    }
    await Promise.all([get().loadResearch(), get().loadPlayer()])
    toast.success(`Araştırma tamamlandı! Lv.${result.new_level}`)
  },

  upgradeEnforcerAction: async (userEnforcerId) => {
    const result = await db.upgradeEnforcer(userEnforcerId)
    if (!result.ok) {
      toast.error(result.error || 'Yükseltme başarısız')
      return
    }
    await get().loadEnforcers()
    toast.success(`Enforcer yükseltildi! ${result.new_stars} yıldız!`)
  },

  attackPlayerAction: async (targetId, battleType) => {
    const result = await db.attackPlayer(targetId, battleType)
    if (!result.ok) {
      toast.error(result.error || 'Saldırı başarısız')
      return null
    }
    await Promise.all([get().loadPlayer(), get().loadTroops()])
    return result
  },

  attackNpcAction: async (npcId) => {
    const result = await db.attackNpc(npcId)
    if (!result.ok) {
      toast.error(result.error || 'Saldırı başarısız')
      return null
    }
    await Promise.all([get().loadPlayer(), get().loadTroops()])
    return result
  },

  healWounded: async (troopType, amount) => {
    const result = await db.healWoundedTroops(troopType, amount)
    if (!result.ok) {
      toast.error(result.error || 'İyileştirme başarısız')
      return
    }
    await Promise.all([get().loadTroops(), get().loadPlayer()])
    toast.success(`${result.healed} birlik iyileştirildi!`)
  },
}))
