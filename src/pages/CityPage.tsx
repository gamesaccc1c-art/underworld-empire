import { useEffect, useState, useMemo } from 'react'
import { useGameStore } from '@/stores/gameStore'
import { useGuestStore } from '@/stores/guestStore'
import { BuildingCard } from '@/components/city/BuildingCard'
import { NewBuildingCard } from '@/components/city/NewBuildingCard'
import { BUILDING_DEFINITIONS, RESOURCE_INFO, VIP_REWARDS } from '@/lib/game/constants'
import { computeResearchEffects, applyProductionBonus } from '@/lib/game/effects'
import type { BuildingDefinitionDB } from '@/types/game'
import { Spinner } from '@/components/ui/spinner'
import { Zap, TrendingUp, Shield, Flame, Microscope, TrendingDown, PackagePlus } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { Button } from '@/components/ui/button'

function toDBShape(def: typeof BUILDING_DEFINITIONS[0]): BuildingDefinitionDB {
  return {
    id: def.type,
    type: def.type as BuildingDefinitionDB['type'],
    name: def.name,
    icon: def.icon,
    description: def.description,
    max_level: def.maxLevel,
    base_cash: def.baseCost.cash ?? 0,
    base_influence: def.baseCost.influence ?? 0,
    base_loyalty: def.baseCost.loyalty ?? 0,
    base_weapon_power: def.baseCost.weapon_power ?? 0,
    base_black_money: def.baseCost.black_money ?? 0,
    base_intel: def.baseCost.intel ?? 0,
    base_duration: def.baseDuration,
    production_type: def.productionType,
    production_rate: def.productionRate,
    production_capacity_hours: 8,
    required_hq_level: 0,
  }
}

