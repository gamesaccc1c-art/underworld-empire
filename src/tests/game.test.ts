import { describe, it, expect } from 'vitest'
import {
  getBuildingUpgradeCost,
  getBuildingUpgradeDuration,
  getProductionPerHour,
  getXpForLevel,
  VIP_REWARDS,
  BUILDING_DEFINITIONS,
} from '@/lib/game/constants'
import {
  computeResearchEffects,
  applyProductionBonus,
  applyTrainingSpeed,
} from '@/lib/game/effects'
import type { ResearchDefinition, UserResearch } from '@/types/game'

// ─── Building upgrade cost ────────────────────────────────────────────────────

describe('getBuildingUpgradeCost', () => {
  const hq = BUILDING_DEFINITIONS.find(d => d.type === 'headquarters')!

  it('level 0→1: returns base cost', () => {
    const cost = getBuildingUpgradeCost(hq, 0)
    expect(cost.cash).toBe(hq.baseCost.cash)
  })

  it('scales by 1.5x per level', () => {
    const cost0 = getBuildingUpgradeCost(hq, 0)
    const cost1 = getBuildingUpgradeCost(hq, 1)
    expect(cost1.cash).toBe(Math.floor(hq.baseCost.cash * 1.5))
    expect(cost0.cash).toBeGreaterThan(0)
  })

  it('level 5 is more expensive than level 1', () => {
    const cost1 = getBuildingUpgradeCost(hq, 1)
    const cost5 = getBuildingUpgradeCost(hq, 5)
    expect(cost5.cash).toBeGreaterThan(cost1.cash)
  })

  it('omits resources with zero base cost', () => {
    const cost = getBuildingUpgradeCost(hq, 0)
    // HQ only costs cash
    expect(Object.keys(cost)).toEqual(['cash'])
  })

  it('black market costs both cash and influence', () => {
    const bm = BUILDING_DEFINITIONS.find(d => d.type === 'black_market')!
    const cost = getBuildingUpgradeCost(bm, 0)
    expect(cost.cash).toBeGreaterThan(0)
    expect(cost.influence).toBeGreaterThan(0)
  })
})

// ─── Building upgrade duration ────────────────────────────────────────────────

describe('getBuildingUpgradeDuration', () => {
  const hq = BUILDING_DEFINITIONS.find(d => d.type === 'headquarters')!

  it('level 0 returns base duration', () => {
    expect(getBuildingUpgradeDuration(hq, 0)).toBe(hq.baseDuration)
  })

  it('increases each level', () => {
    const d0 = getBuildingUpgradeDuration(hq, 0)
    const d5 = getBuildingUpgradeDuration(hq, 5)
    expect(d5).toBeGreaterThan(d0)
  })

  it('scales by 1.4^level', () => {
    const d1 = getBuildingUpgradeDuration(hq, 1)
    expect(d1).toBe(Math.floor(hq.baseDuration * 1.4))
  })
})

// ─── Production per hour ──────────────────────────────────────────────────────

describe('getProductionPerHour', () => {
  const vault = BUILDING_DEFINITIONS.find(d => d.type === 'cash_vault')!

  it('level 0 returns 0', () => {
    expect(getProductionPerHour(vault, 0)).toBe(0)
  })

  it('level 1 returns base rate', () => {
    expect(getProductionPerHour(vault, 1)).toBe(vault.productionRate)
  })

  it('level 2 is 30% more than level 1', () => {
    const l1 = getProductionPerHour(vault, 1)
    const l2 = getProductionPerHour(vault, 2)
    expect(l2).toBe(Math.floor(vault.productionRate * 1.3))
    expect(l2).toBeGreaterThan(l1)
  })

  it('non-producing building returns 0 at any level', () => {
    const hq = BUILDING_DEFINITIONS.find(d => d.type === 'headquarters')!
    expect(getProductionPerHour(hq, 5)).toBe(0)
  })

  it('casino produces more per hour than cash_vault at same level', () => {
    const casino = BUILDING_DEFINITIONS.find(d => d.type === 'casino')!
    expect(getProductionPerHour(casino, 1)).toBeGreaterThan(getProductionPerHour(vault, 1))
  })
})

// ─── XP for level ─────────────────────────────────────────────────────────────

