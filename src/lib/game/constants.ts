import type { BuildingDefinition, Enforcer, Mission, ShopProduct, VipReward, Rarity } from '@/types/game'

export const RESOURCE_INFO = {
  cash: { name: 'Nakit', icon: 'Banknote', color: 'text-green-400' },
  influence: { name: 'Etki', icon: 'Crown', color: 'text-purple-400' },
  loyalty: { name: 'Sadakat', icon: 'Heart', color: 'text-red-400' },
  weapon_power: { name: 'Silah Gucu', icon: 'Sword', color: 'text-orange-400' },
  black_money: { name: 'Kara Para', icon: 'CircleDollarSign', color: 'text-gold' },
  intel: { name: 'Istihbarat', icon: 'Eye', color: 'text-blue-400' },
} as const

export const BUILDING_DEFINITIONS: BuildingDefinition[] = [
  {
    type: 'headquarters', name: 'Karargah', icon: 'Castle',
    description: 'Ana bina. Diger tum binalarin seviye limitini belirler.',
    maxLevel: 30, baseCost: { cash: 1000, influence: 0, loyalty: 0, weapon_power: 0, black_money: 0, intel: 0 },
    baseDuration: 60, productionType: null, productionRate: 0,
  },
  {
    type: 'cash_vault', name: 'Nakit Kasasi', icon: 'Vault',
    description: 'Nakit uretir. Seviye arttikca saatlik uretim artar.',
    maxLevel: 30, baseCost: { cash: 500, influence: 0, loyalty: 0, weapon_power: 0, black_money: 0, intel: 0 },
    baseDuration: 30, productionType: 'cash', productionRate: 100,
  },
  {
    type: 'black_market', name: 'Kara Borsa', icon: 'Store',
    description: 'Kara Para uretir. Gizli anlasmalar acar.',
    maxLevel: 30, baseCost: { cash: 800, influence: 100, loyalty: 0, weapon_power: 0, black_money: 0, intel: 0 },
    baseDuration: 45, productionType: 'black_money', productionRate: 50,
  },
  {
    type: 'weapon_depot', name: 'Silah Deposu', icon: 'Swords',
    description: 'Silah Gucu uretir. Savas birimlerini guclendirir.',
    maxLevel: 30, baseCost: { cash: 700, influence: 0, loyalty: 0, weapon_power: 0, black_money: 50, intel: 0 },
    baseDuration: 40, productionType: 'weapon_power', productionRate: 80,
  },
  {
    type: 'recruitment_center', name: 'Adam Toplama', icon: 'Users',
    description: 'Yeni adamlar egitir. Egitim hizi bina seviyesiyle artar.',
    maxLevel: 30, baseCost: { cash: 600, influence: 50, loyalty: 0, weapon_power: 0, black_money: 0, intel: 0 },
    baseDuration: 35, productionType: null, productionRate: 0,
  },
  {
    type: 'secret_office', name: 'Gizli Ofis', icon: 'EyeOff',
    description: 'Istihbarat uretir. Casusluk gorevlerini acar.',
    maxLevel: 30, baseCost: { cash: 900, influence: 0, loyalty: 0, weapon_power: 0, black_money: 100, intel: 0 },
    baseDuration: 50, productionType: 'intel', productionRate: 40,
  },
  {
    type: 'nightclub', name: 'Gece Kulubu', icon: 'Wine',
    description: 'Sadakat uretir. Lider itibari saglar.',
    maxLevel: 30, baseCost: { cash: 1200, influence: 200, loyalty: 0, weapon_power: 0, black_money: 0, intel: 0 },
    baseDuration: 55, productionType: 'loyalty', productionRate: 60,
  },
  {
    type: 'casino', name: 'Kumarhane', icon: 'Dice5',
    description: 'Yuksek nakit uretir. Rastgele bonus verir.',
    maxLevel: 30, baseCost: { cash: 1500, influence: 300, loyalty: 100, weapon_power: 0, black_money: 200, intel: 0 },
    baseDuration: 60, productionType: 'cash', productionRate: 200,
  },
  {
    type: 'garage', name: 'Tamirhane', icon: 'Car',
    description: 'Aracli birlikleri acar. Baskin sonrasi toparlama hizini artirir.',
    maxLevel: 30, baseCost: { cash: 800, influence: 0, loyalty: 0, weapon_power: 100, black_money: 0, intel: 0 },
    baseDuration: 40, productionType: null, productionRate: 0,
  },
  {
    type: 'defense_wall', name: 'Savunma Duvari', icon: 'Shield',
    description: 'Rakip baskinlara karsi savunma verir.',
    maxLevel: 30, baseCost: { cash: 1000, influence: 0, loyalty: 0, weapon_power: 200, black_money: 0, intel: 0 },
    baseDuration: 45, productionType: null, productionRate: 0,
  },
  {
    type: 'prison_contacts', name: 'Hapishane Baglantilari', icon: 'Lock',
    description: 'Yakalanma riskini azaltir. Polis baskini sonrasi ceza suresini dusurur.',
    maxLevel: 30, baseCost: { cash: 600, influence: 150, loyalty: 0, weapon_power: 0, black_money: 100, intel: 50 },
    baseDuration: 35, productionType: null, productionRate: 0,
  },
  {
    type: 'leader_mansion', name: 'Lider Konagi', icon: 'Crown',
    description: 'Enforcer sistemini acar. Ozel karakterler burada yonetilir.',
    maxLevel: 30, baseCost: { cash: 2000, influence: 500, loyalty: 200, weapon_power: 0, black_money: 300, intel: 0 },
    baseDuration: 90, productionType: 'influence', productionRate: 70,
  },
]

