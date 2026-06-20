import { supabase } from './client'
import type { GamePlayer, Building, BuildingDefinitionDB, UserEnforcer, UserMission, Family, FamilyDetails, FamilyHelpRequest, FamilyChatMessage, Territory, TerritoryWar, Mission, Enforcer, Troop, TroopTrainingQueue, UserResearch, ResearchDefinition, BattleReport, AttackTarget, ScoutResult, NpcTarget, AttackResult, VipInfo, ChestDefinition, ChestResult, PlayerItem, ShopProduct } from '@/types/game'

// ─── Player ─────────────────────────────────────────────────────────────────

export async function getOrCreatePlayer(email: string, username?: string): Promise<GamePlayer> {
  const { data, error } = await supabase.rpc('get_or_create_player', {
    p_email: email,
    p_username: username ?? null,
  })
  if (error) throw error
  return data as GamePlayer
}

export async function getPlayer(userId: string): Promise<GamePlayer | null> {
  const { data } = await supabase.from('players').select('*').eq('id', userId).maybeSingle()
  return data as GamePlayer | null
}

/** Safe profile-only update via RPC */
export async function updatePlayerProfile(username?: string, avatarUrl?: string) {
  const { error } = await supabase.rpc('update_player_profile', {
    p_username: username ?? null,
    p_avatar_url: avatarUrl ?? null,
  })
  if (error) throw error
}

// ─── Buildings ───────────────────────────────────────────────────────────────

export async function getBuildingDefinitions(): Promise<BuildingDefinitionDB[]> {
  const { data, error } = await supabase.from('building_definitions').select('*').order('required_hq_level')
  if (error) throw error
  return (data || []) as BuildingDefinitionDB[]
}

export async function getBuildings(userId: string): Promise<Building[]> {
  const { data, error } = await supabase.from('buildings').select('*').eq('user_id', userId)
  if (error) throw error
  return (data || []) as Building[]
}

/** Server-validated new building construction: validates HQ level, deducts costs */
export async function buildNewBuilding(
  buildingType: string,
): Promise<{ ok: boolean; error?: string; building_id?: string }> {
  const { data, error } = await supabase.rpc('build_new_building', { p_building_type: buildingType })
  if (error) return { ok: false, error: error.message }
  return data as { ok: boolean; error?: string; building_id?: string }
}

/** Server-validated upgrade start: deducts resources + starts timer atomically */
export async function startBuildingUpgrade(
  buildingId: string,
  buildingType: string,
  currentLevel: number,
): Promise<{ ok: boolean; error?: string; ends_at?: string }> {
  const { data, error } = await supabase.rpc('start_building_upgrade', {
    p_building_id: buildingId,
    p_building_type: buildingType,
    p_current_level: currentLevel,
  })
  if (error) return { ok: false, error: error.message }
  return data as { ok: boolean; error?: string; ends_at?: string }
}

/** Server-validated upgrade finish: checks timer elapsed, grants XP/power */
export async function finishBuildingUpgrade(
  buildingId: string,
): Promise<{ ok: boolean; error?: string; new_level?: number; xp_gain?: number; power_gain?: number }> {
  const { data, error } = await supabase.rpc('finish_building_upgrade', {
    p_building_id: buildingId,
  })
  if (error) return { ok: false, error: error.message }
  return data as { ok: boolean; error?: string; new_level?: number; xp_gain?: number; power_gain?: number }
}

/** Speed-up with diamonds: server calculates cost, deducts diamonds, finishes upgrade */
export async function speedupBuildingUpgrade(
  buildingId: string,
  diamondCost: number,
): Promise<{ ok: boolean; error?: string; new_level?: number; xp_gain?: number; required?: number }> {
  const { data, error } = await supabase.rpc('speedup_building_upgrade', {
    p_building_id: buildingId,
    p_diamond_cost: diamondCost,
  })
  if (error) return { ok: false, error: error.message }
  return data as { ok: boolean; error?: string; new_level?: number; xp_gain?: number; required?: number }
}

