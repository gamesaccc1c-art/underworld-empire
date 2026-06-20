import { supabase } from './client'
import type {
  AdminPlayer,
  AdminFamily,
  AdminFamilyMember,
  AdminBattle,
  AdminSuspicious,
  AdminPurchase,
  AdminProduct,
  DashboardStats,
} from '@/types/admin'

export async function isAdmin(): Promise<boolean> {
  const { data } = await supabase.rpc('is_admin')
  return !!data
}

export async function getDashboardStats(): Promise<DashboardStats | null> {
  const { data, error } = await supabase.rpc('admin_get_dashboard_stats')
  if (error) throw error
  if (!data?.ok) return null
  return data as DashboardStats
}

export async function getPlayers(
  search?: string,
  limit = 50,
  offset = 0,
): Promise<{ players: AdminPlayer[]; total: number }> {
  const { data, error } = await supabase.rpc('admin_get_players', {
    p_search: search || null,
    p_limit: limit,
    p_offset: offset,
  })
  if (error) throw error
  if (!data?.ok) return { players: [], total: 0 }
  return { players: data.players as AdminPlayer[], total: data.total as number }
}

export async function getPlayer(playerId: string): Promise<{
  player: AdminPlayer
  buildings: unknown[]
  recent_missions: unknown[]
  recent_battles: unknown[]
  family: unknown
} | null> {
  const { data, error } = await supabase.rpc('admin_get_player', { p_player_id: playerId })
  if (error) throw error
  if (!data?.ok) return null
  return data as {
    player: AdminPlayer
    buildings: unknown[]
    recent_missions: unknown[]
    recent_battles: unknown[]
    family: unknown
  }
}

export async function adjustResources(
  playerId: string,
  resource: string,
  amount: number,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('admin_adjust_resources', {
    p_player_id: playerId,
    p_resource: resource,
    p_amount: amount,
    p_reason: reason,
  })
  if (error) return { ok: false, error: error.message }
  return (data as { ok: boolean; error?: string }) || { ok: false, error: 'No response' }
}

export async function banPlayer(
  playerId: string,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('admin_ban_player', {
    p_player_id: playerId,
    p_reason: reason,
  })
  if (error) return { ok: false, error: error.message }
  return (data as { ok: boolean; error?: string }) || { ok: false, error: 'No response' }
}

export async function unbanPlayer(playerId: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('admin_unban_player', { p_player_id: playerId })
  if (error) return { ok: false, error: error.message }
  return (data as { ok: boolean; error?: string }) || { ok: false, error: 'No response' }
}

export async function getProducts(): Promise<AdminProduct[]> {
  const { data, error } = await supabase.rpc('admin_get_products')
  if (error) throw error
  if (!data?.ok) return []
  return data.products as AdminProduct[]
}

export async function updateProduct(
  productId: string,
  updates: { is_active?: boolean; price?: number; contents?: Record<string, number>; name?: string },
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('admin_update_product', {
    p_product_id: productId,
    p_is_active: updates.is_active ?? null,
    p_price: updates.price ?? null,
    p_contents: updates.contents ?? null,
    p_name: updates.name ?? null,
  })
  if (error) return { ok: false, error: error.message }
  return (data as { ok: boolean; error?: string }) || { ok: false, error: 'No response' }
}

export async function getFamilies(
  limit = 50,
  offset = 0,
): Promise<{ families: AdminFamily[]; total: number }> {
  const { data, error } = await supabase.rpc('admin_get_families', {
    p_limit: limit,
    p_offset: offset,
  })
  if (error) throw error
  if (!data?.ok) return { families: [], total: 0 }
  return { families: data.families as AdminFamily[], total: data.total as number }
}

export async function getFamily(familyId: string): Promise<{
  family: AdminFamily
  members: AdminFamilyMember[]
} | null> {
  const { data, error } = await supabase.rpc('admin_get_family', { p_family_id: familyId })
  if (error) throw error
  if (!data?.ok) return null
  return { family: data.family as AdminFamily, members: data.members as AdminFamilyMember[] }
}

export async function getBattles(
  playerId?: string,
  limit = 50,
  offset = 0,
): Promise<{ battles: AdminBattle[]; total: number }> {
  const { data, error } = await supabase.rpc('admin_get_battles', {
    p_player_id: playerId || null,
    p_limit: limit,
    p_offset: offset,
  })
  if (error) throw error
  if (!data?.ok) return { battles: [], total: 0 }
  return { battles: data.battles as AdminBattle[], total: data.total as number }
}

export async function getSuspicious(
  severity?: string,
  limit = 100,
  offset = 0,
): Promise<{ items: AdminSuspicious[]; total: number }> {
  const { data, error } = await supabase.rpc('admin_get_suspicious', {
    p_severity: severity || null,
    p_limit: limit,
    p_offset: offset,
  })
  if (error) throw error
  if (!data?.ok) return { items: [], total: 0 }
  return { items: data.items as AdminSuspicious[], total: data.total as number }
}

export async function getPurchases(
  limit = 50,
  offset = 0,
): Promise<{ purchases: AdminPurchase[]; total: number }> {
  const { data, error } = await supabase.rpc('admin_get_purchases', {
    p_limit: limit,
    p_offset: offset,
  })
  if (error) throw error
  if (!data?.ok) return { purchases: [], total: 0 }
  return { purchases: data.purchases as AdminPurchase[], total: data.total as number }
}

export async function getChests() {
  const { data, error } = await supabase.rpc('admin_get_chests')
  if (error) throw error
  return data?.ok ? data.chests : []
}

export async function getVipDefs() {
  const { data, error } = await supabase.rpc('admin_get_vip_defs')
  if (error) throw error
  return data?.ok ? data.vip_defs : []
}