export const ENFORCER_PRESETS: Enforcer[] = [
  { id: 'shadow_blade', key: 'shadow_blade', name: 'Golge Bicak', class: 'hitman', rarity: 'epic', description: 'Sessiz ve olumcul. Baskinlarda ekstra hasar verir.', active_skill: 'Olumcul Vurusu', passive_skill: 'Golge Adimi', attack_bonus: 25, defense_bonus: 5, economy_bonus: 0, crime_success_bonus: 15 },
  { id: 'iron_fist', key: 'iron_fist', name: 'Demir Yumruk', class: 'bodyguard', rarity: 'rare', description: 'Kale gibi savunma. Karargahi korur.', active_skill: 'Celik Kalkan', passive_skill: 'Yilmaz Savunucu', attack_bonus: 5, defense_bonus: 30, economy_bonus: 0, crime_success_bonus: 0 },
  { id: 'golden_count', key: 'golden_count', name: 'Altin Kont', class: 'accountant', rarity: 'legendary', description: 'Para buldugu yerde para vardir.', active_skill: 'Altin Yagmuru', passive_skill: 'Vergi Kacakcisi', attack_bonus: 0, defense_bonus: 0, economy_bonus: 40, crime_success_bonus: 10 },
  { id: 'ghost_runner', key: 'ghost_runner', name: 'Hayalet Kurye', class: 'smuggler', rarity: 'rare', description: 'Hicbir sevkiyat iz birakmaz.', active_skill: 'Gorunmez Yuk', passive_skill: 'Hizli Teslimat', attack_bonus: 10, defense_bonus: 0, economy_bonus: 15, crime_success_bonus: 25 },
  { id: 'cyber_wolf', key: 'cyber_wolf', name: 'Siber Kurt', class: 'hacker', rarity: 'epic', description: 'Dijital dunyada iz surucu.', active_skill: 'Sistem Carki', passive_skill: 'Veri Madencisi', attack_bonus: 0, defense_bonus: 10, economy_bonus: 20, crime_success_bonus: 20 },
  { id: 'don_carlo', key: 'don_carlo', name: 'Don Carlo', class: 'mediator', rarity: 'legendary', description: 'Diplomat ve arabulucu. Aile iliskilerinde uzman.', active_skill: 'Teklif Edilemez', passive_skill: 'Diplomasi Ustasi', attack_bonus: 5, defense_bonus: 5, economy_bonus: 25, crime_success_bonus: 15 },
  { id: 'viper', key: 'viper', name: 'Engerek', class: 'street_leader', rarity: 'common', description: 'Sokaklarin efendisi.', active_skill: 'Sokak Savasçisi', passive_skill: 'Bolge Hakimiyeti', attack_bonus: 15, defense_bonus: 10, economy_bonus: 5, crime_success_bonus: 10 },
  { id: 'deep_throat', key: 'deep_throat', name: 'Derin Bogaz', class: 'mole', rarity: 'mythic', description: 'Polisin icindeki goz. En degerli enforcer.', active_skill: 'Ic Bilgi', passive_skill: 'Risk Sifirla', attack_bonus: 0, defense_bonus: 15, economy_bonus: 10, crime_success_bonus: 35 },
]

