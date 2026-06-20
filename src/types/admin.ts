export interface AdminPlayer {
  id: string
  email: string
  username: string
  level: number
  xp: number
  power: number
  vip_level: number
  vip_points: number
  cash: number
  diamonds: number
  influence: number
  loyalty: number
  weapon_power: number
  black_money: number
  intel: number
  police_heat: number
  role: 'player' | 'admin'
  is_banned: boolean
  ban_reason: string | null
  created_at: string
  updated_at: string
  title: string
  reputation: number
  family_id: string | null
}

export interface AdminFamily {
  id: string
  name: string
  tag: string
  power: number
  level: number
  territory_count: number
  member_count: number
  leader_name: string | null
  created_at: string
}

export interface AdminFamilyMember {
  id: string
  user_id: string
  username: string
  level: number
  power: number
  rank: number
  contribution: number
  joined_at: string
}

export interface AdminBattle {
  id: string
  attacker_id: string
  defender_id: string
  attacker_name: string | null
  defender_name: string | null
  result: string
  battle_type: string
  attacker_power: number
  defender_power: number
  loot: Record<string, number>
  casualties: Record<string, number>
  created_at: string
}

export interface AdminSuspicious {
  id: string
  user_id: string
  username: string | null
  email: string | null
  activity_type: string
  severity: 'low' | 'medium' | 'high'
  description: string
  payload: Record<string, unknown>
  created_at: string
}

export interface AdminPurchase {
  id: string
  user_id: string
  username: string | null
  sku: string | null
  product_name: string | null
  amount: number
  currency: string
  status: string
  created_at: string
}

export interface AdminProduct {
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
  badge: string | null
  discount_label: string | null
  purchase_count: number
}

export interface DashboardStats {
  total_players: number
  total_purchases: number
  total_diamond_spent: number
  top_players: AdminPlayer[]
  top_families: AdminFamily[]
  recent_battles: AdminBattle[]
  recent_purchases: AdminPurchase[]
  recent_suspicious: AdminSuspicious[]
}
