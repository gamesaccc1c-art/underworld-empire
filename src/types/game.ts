export type ResourceType = 'cash' | 'influence' | 'loyalty' | 'weapon_power' | 'black_money' | 'intel'

export type BuildingType =
  | 'headquarters' | 'cash_vault' | 'black_market' | 'weapon_depot'
  | 'recruitment_center' | 'secret_office' | 'nightclub' | 'casino'
  | 'garage' | 'defense_wall' | 'prison_contacts' | 'leader_mansion'

export type EnforcerClass =
  | 'hitman' | 'strategist' | 'accountant' | 'smuggler' | 'hacker'
  | 'mediator' | 'bodyguard' | 'street_leader' | 'black_market_expert' | 'mole'

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'

export type MissionCategory = 'story' | 'daily' | 'weekly' | 'dark_job' | 'raid' | 'event'

export type TroopType = 'street_thugs' | 'hitmen' | 'bodyguards' | 'bikers' | 'vehicle_crew' | 'heavy_crew'

export type ResearchCategory = 'economy' | 'combat' | 'defense' | 'intelligence' | 'family'

// ─── Core Player ─────────────────────────────────────────────────────────────

export interface GamePlayer {
  id: string
  email: string
  username: string
  avatar_url: string | null
  level: number
  xp: number
  vip_level: number
  vip_points: number
  power: number
  family_id: string | null
  title: string
  reputation: number
  diamonds: number
  cash: number
  influence: number
  loyalty: number
  weapon_power: number
  black_money: number
  intel: number
  police_heat: number
  raid_energy: number
  dark_job_energy: number
  spy_energy: number
  max_raid_energy: number
  max_dark_job_energy: number
  max_spy_energy: number
  raid_energy_last_regen?: string
  dark_job_energy_last_regen?: string
  spy_energy_last_regen?: string
  shield_until: string | null
  last_daily_reward_at?: string | null
  daily_login_streak?: number
  created_at: string
  updated_at: string
}

// ─── Buildings ────────────────────────────────────────────────────────────────

export interface Building {
  id: string
  user_id: string
  building_type: BuildingType
  level: number
  upgrade_started_at: string | null
  upgrade_ends_at: string | null
  is_upgrading: boolean
  last_collected_at: string
}

export interface BuildingDefinitionDB {
  id: string
  type: BuildingType
  name: string
  icon: string
  description: string
  max_level: number
  base_cash: number
  base_influence: number
  base_loyalty: number
  base_weapon_power: number
  base_black_money: number
  base_intel: number
  base_duration: number
  production_type: ResourceType | null
  production_rate: number
  production_capacity_hours: number
  required_hq_level: number
}

export interface BuildingDefinition {
  type: BuildingType
  name: string
  description: string
  icon: string
  maxLevel: number
  baseCost: Record<ResourceType, number>
  baseDuration: number
  productionType: ResourceType | null
  productionRate: number
}

// ─── Enforcers ────────────────────────────────────────────────────────────────

export interface Enforcer {
  id: string
  key: string
  name: string
  class: EnforcerClass
  rarity: Rarity
  description: string
  active_skill: string
  passive_skill: string
  attack_bonus: number
  defense_bonus: number
  economy_bonus: number
  crime_success_bonus: number
}

export interface UserEnforcer {
  id: string
  user_id: string
  enforcer_id: string
  level: number
  stars: number
  shards: number
  assigned_role: string | null
  enforcer?: Enforcer
}

// ─── Missions ─────────────────────────────────────────────────────────────────

export interface Mission {
  id: string
  category: MissionCategory
  name: string
  description: string
  required_level: number
  duration: number
  rewards: Record<string, number>
  risk: number
  police_heat_gain: number
}

export interface UserMission {
  id: string
  user_id: string
  mission_id: string
  status: 'available' | 'in_progress' | 'completed' | 'failed' | 'claimed'
  assigned_enforcer_id: string | null
  started_at: string | null
  ends_at: string | null
  result: Record<string, unknown> | null
  mission?: Mission
}

// ─── Shop ─────────────────────────────────────────────────────────────────────

export interface ShopProduct {
  id: string
  sku: string
  name: string
  description: string
  price: number
  currency: string
  contents: Record<string, number>
  is_active: boolean
  is_limited: boolean
  starts_at: string | null
  ends_at: string | null
  badge?: string
  discount_label?: string
}

// ─── VIP ──────────────────────────────────────────────────────────────────────

export interface VipReward {
  vip_level: number
  bonus_type: string
  bonus_value: number
  description: string
}

export interface VipDefinition {
  id: string
  vip_level: number
  points_required: number
  daily_diamonds: number
  construction_speed: number
  training_speed: number
  research_speed: number
  resource_production: number
  attack_bonus: number
  defense_bonus: number
  extra_missions: number
  extra_raids: number
  energy_regen_bonus: number
  shop_discount: number
  daily_chest_tier: string
}

export interface VipInfo {
  ok: boolean
  vip_level: number
  vip_points: number
  current: VipDefinition | null
  next: VipDefinition | null
  all: VipDefinition[]
  can_claim_daily: boolean
  monthly_card_active: boolean
  season_pass_active: boolean
}

export interface ChestDefinition {
  id: string
  chest_type: string
  name: string
  description: string
  diamond_cost: number
  drop_rates: Record<string, number>
  possible_rewards: Record<string, [number, number]>
  min_level: number
}

export interface ChestResult {
  ok: boolean
  error?: string
  rarity?: string
  rewards?: Record<string, number>
  chest_type?: string
}

export interface PlayerItem {
  item_key: string
  amount: number
}

// ─── Family & Territory ───────────────────────────────────────────────────────