/** Collect accumulated production: server validates, credits resource, resets timer */
export async function collectBuildingProduction(
  buildingId: string,
): Promise<{ ok: boolean; error?: string; resource?: string; amount?: number; hours?: number }> {
  const { data, error } = await supabase.rpc('collect_building_production', {
    p_building_id: buildingId,
  })
  if (error) return { ok: false, error: error.message }
  return data as { ok: boolean; error?: string; resource?: string; amount?: number; hours?: number }
}

/** Collect all buildings production at once */
export async function collectAllProduction(): Promise<{ ok: boolean; collected: number; totals: Record<string, number>; error?: string }> {
  const { data, error } = await supabase.rpc('collect_all_production')
  if (error) return { ok: false, collected: 0, totals: {}, error: error.message }
  return data as { ok: boolean; collected: number; totals: Record<string, number>; error?: string }
}

// ─── Enforcers ───────────────────────────────────────────────────────────────

export async function getUserEnforcers(userId: string): Promise<UserEnforcer[]> {
  const { data, error } = await supabase
    .from('user_enforcers')
    .select('*, enforcer:enforcers(*)')
    .eq('user_id', userId)
  if (error) throw error
  return (data || []) as UserEnforcer[]
}

export async function getEnforcers(): Promise<Enforcer[]> {
  const { data, error } = await supabase.from('enforcers').select('*')
  if (error) throw error
  return (data || []) as Enforcer[]
}

/** Server-side chest open: spends diamonds, rolls rarity, grants shards/unlock */
export async function openChest(
  chestType: 'bronze' | 'silver' | 'gold',
): Promise<{ ok: boolean; error?: string; enforcer_key?: string; rarity?: string; unlocked?: boolean; shards?: number }> {
  const { data, error } = await supabase.rpc('open_chest', { p_chest_type: chestType })
  if (error) return { ok: false, error: error.message }
  return data as { ok: boolean; error?: string; enforcer_key?: string; rarity?: string; unlocked?: boolean; shards?: number }
}

// ─── Missions ────────────────────────────────────────────────────────────────

export async function getMissions(category?: string): Promise<Mission[]> {
  let query = supabase.from('missions').select('*').order('required_level')
  if (category) query = query.eq('category', category)
  const { data, error } = await query
  if (error) throw error
  return (data || []) as Mission[]
}

export async function getUserMissions(userId: string): Promise<UserMission[]> {
  const { data, error } = await supabase
    .from('user_missions')
    .select('*, mission:missions(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as UserMission[]
}

/** Server-validated mission start — energy check, daily dedup, enforcer ownership */
export async function startMission(
  missionId: string,
  enforcerId?: string,
): Promise<{ ok: boolean; error?: string; ends_at?: string; duration?: number }> {
  const { data, error } = await supabase.rpc('start_mission', {
    p_mission_id: missionId,
    p_enforcer_id: enforcerId ?? null,
  })
  if (error) return { ok: false, error: error.message }
  return data as { ok: boolean; error?: string; ends_at?: string; duration?: number }
}

/** Server-validated mission reward claim: checks timer, police raid, enforcer bonus */
export async function claimMissionReward(
  userMissionId: string,
): Promise<{
  ok: boolean
  error?: string
  rewards?: Record<string, number>
  police_raid?: boolean
  raid_penalty?: number
  police_heat?: number
  enforcer_bonus?: number
}> {
  const { data, error } = await supabase.rpc('claim_mission_reward', {
    p_user_mission_id: userMissionId,
  })
  if (error) return { ok: false, error: error.message }
  return data as {
    ok: boolean; error?: string; rewards?: Record<string, number>
    police_raid?: boolean; raid_penalty?: number; police_heat?: number; enforcer_bonus?: number
  }
}

/** Spend intel to reduce police heat */
export async function reducePoliceHeatWithIntel(
  intelAmount: number,
): Promise<{ ok: boolean; error?: string; heat_reduction?: number; intel_spent?: number }> {
  const { data, error } = await supabase.rpc('reduce_police_heat_with_intel', {
    p_intel_amount: intelAmount,
  })
  if (error) return { ok: false, error: error.message }
  return data as { ok: boolean; error?: string; heat_reduction?: number; intel_spent?: number }
}

// ─── Daily Reward ─────────────────────────────────────────────────────────────

/** Server-enforced daily reward: one per calendar day */
export async function claimDailyReward(): Promise<{
  ok: boolean
  error?: string
  cash?: number
  diamonds?: number
  streak?: number
  day?: number
}> {
  const { data, error } = await supabase.rpc('claim_daily_reward')
  if (error) return { ok: false, error: error.message }
  return data as { ok: boolean; error?: string; cash?: number; diamonds?: number; streak?: number; day?: number }
}

// ─── Shop ─────────────────────────────────────────────────────────────────────

/** Server-validated demo purchase: checks product active + time window, grants contents */
export async function buyDemoProduct(
  productId: string,
): Promise<{ ok: boolean; error?: string; contents?: Record<string, number> }> {
  const { data, error } = await supabase.rpc('buy_demo_product', { p_product_id: productId })
  if (error) return { ok: false, error: error.message }
  return data as { ok: boolean; error?: string; contents?: Record<string, number> }
}

// ─── Troops ──────────────────────────────────────────────────────────────────

export async function getTroops(userId: string): Promise<Troop[]> {
  const { data, error } = await supabase.from('troops').select('*').eq('user_id', userId)
  if (error) throw error
  return (data || []) as Troop[]
}

export async function getTroopTrainingQueue(userId: string): Promise<TroopTrainingQueue[]> {
  const { data, error } = await supabase
    .from('troop_training_queue')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'training')
    .order('ends_at')
  if (error) throw error
  return (data || []) as TroopTrainingQueue[]
}