describe('getXpForLevel', () => {
  it('level 1 requires 100 XP', () => {
    expect(getXpForLevel(1)).toBe(100)
  })

  it('each level requires more XP than previous', () => {
    for (let i = 1; i < 20; i++) {
      expect(getXpForLevel(i + 1)).toBeGreaterThan(getXpForLevel(i))
    }
  })

  it('level 10 XP is substantially more than level 1', () => {
    expect(getXpForLevel(10)).toBeGreaterThan(getXpForLevel(1) * 5)
  })
})

// ─── Production bonus ─────────────────────────────────────────────────────────

describe('applyProductionBonus', () => {
  it('0% bonus returns base rate', () => {
    expect(applyProductionBonus(100, 0)).toBe(100)
  })

  it('50% bonus returns 1.5x base', () => {
    expect(applyProductionBonus(100, 50)).toBe(150)
  })

  it('100% bonus doubles the rate', () => {
    expect(applyProductionBonus(200, 100)).toBe(400)
  })

  it('floors the result', () => {
    expect(applyProductionBonus(100, 33)).toBe(133)
  })
})

// ─── Research effects ─────────────────────────────────────────────────────────

describe('computeResearchEffects', () => {
  const mockDefs: ResearchDefinition[] = [
    { id: 'r1', key: 'cash_production', name: 'Nakit Uretim', description: '', effect_type: 'percent', effect_value: 5, max_level: 5, base_cost: { cash: 1000 }, base_duration: 3600, category: 'economy' },
    { id: 'r2', key: 'attack', name: 'Saldiri', description: '', effect_type: 'percent', effect_value: 3, max_level: 10, base_cost: { cash: 800 }, base_duration: 3600, category: 'combat' },
  ]

  it('returns zero effects for empty research', () => {
    const effects = computeResearchEffects([], mockDefs)
    expect(effects.cashProductionBonus).toBe(0)
    expect(effects.attackBonus).toBe(0)
  })

  it('accumulates bonus per level', () => {
    const research: UserResearch[] = [
      { id: 'ur1', user_id: 'u1', research_id: 'r1', level: 3, started_at: null, ends_at: null, is_researching: false, research: mockDefs[0] },
    ]
    const effects = computeResearchEffects(research, mockDefs)
    expect(effects.cashProductionBonus).toBe(15) // 5 * 3
  })

  it('stacks multiple research types', () => {
    const research: UserResearch[] = [
      { id: 'ur1', user_id: 'u1', research_id: 'r1', level: 2, started_at: null, ends_at: null, is_researching: false, research: mockDefs[0] },
      { id: 'ur2', user_id: 'u1', research_id: 'r2', level: 4, started_at: null, ends_at: null, is_researching: false, research: mockDefs[1] },
    ]
    const effects = computeResearchEffects(research, mockDefs)
    expect(effects.cashProductionBonus).toBe(10)
    expect(effects.attackBonus).toBe(12)
  })

  it('skips level 0 research', () => {
    const research: UserResearch[] = [
      { id: 'ur1', user_id: 'u1', research_id: 'r1', level: 0, started_at: null, ends_at: null, is_researching: false, research: mockDefs[0] },
    ]
    const effects = computeResearchEffects(research, mockDefs)
    expect(effects.cashProductionBonus).toBe(0)
  })
})

// ─── Training speed ───────────────────────────────────────────────────────────

describe('applyTrainingSpeed', () => {
  it('0% bonus returns base duration', () => {
    expect(applyTrainingSpeed(3600, 0)).toBe(3600)
  })

  it('50% bonus halves the duration', () => {
    expect(applyTrainingSpeed(3600, 50)).toBe(1800)
  })

  it('never goes below 10 seconds minimum', () => {
    expect(applyTrainingSpeed(10, 99)).toBe(10)
  })

  it('100% bonus hits the 10% floor (0.1 factor minimum)', () => {
    expect(applyTrainingSpeed(3600, 100)).toBe(360) // max(0.1, 1-1.0) = 0.1
  })
})

// ─── VIP bonus calculation ────────────────────────────────────────────────────