export const DARK_JOBS: Omit<Mission, 'id'>[] = [
  { category: 'dark_job', name: 'Mahalle Tahsilati', description: 'Bolgedeki dukkanlardan harac topla.', required_level: 1, duration: 300, rewards: { cash: 500, xp: 50 }, risk: 10, police_heat_gain: 5 },
  { category: 'dark_job', name: 'Gizli Sevkiyat', description: 'Limandan gizli bir yuklemeyi teslim et.', required_level: 3, duration: 600, rewards: { cash: 1200, black_money: 200, xp: 100 }, risk: 25, police_heat_gain: 10 },
  { category: 'dark_job', name: 'Kara Borsa Anlasmasi', description: 'Yeralti pazarinda buyuk bir anlasma kapat.', required_level: 5, duration: 900, rewards: { black_money: 800, influence: 150, xp: 150 }, risk: 35, police_heat_gain: 15 },
  { category: 'dark_job', name: 'Rakip Mekan Sabotaji', description: 'Rakip aile mekanini is goremez hale getir.', required_level: 7, duration: 1200, rewards: { influence: 300, weapon_power: 200, xp: 200 }, risk: 45, police_heat_gain: 20 },
  { category: 'dark_job', name: 'Polis Takibinden Kacis', description: 'Arananlari gizli bir rotayla sehir disina cikar.', required_level: 4, duration: 480, rewards: { loyalty: 400, intel: 150, xp: 120 }, risk: 30, police_heat_gain: 8 },
  { category: 'dark_job', name: 'Bilgi Sizdirma', description: 'Rakip ailenin planlarini ogrenip sat.', required_level: 6, duration: 720, rewards: { intel: 500, cash: 2000, xp: 180 }, risk: 40, police_heat_gain: 12 },
  { category: 'dark_job', name: 'Liman Kontrolu', description: 'Liman bolgesinde hakimiyet kur.', required_level: 10, duration: 1800, rewards: { cash: 5000, black_money: 1500, influence: 500, xp: 350 }, risk: 60, police_heat_gain: 25 },
  { category: 'dark_job', name: 'Depo Baskini', description: 'Rakip cetanin silah deposuna baskin duz.', required_level: 8, duration: 1500, rewards: { weapon_power: 1000, cash: 3000, xp: 250 }, risk: 55, police_heat_gain: 22 },
  { category: 'dark_job', name: 'Casino Kontrolu', description: 'Kumarhane isletmesini ele gecir.', required_level: 12, duration: 2400, rewards: { cash: 8000, influence: 800, loyalty: 300, xp: 400 }, risk: 50, police_heat_gain: 18 },
  { category: 'dark_job', name: 'Siyasi Baglanti', description: 'Sehir meclisinde bir mutttefik kazan.', required_level: 15, duration: 3600, rewards: { influence: 2000, intel: 1000, xp: 500 }, risk: 30, police_heat_gain: 5 },
]