export async function startTroopTraining(
  troopType: string,
  amount: number,
): Promise<{ ok: boolean; error?: string; ends_at?: string; duration?: number; costs?: Record<string, number> }> {
  const { data, error } = await supabase.rpc('start_troop_training', {
    p_troop_type: troopType,
    p_tier: 1,
    p_amount: amount,
  })
  if (error) return { ok: false, error: error.message }
  return data as { ok: boolean; error?: string; ends_at?: string; duration?: number; costs?: Record<string, number> }
}

export async function completeTroopTraining(
  queueId: string,
): Promise<{ ok: boolean; error?: string; troop_type?: string; amount?: number }> {
  const { data, error } = await supabase.rpc('complete_troop_training', { p_queue_id: queueId })
  if (error) return { ok: false, error: error.message }
  return data as { ok: boolean; error?: string; troop_type?: string; amount?: number }
}

// ─── Research ─────────────────────────────────────────────────────────────────

export async function getResearchDefinitions(): Promise<ResearchDefinition[]> {
  const { data, error } = await supabase.from('research_definitions').select('*').order('category')
  if (error) throw error
  return (data || []) as ResearchDefinition[]
}

export async function getUserResearch(userId: string): Promise<UserResearch[]> {
  const { data, error } = await supabase
    .from('user_research')
    .select('*, research:research_definitions(*)')
    .eq('user_id', userId)
  if (error) throw error
  return (data || []) as UserResearch[]
}

export async function startResearch(
  researchId: string,
): Promise<{ ok: boolean; error?: string; ends_at?: string; duration?: number }> {
  const { data, error } = await supabase.rpc('start_research', { p_research_id: researchId })
  if (error) return { ok: false, error: error.message }
  return data as { ok: boolean; error?: string; ends_at?: string; duration?: number }
}

export async function completeResearch(
  researchId: string,
): Promise<{ ok: boolean; error?: string; new_level?: number; research_key?: string }> {
  const { data, error } = await supabase.rpc('complete_research', { p_research_id: researchId })
  if (error) return { ok: false, error: error.message }
  return data as { ok: boolean; error?: string; new_level?: number; research_key?: string }
}

// ─── Battle & PvP ─────────────────────────────────────────────────────────────

export async function getAttackTargets(): Promise<{ ok: boolean; targets: AttackTarget[]; error?: string }> {
  const { data, error } = await supabase.rpc('get_attack_targets')
  if (error) return { ok: false, targets: [], error: error.message }
  const result = data as { ok: boolean; targets?: AttackTarget[]; error?: string }
  return { ok: result.ok, targets: result.targets ?? [], error: result.error }
}

export async function getNpcTargets(): Promise<NpcTarget[]> {
  const { data, error } = await supabase.from('npc_targets').select('*').order('required_level')
  if (error) throw error
  return (data || []) as NpcTarget[]
}