export function CityPage() {
  const isGuest = useGuestStore(s => s.isGuest)
  const guestPlayer = useGuestStore(s => s.player)
  const guestBuildings = useGuestStore(s => s.buildings)
  const { player: authPlayer, buildings: authBuildings, buildingDefinitions, loading, loadAllData, userResearch, researchDefinitions, collectAllProduction } = useGameStore()

  const player = isGuest ? guestPlayer : authPlayer
  const buildings = isGuest ? guestBuildings : authBuildings
  const [collecting, setCollecting] = useState(false)

  const definitions: BuildingDefinitionDB[] = isGuest
    ? BUILDING_DEFINITIONS.map(toDBShape)
    : buildingDefinitions.length > 0
      ? buildingDefinitions
      : BUILDING_DEFINITIONS.map(toDBShape)

  useEffect(() => {
    if (!isGuest) loadAllData()
  }, [isGuest, loadAllData])

  if (loading && !player) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Spinner className="h-8 w-8 text-gold" />
        <p className="text-xs text-muted-foreground font-display tracking-wider">ŞEHİR YÜKLENİYOR...</p>
      </div>
    )
  }

  const builtTypes = new Set(buildings.map(b => b.building_type))
  const availableDefinitions = definitions.filter(def => !builtTypes.has(def.type))
  const hqLevel = buildings.find(b => b.building_type === 'headquarters')?.level || 0

  const researchEffects = isGuest ? null : computeResearchEffects(userResearch, researchDefinitions)
  const vipProductionBonus = VIP_REWARDS
    .filter(r => r.vip_level <= (player?.vip_level ?? 0) && r.bonus_type === 'resource_production')
    .reduce((acc, r) => acc + r.bonus_value, 0)

  const PRODUCTION_BONUS_MAP: Record<string, number> = {
    cash:        (researchEffects?.cashProductionBonus ?? 0) + vipProductionBonus,
    black_money: (researchEffects?.blackMoneyProductionBonus ?? 0) + vipProductionBonus,
    intel:       (researchEffects?.intelProductionBonus ?? 0) + vipProductionBonus,
    loyalty:     (researchEffects?.loyaltyProductionBonus ?? 0) + vipProductionBonus,
    influence:   vipProductionBonus,
    weapon_power: vipProductionBonus,
  }

  const production: Record<string, number> = {}
  for (const b of buildings) {
    if (b.is_upgrading) continue
    const def = definitions.find(d => d.type === b.building_type)
    if (!def?.production_type) continue
    const baseRate = Math.floor(def.production_rate * (1 + (b.level - 1) * 0.3))
    const bonus = PRODUCTION_BONUS_MAP[def.production_type] ?? 0
    const rate = applyProductionBonus(baseRate, bonus)
    if (rate > 0) production[def.production_type] = (production[def.production_type] || 0) + rate
  }

  const totalProductionBonus = (researchEffects?.cashProductionBonus ?? 0) + vipProductionBonus
  const upgradingCount = buildings.filter(b => b.is_upgrading).length

  const hasAnyPending = useMemo(() => buildings.some(b => {
    if (b.is_upgrading) return false
    const def = definitions.find(d => d.type === b.building_type)
    if (!def?.production_type || def.production_rate <= 0) return false
    const rate = Math.floor(def.production_rate * (1 + (b.level - 1) * 0.3))
    const elapsed = (Date.now() - new Date(b.last_collected_at).getTime()) / 3600000
    return Math.floor(Math.min(elapsed * rate, rate * def.production_capacity_hours)) > 0
  }), [buildings, definitions])

  async function handleCollectAll() {
    if (isGuest) return
    setCollecting(true)
    await collectAllProduction()
    setCollecting(false)
  }

  return (
    <div className="p-3 space-y-4 pb-6">
      {/* City header */}
      <div className="relative rounded-2xl overflow-hidden border border-border/30 bg-gradient-to-br from-slate-900 via-card to-slate-950">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-950/20 via-transparent to-red-950/10 pointer-events-none" />
        <div className="relative px-4 pt-4 pb-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-xl font-black tracking-wider text-gold drop-shadow-[0_0_15px_oklch(0.78_0.15_75/30%)]">
                KARANLIK ŞEHİR
              </h1>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {player?.username || '...'} · {player?.title}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">Karargah</p>
              <p className="text-xl font-black text-gold font-display">Lv.{hqLevel}</p>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: Zap, value: player?.power?.toLocaleString() || '0', label: 'Güç', color: 'text-gold' },
              { icon: TrendingUp, value: player?.level || 1, label: 'Seviye', color: 'text-neon' },
              { icon: Shield, value: buildings.length, label: 'Bina', color: 'text-blue-400' },
              { icon: TrendingDown, value: upgradingCount, label: 'Yapım', color: 'text-orange-400' },
            ].map(({ value, label, color }) => (
              <div key={label} className="text-center">
                <p className={`text-lg font-black ${color} font-display leading-none`}>{value}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2">
        <NavLink to="/missions" className="block">
          <Button variant="outline" className="w-full h-10 text-xs border-orange-900/50 bg-orange-950/20 hover:bg-orange-950/40 text-orange-300 font-bold gap-2 group">
            <Flame className="h-4 w-4 group-hover:scale-110 transition-transform" />
            Karanlık İşler
          </Button>
        </NavLink>
        <NavLink to="/research" className="block">
          <Button variant="outline" className="w-full h-10 text-xs border-purple-900/50 bg-purple-950/20 hover:bg-purple-950/40 text-purple-300 font-bold gap-2 group">
            <Microscope className="h-4 w-4 group-hover:scale-110 transition-transform" />
            Araştırma
          </Button>
        </NavLink>
      </div>

      {/* Production summary */}
      {Object.keys(production).length > 0 && (
        <div className="bg-card/60 border border-border/30 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Saatlik Üretim</p>
            {totalProductionBonus > 0 && (
              <span className="text-[9px] text-neon bg-neon/10 border border-neon/20 rounded-full px-2 py-0.5 font-bold">
                +%{totalProductionBonus} bonus
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {Object.entries(production).map(([key, rate]) => {
              const info = RESOURCE_INFO[key as keyof typeof RESOURCE_INFO]
              return (
                <div key={key} className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">{info?.name || key}</span>
                  <span className={`font-bold tabular-nums ${info?.color || 'text-neon'}`}>
                    +{rate >= 1000 ? `${(rate/1000).toFixed(1)}K` : rate}/sa
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Buildings grid */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-sm font-bold">Binalarım</h2>
          <div className="flex items-center gap-2">
            {!isGuest && hasAnyPending && (
              <Button
                size="sm"
                className="h-7 px-2.5 text-[10px] gradient-gold text-primary-foreground font-bold gap-1"
                disabled={collecting}
                onClick={handleCollectAll}
              >
                <PackagePlus className="h-3.5 w-3.5" />
                {collecting ? 'Toplanıyor...' : 'Tümünü Topla'}
              </Button>
            )}
            {buildings.length > 0 && (
              <span className="text-[10px] text-muted-foreground bg-secondary/60 px-2 py-0.5 rounded-full font-medium">{buildings.length} bina</span>
            )}
          </div>
        </div>
        {buildings.length === 0 ? (
          <div className="bg-card/40 border border-dashed border-border/40 rounded-2xl p-10 text-center space-y-2">
            <div className="h-12 w-12 rounded-2xl bg-secondary/40 flex items-center justify-center mx-auto">
              <Shield className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground">Henüz bina yok</p>
            <p className="text-xs text-muted-foreground/60">Önce Karargah'ı kur!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {buildings.map(building => {
              const dbDef = definitions.find(d => d.type === building.building_type)
              return (
                <BuildingCard
                  key={building.id}
                  building={building}
                  hqLevel={hqLevel}
                  dbDef={dbDef}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Available buildings */}
      {availableDefinitions.length > 0 && (
        <div>
          <h2 className="text-sm font-bold mb-2.5 text-muted-foreground flex items-center gap-1.5">
            Yeni Bina Kur
            <span className="text-[10px] bg-secondary/60 px-2 py-0.5 rounded-full">{availableDefinitions.length}</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {availableDefinitions.map(def => (
              <NewBuildingCard key={def.type} definition={def} hqLevel={hqLevel} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