export const DAILY_MISSIONS: Omit<Mission, 'id'>[] = [
  { category: 'daily', name: 'Gunluk Tahsilat', description: '10.000 Nakit topla.', required_level: 1, duration: 0, rewards: { cash: 2000, xp: 30 }, risk: 0, police_heat_gain: 0 },
  { category: 'daily', name: 'Adam Egit', description: '10 adam egit.', required_level: 1, duration: 0, rewards: { loyalty: 100, xp: 30 }, risk: 0, police_heat_gain: 0 },
  { category: 'daily', name: 'Bina Yukselt', description: '1 bina yukselt.', required_level: 1, duration: 0, rewards: { influence: 50, xp: 50 }, risk: 0, police_heat_gain: 0 },
  { category: 'daily', name: 'Arastirma Baslat', description: '1 arastirma baslat.', required_level: 2, duration: 0, rewards: { intel: 50, xp: 40 }, risk: 0, police_heat_gain: 0 },
  { category: 'daily', name: 'Baskin Yap', description: '3 baskin yap.', required_level: 3, duration: 0, rewards: { weapon_power: 200, xp: 60 }, risk: 0, police_heat_gain: 0 },
]

export const SHOP_PRODUCTS: Omit<ShopProduct, 'id'>[] = [
  { sku: 'starter_pack', name: 'Baslangic Paketi', description: '1.000 Elmas, 2 saat hizlandirici, 50.000 Nakit, Rare Enforcer', price: 99, currency: 'TRY', contents: { diamonds: 1000, cash: 50000, speed_2h: 1 }, is_active: true, is_limited: false, starts_at: null, ends_at: null, badge: 'Yeni Baslayanlar', discount_label: '%80 Deger' },
  { sku: 'power_pack', name: 'Guc Paketi', description: '7.500 Elmas, 10 saat hizlandirici, 250.000 Nakit, Epic Enforcer Parcasi', price: 499, currency: 'TRY', contents: { diamonds: 7500, cash: 250000, weapon_power: 100000, speed_10h: 1 }, is_active: true, is_limited: false, starts_at: null, ends_at: null, badge: 'En Cok Satan', discount_label: '%300 Deger' },
  { sku: 'boss_pack', name: 'Patron Paketi', description: '40.000 Elmas, Legendary Enforcer, 3 gunluk kalkan, 50 saat hizlandirici', price: 1999, currency: 'TRY', contents: { diamonds: 40000, speed_50h: 1, shield_3d: 1 }, is_active: true, is_limited: true, starts_at: null, ends_at: null, badge: 'PATRON', discount_label: '%500 Deger' },
  { sku: 'monthly_card', name: 'Aylik Kart', description: 'Her gun 200 Elmas, Gunluk sandik, Ek gorev hakki', price: 149, currency: 'TRY', contents: { diamonds_daily: 200, daily_chest: 1, extra_mission: 1 }, is_active: true, is_limited: false, starts_at: null, ends_at: null, badge: 'Aylik', discount_label: 'Gunluk 5 TL' },
  { sku: 'diamond_small', name: '500 Elmas', description: '500 Elmas paketi', price: 49, currency: 'TRY', contents: { diamonds: 500 }, is_active: true, is_limited: false, starts_at: null, ends_at: null },
]