export interface Family {
  id: string
  name: string
  tag: string
  leader_id: string
  description: string
  level: number
  xp: number
  power: number
  territory_count: number
  member_count: number
  max_members: number
  join_type: 'open' | 'apply' | 'invite_only'
  min_power: number
  announcement: string
  created_at: string
}

export interface FamilyMember {
  user_id: string
  username: string
  level: number
  power: number
  rank: number
  contribution: number
  joined_at: string
  vip_level: number
}

export interface FamilyTech {
  tech_key: string
  level: number
  progress: number
  required_progress: number
}

export interface FamilyDetails {
  ok: boolean
  family: Family
  members: FamilyMember[]
  tech: FamilyTech[]
}

export interface FamilyHelpRequest {
  id: string
  family_id: string
  user_id: string
  help_type: 'building' | 'research' | 'training'
  target_id: string
  helps_received: number
  max_helps: number
  time_reduction_per_help: number
  created_at: string
  expires_at: string
}

export interface FamilyChatMessage {
  id: string
  family_id: string
  user_id: string
  username: string
  message: string
  message_type: 'text' | 'system' | 'donation' | 'war'
  created_at: string
}

export interface Territory {
  id: string
  name: string
  district_type: string
  level: number
  owner_family_id: string | null
  resource_bonus: string
  defense_bonus: number
  control_points: number
  shield_until: string | null
  daily_income: number
  owner_family?: Family
  created_at: string
}

export interface TerritoryWar {
  id: string
  territory_id: string
  territory_name: string
  attacker_family_id: string
  attacker_name: string
  attacker_tag: string
  defender_family_id: string | null
  defender_name: string | null
  defender_tag: string | null
  attacker_points: number
  defender_points: number
  status: 'active' | 'attacker_won' | 'defender_won' | 'draw'
  started_at: string
  ends_at: string
}

// ─── Battle ───────────────────────────────────────────────────────────────────

export interface BattleReport {
  id: string
  battle_id: string
  attacker_id: string
  defender_id: string
  attacker_power: number
  defender_power: number
  casualties: { attacker: Record<string, number>; defender: Record<string, number> }
  wounded: { attacker: Record<string, number>; defender: Record<string, number> }
  loot: Record<string, number>
  result: 'victory' | 'defeat' | 'draw'
  report_data: Record<string, unknown>
  created_at: string
}

export interface AttackTarget {
  id: string
  username: string
  level: number
  power: number
  title: string
  family_id: string | null
  family_name: string | null
  family_tag: string | null
  has_shield: boolean
  is_new_player: boolean
}

export interface ScoutResult {
  estimated_cash: number
  estimated_resources: Record<string, number>
  estimated_defense: number
  hq_level: number
  has_shield: boolean
  family_name: string | null
  risk_level: 'low' | 'medium' | 'high' | 'very_high'
}

export interface NpcTarget {
  id: string
  name: string
  description: string
  level: number
  power: number
  defense_power: number
  loot: Record<string, number>
  required_level: number
  battle_type: string
}

export interface AttackResult {
  ok: boolean
  error?: string
  result?: 'victory' | 'defeat' | 'draw'
  attacker_power?: number
  defender_power?: number
  casualties?: { attacker: Record<string, number>; defender: Record<string, number> }
  wounded?: { attacker: Record<string, number>; defender: Record<string, number> }
  loot?: Record<string, number>
  report_id?: string
  bonuses?: Record<string, number>
  npc_name?: string
}

// ─── Research ─────────────────────────────────────────────────────────────────

export interface ResearchDefinition {
  id: string
  category: ResearchCategory
  key: string
  name: string
  description: string
  max_level: number
  base_cost: Record<string, number>
  base_duration: number
  effect_type: 'percent' | 'flat'
  effect_value: number
}

export interface UserResearch {
  id: string
  user_id: string
  research_id: string
  level: number
  started_at: string | null
  ends_at: string | null
  is_researching: boolean
  research?: ResearchDefinition
}

// ─── Troops ───────────────────────────────────────────────────────────────────

export interface Troop {
  id: string
  user_id: string
  troop_type: TroopType
  tier: number
  amount: number
  wounded_amount: number
  created_at: string
  updated_at: string
}

export interface TroopTrainingQueue {
  id: string
  user_id: string
  troop_type: TroopType
  tier: number
  amount: number
  started_at: string
  ends_at: string
  status: 'training' | 'completed' | 'cancelled'
}

// ─── Transaction & Audit Logs ─────────────────────────────────────────────────

export interface ResourceTransaction {
  id: string
  user_id: string
  source_type: string
  source_id: string | null
  resource_type: string
  amount: number
  balance_after: number
  metadata: Record<string, unknown>
  created_at: string
}

export interface DailyRewardClaim {
  id: string
  user_id: string
  reward_day: number
  claimed_date: string
  reward: Record<string, number>
  created_at: string
}

export interface PlayerBoost {
  id: string
  user_id: string
  boost_type: string
  value: number
  starts_at: string
  ends_at: string
  source: string
}

export interface ChestOpening {
  id: string
  user_id: string
  chest_type: 'bronze' | 'silver' | 'gold'
  cost: number
  rewards: Record<string, unknown>
  created_at: string
}

// ─── Leaderboard views ────────────────────────────────────────────────────────

export interface LeaderboardPlayer {
  id: string
  username: string
  level: number
  power: number
  title: string
  vip_level: number
  reputation: number
  family_id: string | null
  family_name: string | null
  family_tag: string | null
  created_at: string
}

export interface LeaderboardFamily {
  id: string
  name: string
  tag: string
  level: number
  power: number
  territory_count: number
  member_count: number
  created_at: string
}
