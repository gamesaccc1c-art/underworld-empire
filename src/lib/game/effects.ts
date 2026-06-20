import type { UserResearch, ResearchDefinition } from '@/types/game'

export interface ResearchEffects {
  cashProductionBonus: number      // % multiplier on cash production
  blackMoneyProductionBonus: number
  intelProductionBonus: number
  loyaltyProductionBonus: number
  lootBonus: number
  attackBonus: number
  raidDamageBonus: number
  heavyAttackBonus: number
  defenseBonus: number
  spyResistBonus: number
  crimeSuccessBonus: number
  trainingSpeedBonus: number
}

const ZERO_EFFECTS: ResearchEffects = {
  cashProductionBonus: 0,
  blackMoneyProductionBonus: 0,
  intelProductionBonus: 0,
  loyaltyProductionBonus: 0,
  lootBonus: 0,
  attackBonus: 0,
  raidDamageBonus: 0,
  heavyAttackBonus: 0,
  defenseBonus: 0,
  spyResistBonus: 0,
  crimeSuccessBonus: 0,
  trainingSpeedBonus: 0,
}

const EFFECT_KEY_MAP: Record<string, keyof ResearchEffects> = {
  cash_production:        'cashProductionBonus',
  black_money_production: 'blackMoneyProductionBonus',
  intel_production:       'intelProductionBonus',
  loyalty_production:     'loyaltyProductionBonus',
  loot_bonus:             'lootBonus',
  attack:                 'attackBonus',
  raid_damage:            'raidDamageBonus',
  heavy_attack:           'heavyAttackBonus',
  defense:                'defenseBonus',
  spy_resist:             'spyResistBonus',
  crime_success:          'crimeSuccessBonus',
  training_speed:         'trainingSpeedBonus',
}

/** Compute cumulative research effects from player's completed research records. */
export function computeResearchEffects(
  userResearch: UserResearch[],
  definitions: ResearchDefinition[],
): ResearchEffects {
  const effects = { ...ZERO_EFFECTS }
  for (const ur of userResearch) {
    if (ur.level <= 0) continue
    const def = definitions.find(d => d.id === ur.research_id) ?? ur.research
    if (!def) continue
    const field = EFFECT_KEY_MAP[def.key]
    if (!field) continue
    const perLevel = Number(def.effect_value)
    effects[field] += perLevel * ur.level
  }
  return effects
}

/** Apply production bonus to a raw hourly rate. */
export function applyProductionBonus(baseRate: number, bonusPct: number): number {
  return Math.floor(baseRate * (1 + bonusPct / 100))
}

/** Apply training speed bonus to reduce duration. */
export function applyTrainingSpeed(baseDuration: number, speedBonusPct: number): number {
  const factor = Math.max(0.1, 1 - speedBonusPct / 100)
  return Math.max(10, Math.floor(baseDuration * factor))
}