export const VIP_REWARDS: VipReward[] = [
  { vip_level: 1, bonus_type: 'construction_speed', bonus_value: 5, description: 'Insaat hizi +%5' },
  { vip_level: 1, bonus_type: 'daily_diamonds', bonus_value: 20, description: 'Gunluk 20 Elmas' },
  { vip_level: 2, bonus_type: 'construction_speed', bonus_value: 10, description: 'Insaat hizi +%10' },
  { vip_level: 2, bonus_type: 'resource_production', bonus_value: 5, description: 'Kaynak uretimi +%5' },
  { vip_level: 3, bonus_type: 'training_speed', bonus_value: 10, description: 'Egitim hizi +%10' },
  { vip_level: 3, bonus_type: 'attack_bonus', bonus_value: 3, description: 'Saldiri bonusu +%3' },
  { vip_level: 4, bonus_type: 'construction_speed', bonus_value: 15, description: 'Insaat hizi +%15' },
  { vip_level: 4, bonus_type: 'daily_diamonds', bonus_value: 50, description: 'Gunluk 50 Elmas' },
  { vip_level: 5, bonus_type: 'resource_production', bonus_value: 15, description: 'Kaynak uretimi +%15' },
  { vip_level: 5, bonus_type: 'defense_bonus', bonus_value: 5, description: 'Savunma bonusu +%5' },
  { vip_level: 5, bonus_type: 'daily_diamonds', bonus_value: 100, description: 'Gunluk 100 Elmas' },
]

export const TERRITORIES = [
  { name: 'Liman', district_type: 'harbor', level: 5, resource_bonus: 'black_money', defense_bonus: 10 },
  { name: 'Sanayi Bolgesi', district_type: 'industrial', level: 3, resource_bonus: 'weapon_power', defense_bonus: 15 },
  { name: 'Gece Kulubu Sokagi', district_type: 'nightlife', level: 4, resource_bonus: 'loyalty', defense_bonus: 5 },
  { name: 'Finans Merkezi', district_type: 'finance', level: 8, resource_bonus: 'cash', defense_bonus: 20 },
  { name: 'Eski Mahalle', district_type: 'old_quarter', level: 1, resource_bonus: 'influence', defense_bonus: 8 },
]

export function getBuildingUpgradeCost(def: BuildingDefinition, currentLevel: number): Record<string, number> {
  const multiplier = Math.pow(1.5, currentLevel)
  const costs: Record<string, number> = {}
  for (const [res, base] of Object.entries(def.baseCost)) {
    if (base > 0) costs[res] = Math.floor(base * multiplier)
  }
  return costs
}

export function getBuildingUpgradeDuration(def: BuildingDefinition, currentLevel: number): number {
  return Math.floor(def.baseDuration * Math.pow(1.4, currentLevel))
}

export function getProductionPerHour(def: BuildingDefinition, level: number): number {
  if (!def.productionType || level === 0) return 0
  return Math.floor(def.productionRate * (1 + (level - 1) * 0.3))
}

export function getXpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.6, level - 1))
}

export function getRarityColor(rarity: Rarity): string {
  const colors: Record<Rarity, string> = {
    common: 'text-muted-foreground',
    uncommon: 'text-green-400',
    rare: 'text-blue-400',
    epic: 'text-purple-400',
    legendary: 'text-gold',
    mythic: 'text-crimson',
  }
  return colors[rarity]
}

export function getRarityBg(rarity: Rarity): string {
  const colors: Record<Rarity, string> = {
    common: 'bg-muted',
    uncommon: 'bg-green-950/30',
    rare: 'bg-blue-950/50',
    epic: 'bg-purple-950/50',
    legendary: 'bg-amber-950/30',
    mythic: 'bg-red-950/30',
  }
  return colors[rarity]
}

export function getTitleForLevel(level: number): string {
  if (level >= 50) return 'Yeraltı İmparatoru'
  if (level >= 40) return 'Sehir Efendisi'
  if (level >= 35) return 'Yeraltı Devi'
  if (level >= 30) return 'Mafya Patronu'
  if (level >= 25) return 'Cete Lideri'
  if (level >= 20) return 'Para Efendisi'
  if (level >= 15) return 'Sokak Aslan'
  if (level >= 12) return 'Silah Tüccarı'
  if (level >= 10) return 'Sifir Güven'
  if (level >= 8) return 'Cete Üyesi'
  if (level >= 5) return 'Sokak Kabadayisi'
  if (level >= 3) return 'Acemi'
  return 'Sokak Serserisi'
}