describe('VIP bonus calculation', () => {
  function computeVipProductionBonus(vipLevel: number): number {
    return VIP_REWARDS
      .filter(r => r.vip_level <= vipLevel && r.bonus_type === 'resource_production')
      .reduce((acc, r) => acc + r.bonus_value, 0)
  }

  function computeVipDailyDiamonds(vipLevel: number): number {
    return VIP_REWARDS
      .filter(r => r.vip_level <= vipLevel && r.bonus_type === 'daily_diamonds')
      .reduce((acc, r) => acc + r.bonus_value, 0)
  }

  it('VIP 0 earns no production bonus', () => {
    expect(computeVipProductionBonus(0)).toBe(0)
  })

  it('VIP 2 gets +5% production bonus', () => {
    expect(computeVipProductionBonus(2)).toBe(5)
  })

  it('higher VIP level gives more bonus', () => {
    expect(computeVipProductionBonus(5)).toBeGreaterThan(computeVipProductionBonus(2))
  })

  it('VIP 1 earns daily diamonds', () => {
    expect(computeVipDailyDiamonds(1)).toBeGreaterThan(0)
  })

  it('VIP 5 earns more daily diamonds than VIP 1', () => {
    expect(computeVipDailyDiamonds(5)).toBeGreaterThan(computeVipDailyDiamonds(1))
  })
})

// ─── Battle power comparison ──────────────────────────────────────────────────

describe('Battle power comparison', () => {
  function battleOutcome(attackerPower: number, defenderPower: number): 'victory' | 'defeat' | 'draw' {
    if (attackerPower > defenderPower * 1.1) return 'victory'
    if (defenderPower > attackerPower * 1.1) return 'defeat'
    return 'draw'
  }

  it('much stronger attacker wins', () => {
    expect(battleOutcome(10000, 5000)).toBe('victory')
  })

  it('much weaker attacker loses', () => {
    expect(battleOutcome(3000, 9000)).toBe('defeat')
  })

  it('equal power results in draw', () => {
    expect(battleOutcome(5000, 5000)).toBe('draw')
  })

  it('slightly stronger still draws within 10%', () => {
    expect(battleOutcome(5000, 4700)).toBe('draw')
  })
})

// ─── Chest rarity helpers ─────────────────────────────────────────────────────

describe('Chest rarity helpers', () => {
  type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'

  const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']

  function rarityIndex(r: Rarity): number {
    return RARITY_ORDER.indexOf(r)
  }

  function isHigherRarity(a: Rarity, b: Rarity): boolean {
    return rarityIndex(a) > rarityIndex(b)
  }

  it('legendary is higher rarity than rare', () => {
    expect(isHigherRarity('legendary', 'rare')).toBe(true)
  })

  it('common is not higher than epic', () => {
    expect(isHigherRarity('common', 'epic')).toBe(false)
  })

  it('mythic is the highest rarity', () => {
    for (const r of RARITY_ORDER.slice(0, -1)) {
      expect(isHigherRarity('mythic', r)).toBe(true)
    }
  })

  it('same rarity is not higher', () => {
    expect(isHigherRarity('rare', 'rare')).toBe(false)
  })

  it('all rarities have a defined order', () => {
    for (const r of RARITY_ORDER) {
      expect(rarityIndex(r)).toBeGreaterThanOrEqual(0)
    }
  })
})

// ─── Mission claim validation ─────────────────────────────────────────────────

describe('Mission claim validation', () => {
  function canClaim(endsAt: string): boolean {
    return new Date(endsAt) <= new Date()
  }

  function isExpired(endsAt: string, gracePeriodMs = 0): boolean {
    return new Date().getTime() - new Date(endsAt).getTime() > gracePeriodMs
  }

  it('past end time is claimable', () => {
    const past = new Date(Date.now() - 5000).toISOString()
    expect(canClaim(past)).toBe(true)
  })

  it('future end time is not claimable', () => {
    const future = new Date(Date.now() + 60000).toISOString()
    expect(canClaim(future)).toBe(false)
  })

  it('expired beyond grace period', () => {
    const longAgo = new Date(Date.now() - 3600000).toISOString()
    expect(isExpired(longAgo, 300000)).toBe(true)
  })

  it('just-completed within grace period not expired', () => {
    const recent = new Date(Date.now() - 1000).toISOString()
    expect(isExpired(recent, 300000)).toBe(false)
  })
})