export async function scoutPlayer(targetId: string): Promise<{ ok: boolean; error?: string } & Partial<ScoutResult>> {
  const { data, error } = await supabase.rpc('scout_player', { p_target_id: targetId })
  if (error) return { ok: false, error: error.message }
  return data as { ok: boolean; error?: string } & Partial<ScoutResult>
}

export async function attackPlayer(targetId: string, battleType?: string): Promise<AttackResult> {
  const { data, error } = await supabase.rpc('attack_player', { p_target_id: targetId, p_battle_type: battleType ?? 'raid' })
  if (error) return { ok: false, error: error.message }
  return data as AttackResult
}

export async function attackNpc(npcId: string): Promise<AttackResult> {
  const { data, error } = await supabase.rpc('attack_npc', { p_npc_id: npcId })
  if (error) return { ok: false, error: error.message }
  return data as AttackResult
}

export async function healWoundedTroops(troopType: string, amount: number): Promise<{ ok: boolean; error?: string; healed?: number; cost?: number }> {
  const { data, error } = await supabase.rpc('heal_wounded_troops', { p_troop_type: troopType, p_amount: amount })
  if (error) return { ok: false, error: error.message }
  return data as { ok: boolean; error?: string; healed?: number; cost?: number }
}

export async function getBattleReports(userId: string): Promise<BattleReport[]> {
  const { data, error } = await supabase
    .from('battle_reports')
    .select('*')
    .or(`attacker_id.eq.${userId},defender_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return (data || []) as BattleReport[]
}

// ─── Enforcer upgrade ─────────────────────────────────────────────────────────

export async function upgradeEnforcer(
  userEnforcerId: string,
): Promise<{ ok: boolean; error?: string; new_stars?: number; shards_remaining?: number }> {
  const { data, error } = await supabase.rpc('upgrade_enforcer', { p_enforcer_id: userEnforcerId })
  if (error) return { ok: false, error: error.message }
  return data as { ok: boolean; error?: string; new_stars?: number; shards_remaining?: number }
}

// ─── Families ─────────────────────────────────────────────────────────────────

export async function getFamilies(): Promise<Family[]> {
  const { data, error } = await supabase.from('families').select('*').order('power', { ascending: false })
  if (error) throw error
  return (data || []) as Family[]
}

export async function getFamilyDetails(familyId: string): Promise<FamilyDetails | null> {
  const { data, error } = await supabase.rpc('get_family_details', { p_family_id: familyId })
  if (error) throw error
  return data as FamilyDetails
}

export async function createFamily(
  name: string, tag: string, description?: string,
): Promise<{ ok: boolean; error?: string; family_id?: string }> {
  const { data, error } = await supabase.rpc('create_family', { p_name: name, p_tag: tag, p_description: description ?? '' })
  if (error) return { ok: false, error: error.message }
  return data as { ok: boolean; error?: string; family_id?: string }
}

export async function joinFamily(familyId: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('join_family', { p_family_id: familyId })
  if (error) return { ok: false, error: error.message }
  return data as { ok: boolean; error?: string }
}

export async function leaveFamily(): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('leave_family')
  if (error) return { ok: false, error: error.message }
  return data as { ok: boolean; error?: string }
}

export async function changeMemberRank(targetUserId: string, newRank: number): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('change_member_rank', { p_target_user_id: targetUserId, p_new_rank: newRank })
  if (error) return { ok: false, error: error.message }
  return data as { ok: boolean; error?: string }
}

export async function kickFamilyMember(targetUserId: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('kick_family_member', { p_target_user_id: targetUserId })
  if (error) return { ok: false, error: error.message }
  return data as { ok: boolean; error?: string }
}

export async function donateToFamily(resource: string, amount: number): Promise<{ ok: boolean; error?: string; contribution?: number; total_contribution?: number }> {
  const { data, error } = await supabase.rpc('donate_to_family', { p_resource: resource, p_amount: amount })
  if (error) return { ok: false, error: error.message }
  return data as { ok: boolean; error?: string; contribution?: number; total_contribution?: number }
}

export async function upgradeFamilyTech(techKey: string): Promise<{ ok: boolean; error?: string; new_level?: number }> {
  const { data, error } = await supabase.rpc('upgrade_family_tech', { p_tech_key: techKey })
  if (error) return { ok: false, error: error.message }
  return data as { ok: boolean; error?: string; new_level?: number }
}

export async function setFamilyAnnouncement(announcement: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('set_family_announcement', { p_announcement: announcement })
  if (error) return { ok: false, error: error.message }
  return data as { ok: boolean; error?: string }
}

export async function requestFamilyHelp(helpType: string, targetId: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('request_family_help', { p_help_type: helpType, p_target_id: targetId })
  if (error) return { ok: false, error: error.message }
  return data as { ok: boolean; error?: string }
}

export async function giveFamilyHelp(requestId: string): Promise<{ ok: boolean; error?: string; time_reduced?: number }> {
  const { data, error } = await supabase.rpc('give_family_help', { p_request_id: requestId })
  if (error) return { ok: false, error: error.message }
  return data as { ok: boolean; error?: string; time_reduced?: number }
}

export async function getFamilyHelpRequests(familyId: string): Promise<FamilyHelpRequest[]> {
  const { data, error } = await supabase
    .from('family_help_requests')
    .select('*')
    .eq('family_id', familyId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as FamilyHelpRequest[]
}

export async function getFamilyChat(familyId: string): Promise<FamilyChatMessage[]> {
  const { data, error } = await supabase
    .from('family_chat')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data || []) as FamilyChatMessage[]
}

export async function sendFamilyChat(familyId: string, message: string, username: string): Promise<{ ok: boolean; error?: string }> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { ok: false, error: 'Not authenticated' }
  const { error } = await supabase.from('family_chat').insert({
    family_id: familyId,
    user_id: userData.user.id,
    username,
    message,
    message_type: 'text',
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ─── Territories ─────────────────────────────────────────────────────────────

export async function getTerritories(): Promise<Territory[]> {
  const { data, error } = await supabase.from('territories').select('*').order('level')
  if (error) throw error
  return (data || []) as Territory[]
}

export async function getTerritoryWars(): Promise<TerritoryWar[]> {
  const { data, error } = await supabase.rpc('get_territory_wars')
  if (error) throw error
  return (data || []) as TerritoryWar[]
}

export async function startTerritoryWar(territoryId: string): Promise<{ ok: boolean; error?: string; war_id?: string }> {
  const { data, error } = await supabase.rpc('start_territory_war', { p_territory_id: territoryId })
  if (error) return { ok: false, error: error.message }
  return data as { ok: boolean; error?: string; war_id?: string }
}

export async function contributeToWar(warId: string, troopType: string, amount: number): Promise<{ ok: boolean; error?: string; points_added?: number }> {
  const { data, error } = await supabase.rpc('contribute_to_war', { p_war_id: warId, p_troop_type: troopType, p_amount: amount })
  if (error) return { ok: false, error: error.message }
  return data as { ok: boolean; error?: string; points_added?: number }
}

export async function resolveTerritoryWar(warId: string): Promise<{ ok: boolean; error?: string; status?: string; winner_family_id?: string }> {
  const { data, error } = await supabase.rpc('resolve_territory_war', { p_war_id: warId })
  if (error) return { ok: false, error: error.message }
  return data as { ok: boolean; error?: string; status?: string; winner_family_id?: string }
}

export async function claimTerritoryReward(): Promise<{ ok: boolean; error?: string; total_income?: number; rewards?: Record<string, number> }> {
  const { data, error } = await supabase.rpc('claim_territory_reward')
  if (error) return { ok: false, error: error.message }
  return data as { ok: boolean; error?: string; total_income?: number; rewards?: Record<string, number> }
}

// ─── VIP & Shop ──────────────────────────────────────────────────────────────

export async function getVipInfo(): Promise<VipInfo | null> {
  const { data, error } = await supabase.rpc('get_vip_info')
  if (error) throw error
  return data as VipInfo
}

export async function claimVipDaily(): Promise<{ ok: boolean; error?: string; diamonds?: number; vip_diamonds?: number; monthly_bonus?: number; season_bonus?: number; chest_tier?: string }> {
  const { data, error } = await supabase.rpc('claim_vip_daily')
  if (error) return { ok: false, error: error.message }
  return data as { ok: boolean; error?: string; diamonds?: number; vip_diamonds?: number; monthly_bonus?: number; season_bonus?: number; chest_tier?: string }
}

export async function getShopProducts(): Promise<ShopProduct[]> {
  const { data, error } = await supabase.from('shop_products').select('*').eq('is_active', true).order('price')
  if (error) throw error
  return (data || []) as ShopProduct[]
}

export async function getChestDefinitions(): Promise<ChestDefinition[]> {
  const { data, error } = await supabase.from('chest_definitions').select('*').order('diamond_cost')
  if (error) throw error
  return (data || []) as ChestDefinition[]
}

export async function openGameChest(chestType: string): Promise<ChestResult> {
  const { data, error } = await supabase.rpc('open_game_chest', { p_chest_type: chestType })
  if (error) return { ok: false, error: error.message }
  return data as ChestResult
}

export async function getPlayerItems(): Promise<PlayerItem[]> {
  const { data, error } = await supabase.rpc('get_player_items')
  if (error) return []
  return (data || []) as PlayerItem[]
}

export async function useSpeedupItem(itemKey: string, targetType: string, targetId: string): Promise<{ ok: boolean; error?: string; minutes_reduced?: number }> {
  const { data, error } = await supabase.rpc('use_speedup_item', { p_item_key: itemKey, p_target_type: targetType, p_target_id: targetId })
  if (error) return { ok: false, error: error.message }
  return data as { ok: boolean; error?: string; minutes_reduced?: number }
}

// ─── Energy Regen ─────────────────────────────────────────────────────────────

export async function regenEnergy(): Promise<{ ok: boolean; dark_job_energy?: number; raid_energy?: number; spy_energy?: number }> {
  const { data, error } = await supabase.rpc('regen_energy')
  if (error) return { ok: false }
  return data as { ok: boolean; dark_job_energy?: number; raid_energy?: number; spy_energy?: number }
}

// ─── Quests ───────────────────────────────────────────────────────────────────

export async function getDailyQuests() {
  const { data, error } = await supabase.rpc('get_daily_quests')
  if (error) throw error
  return data
}

export async function claimDailyLogin() {
  const { data, error } = await supabase.rpc('claim_daily_login')
  if (error) return { ok: false, error: error.message } as const
  return data as { ok: boolean; day?: number; cash?: number; diamonds?: number; xp?: number; label?: string; error?: string } | null
}

export async function claimDailyThreshold(thresholdId: number) {
  const { data, error } = await supabase.rpc('claim_daily_threshold', { p_threshold_id: thresholdId })
  if (error) return { ok: false, error: error.message } as const
  return data as { ok: boolean; chest_type?: string; error?: string } | null
}

export async function getWeeklyQuests() {
  const { data, error } = await supabase.rpc('get_weekly_quests')
  if (error) throw error
  return data
}

export async function claimWeeklyQuest(questType: string) {
  const { data, error } = await supabase.rpc('claim_weekly_quest', { p_quest_type: questType })
  if (error) return { ok: false, error: error.message } as const
  return data as { ok: boolean; cash?: number; diamonds?: number; xp?: number; error?: string } | null
}

// ─── Battle Pass ──────────────────────────────────────────────────────────────

export async function getBattlePass() {
  const { data, error } = await supabase.rpc('get_battle_pass')
  if (error) throw error
  return data
}

export async function claimBpReward(levelNumber: number, track: 'free' | 'premium') {
  const { data, error } = await supabase.rpc('claim_bp_reward', { p_level_number: levelNumber, p_track: track })
  if (error) return { ok: false, error: error.message } as const
  return data as { ok: boolean; reward_type?: string; reward_amount?: number; error?: string } | null
}

export async function unlockPremiumPass() {
  const { data, error } = await supabase.rpc('unlock_premium_pass')
  if (error) return { ok: false, error: error.message } as const
  return data as { ok: boolean; cost?: number; error?: string } | null
}

// ─── Events ───────────────────────────────────────────────────────────────────

export async function getActiveEvents() {
  const { data, error } = await supabase.rpc('get_active_events')
  if (error) throw error
  return data
}

