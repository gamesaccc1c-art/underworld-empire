import type { Building, BuildingDefinitionDB } from '@/types/game'
import { useTimer } from '@/hooks/useTimer'
import { useGameStore } from '@/stores/gameStore'
import { useGuestStore } from '@/stores/guestStore'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ArrowUp, Clock, Zap, Gem, Castle, Vault, Store, Swords, Users, EyeOff, Wine, Dice5, Car, Shield, Lock, Crown, Package, TrendingUp } from 'lucide-react'
import { useState, useMemo, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { BUILDING_DEFINITIONS, getBuildingUpgradeCost, getBuildingUpgradeDuration, getProductionPerHour, RESOURCE_INFO } from '@/lib/game/constants'

const iconMap: Record<string, React.FC<{ className?: string }>> = {
  Castle, Vault, Store, Swords, Users, EyeOff, Wine, Dice5, Car, Shield, Lock, Crown,
}

const BUILDING_THEMES: Record<string, { gradient: string; glow: string; accent: string }> = {
  headquarters: { gradient: 'from-amber-950/60 to-card', glow: 'hover:border-gold/50', accent: 'text-gold' },
  cash_vault: { gradient: 'from-green-950/40 to-card', glow: 'hover:border-green-600/40', accent: 'text-green-400' },
  black_market: { gradient: 'from-yellow-950/40 to-card', glow: 'hover:border-yellow-600/30', accent: 'text-yellow-400' },
  armory: { gradient: 'from-orange-950/40 to-card', glow: 'hover:border-orange-600/30', accent: 'text-orange-400' },
  training_ground: { gradient: 'from-blue-950/40 to-card', glow: 'hover:border-blue-600/30', accent: 'text-blue-400' },
  intel_hub: { gradient: 'from-cyan-950/40 to-card', glow: 'hover:border-cyan-600/30', accent: 'text-cyan-400' },
  casino: { gradient: 'from-purple-950/40 to-card', glow: 'hover:border-purple-600/30', accent: 'text-purple-400' },
}

function getTheme(type: string) {
  return BUILDING_THEMES[type] || { gradient: 'from-card to-card', glow: 'hover:border-gold/20', accent: 'text-gold' }
}

function getProductionFromDB(def: BuildingDefinitionDB, level: number): number {
  if (!def.production_type || level === 0) return 0
  return Math.floor(def.production_rate * (1 + (level - 1) * 0.3))
}

function getUpgradeCostFromDB(def: BuildingDefinitionDB, currentLevel: number): Record<string, number> {
  const multiplier = Math.pow(1.5, currentLevel)
  const costs: Record<string, number> = {}
  if (def.base_cash > 0)         costs.cash         = Math.floor(def.base_cash         * multiplier)
  if (def.base_influence > 0)    costs.influence    = Math.floor(def.base_influence    * multiplier)
  if (def.base_loyalty > 0)      costs.loyalty      = Math.floor(def.base_loyalty      * multiplier)
  if (def.base_weapon_power > 0) costs.weapon_power = Math.floor(def.base_weapon_power * multiplier)
  if (def.base_black_money > 0)  costs.black_money  = Math.floor(def.base_black_money  * multiplier)
  if (def.base_intel > 0)        costs.intel        = Math.floor(def.base_intel        * multiplier)
  return costs
}

function getUpgradeDurationFromDB(def: BuildingDefinitionDB, currentLevel: number): number {
  return Math.floor(def.base_duration * Math.pow(1.4, currentLevel))
}

function getPendingProduction(def: BuildingDefinitionDB | null, building: Building): number {
  if (!def?.production_type || building.is_upgrading) return 0
  const rate = getProductionFromDB(def, building.level)
  if (rate <= 0) return 0
  const elapsedHours = (Date.now() - new Date(building.last_collected_at).getTime()) / 3600000
  const capacity = rate * def.production_capacity_hours
  return Math.floor(Math.min(elapsedHours * rate, capacity))
}

function formatDuration(secs: number): string {
  if (secs >= 3600) return `${Math.floor(secs / 3600)}sa ${Math.floor((secs % 3600) / 60)}dk`
  return `${Math.floor(secs / 60)}dk ${secs % 60}sn`
}

export function BuildingCard({ building, hqLevel, dbDef }: {
  building: Building
  hqLevel: number
  dbDef?: BuildingDefinitionDB
}) {
  const isGuest = useGuestStore(s => s.isGuest)
  const guestFinish = useGuestStore(s => s.finishUpgrade)
  const guestUpgrade = useGuestStore(s => s.upgradeBuilding)
  const guestSpend = useGuestStore(s => s.spendResources)
  const guestPlayer = useGuestStore(s => s.player)
  const { upgradeBuilding, finishUpgrade, speedupUpgrade, collectProduction, player: authPlayer } = useGameStore()
  const player = isGuest ? guestPlayer : authPlayer

  const { remaining, isActive, formatted } = useTimer(building.upgrade_ends_at)
  const [showDetail, setShowDetail] = useState(false)
  const [collecting, setCollecting] = useState(false)
  const [upgrading, setUpgrading] = useState(false)
  const autoFinishedRef = useRef(false)
  const finishRef = useRef<() => Promise<void>>(async () => {})

  const localDef = BUILDING_DEFINITIONS.find(d => d.type === building.building_type)
  const defName = dbDef?.name ?? localDef?.name ?? building.building_type
  const defDesc = dbDef?.description ?? localDef?.description ?? ''
  const defIcon = dbDef?.icon ?? localDef?.icon ?? 'Castle'
  const defMaxLevel = dbDef?.max_level ?? localDef?.maxLevel ?? 30
  const defProdType = dbDef?.production_type ?? localDef?.productionType ?? null
  const Icon = iconMap[defIcon] || Castle
  const theme = getTheme(building.building_type)

  const production = dbDef
    ? getProductionFromDB(dbDef, building.level)
    : getProductionPerHour(localDef!, building.level)

  const upgradeCost = dbDef
    ? getUpgradeCostFromDB(dbDef, building.level)
    : (localDef ? getBuildingUpgradeCost(localDef, building.level) : {})

  const upgradeDuration = dbDef
    ? getUpgradeDurationFromDB(dbDef, building.level)
    : (localDef ? getBuildingUpgradeDuration(localDef, building.level) : 60)

  const pendingAmount = useMemo(() => getPendingProduction(dbDef ?? null, building), [dbDef, building])
  const isAtCapacity = dbDef && defProdType
    ? pendingAmount >= getProductionFromDB(dbDef, building.level) * dbDef.production_capacity_hours
    : false

  const canAfford = player && Object.entries(upgradeCost).every(
    ([res, amount]) => amount === 0 || (player[res as keyof typeof player] as number) >= amount
  )

  const hqRequirement = dbDef?.required_hq_level ?? 0
  const blockedByHq = building.building_type !== 'headquarters' && (
    hqLevel < hqRequirement || building.level >= hqLevel
  )
  const hqGateMsg = hqLevel < hqRequirement
    ? `Karargah Lv.${hqRequirement} gerekli`
    : `Bu bina Karargah (Lv.${hqLevel}) seviyesini geçemez`

  const diamondCost = Math.max(1, Math.ceil(remaining / 60))

  const totalSecs = building.upgrade_started_at && building.upgrade_ends_at
    ? (new Date(building.upgrade_ends_at).getTime() - new Date(building.upgrade_started_at).getTime()) / 1000
    : 1
  const upgradeProgress = building.is_upgrading && isActive
    ? Math.max(0, 100 - (remaining / totalSecs) * 100)
    : 100

  async function handleUpgrade() {
    setUpgrading(true)
    if (isGuest) {
      const ok = guestUpgrade(building.id, building.building_type)
      if (ok) toast.success(`${defName} yükseltiliyor!`)
      else toast.error('Yeterli kaynak yok')
    } else {
      await upgradeBuilding(building.id, building.building_type, building.level)
    }
    setUpgrading(false)
    setShowDetail(false)
  }

  async function handleFinish() {
    if (isGuest) {
      guestFinish(building.id)
      toast.success(`${defName} hazır! +${(building.level + 1) * 50} XP`)
    } else {
      await finishUpgrade(building.id)
    }
  }

  // Keep ref up to date so the auto-complete effect can call it
  finishRef.current = handleFinish

  // Auto-complete upgrade when timer expires (idle-game feel)
  useEffect(() => {
    if (building.is_upgrading && !isActive && remaining <= 0 && !autoFinishedRef.current) {
      autoFinishedRef.current = true
      finishRef.current()
    }
    if (isActive) autoFinishedRef.current = false
  }, [isActive, remaining, building.is_upgrading])

  async function handleSpeedUp() {
    if (isGuest) {
      if (guestSpend({ diamonds: diamondCost })) {
        guestFinish(building.id)
        toast.success(`Hızlandırıldı! ${diamondCost} elmas harcandı.`)
      } else {
        toast.error('Yeterli elmas yok')
      }
    } else {
      await speedupUpgrade(building.id, diamondCost)
    }
    setShowDetail(false)
  }

  async function handleCollect() {
    if (isGuest) {
      if (defProdType && production > 0) {
        toast.success(`+${pendingAmount} ${RESOURCE_INFO[defProdType as keyof typeof RESOURCE_INFO]?.name} toplandı!`)
      }
      return
    }
    setCollecting(true)
    await collectProduction(building.id)
    setCollecting(false)
  }

  const hasPending = pendingAmount > 0
  const isHQ = building.building_type === 'headquarters'

  return (
    <Dialog open={showDetail} onOpenChange={setShowDetail}>
      <DialogTrigger asChild>
        <Card className={`bg-gradient-to-br ${theme.gradient} border-border/40 ${theme.glow} transition-all cursor-pointer group relative overflow-hidden active:scale-95 ${isAtCapacity ? 'pulse-gold border-gold/40' : ''} ${isHQ ? 'col-span-2 sm:col-span-1' : ''}`}>
          {/* Top progress bar for upgrade */}
          {building.is_upgrading && (
            <div className="absolute inset-x-0 top-0 h-1">
              <div
                className="h-full rounded-none transition-all duration-1000"
                style={{ width: `${upgradeProgress}%`, background: 'linear-gradient(90deg, oklch(0.78 0.15 75), oklch(0.65 0.18 50))' }}
              />
            </div>
          )}
          {isAtCapacity && (
            <div className="absolute inset-x-0 top-0 h-0.5 shimmer" />
          )}

          <CardContent className="p-3 space-y-2">
            <div className="flex items-start justify-between gap-1">
              <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 transition-all group-hover:scale-110 ${isHQ ? 'bg-gradient-to-br from-amber-600/40 to-amber-900/40 border border-gold/30' : 'bg-secondary/60'}`}>
                <Icon className={`h-4 w-4 ${theme.accent}`} />
              </div>
              <Badge variant="outline" className={`text-[9px] border-border/40 px-1 py-0 h-4 ${theme.accent}`}>
                {building.level}/{defMaxLevel}
              </Badge>
            </div>

            <div>
              <p className="text-[11px] font-bold truncate leading-tight">{defName}</p>
              {production > 0 && defProdType && !building.is_upgrading && (
                <p className={`text-[9px] mt-0.5 ${RESOURCE_INFO[defProdType as keyof typeof RESOURCE_INFO]?.color || 'text-neon'}`}>
                  +{production >= 1000 ? `${(production/1000).toFixed(1)}K` : production}/sa
                </p>
              )}
            </div>

            {/* Upgrade in progress */}
            {building.is_upgrading && isActive && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[9px]">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="h-2.5 w-2.5" /> Lv.{building.level + 1}
                  </span>
                  <span className="text-gold font-mono font-bold">{formatted}</span>
                </div>
              </div>
            )}

            {/* Ready to collect upgrade */}
            {building.is_upgrading && !isActive && remaining <= 0 && (
              <Button
                size="sm"
                className="w-full h-7 text-[10px] gradient-gold text-primary-foreground font-bold"
                onClick={(e) => { e.stopPropagation(); handleFinish() }}
              >
                <Zap className="h-3 w-3 mr-1" /> Hazır! Topla
              </Button>
            )}

            {/* Production collect */}
            {!building.is_upgrading && hasPending && (
              <Button
                size="sm"
                className={`w-full h-7 text-[10px] font-bold ${isAtCapacity ? 'gradient-gold text-primary-foreground' : 'bg-secondary/80 border border-border/40 text-foreground hover:bg-secondary'}`}
                onClick={(e) => { e.stopPropagation(); handleCollect() }}
                disabled={collecting}
              >
                <Package className="h-3 w-3 mr-1" />
                {isAtCapacity ? 'DOLU — Topla!' : `+${pendingAmount >= 1000 ? `${(pendingAmount / 1000).toFixed(1)}K` : pendingAmount}`}
              </Button>
            )}
          </CardContent>
        </Card>
      </DialogTrigger>

      {/* Detail Dialog */}
      <DialogContent className="bg-card border-border/50 max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${isHQ ? 'bg-gradient-to-br from-amber-600/40 to-amber-900/40' : 'bg-secondary/60'}`}>
              <Icon className={`h-4 w-4 ${theme.accent}`} />
            </div>
            <div>
              <span className="text-base">{defName}</span>
              <span className="text-muted-foreground text-sm ml-2">Lv.{building.level}</span>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">{defDesc}</p>

          {/* Production info */}
          {production > 0 && defProdType && (
            <div className="bg-secondary/40 rounded-xl p-3 space-y-1.5 border border-border/30">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Üretim</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Saatlik</span>
                <span className={`text-sm font-bold ${RESOURCE_INFO[defProdType as keyof typeof RESOURCE_INFO]?.color || 'text-neon'}`}>
                  +{production.toLocaleString()} {RESOURCE_INFO[defProdType as keyof typeof RESOURCE_INFO]?.name}
                </span>
              </div>
              {dbDef && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Kapasite</span>
                  <span className="text-xs text-muted-foreground">
                    {Math.floor(production * dbDef.production_capacity_hours).toLocaleString()} ({dbDef.production_capacity_hours}sa)
                  </span>
                </div>
              )}
              {hasPending && (
                <div className="flex items-center justify-between pt-1 border-t border-border/20">
                  <span className="text-xs text-muted-foreground">Bekleyen</span>
                  <span className={`text-sm font-bold ${isAtCapacity ? 'text-gold' : 'text-neon'}`}>
                    {pendingAmount.toLocaleString()} {isAtCapacity && '⚠ DOLU'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Collect button */}
          {hasPending && !building.is_upgrading && (
            <Button
              className={`w-full font-bold ${isAtCapacity ? 'gradient-gold text-primary-foreground' : ''}`}
              variant={isAtCapacity ? 'default' : 'outline'}
              onClick={handleCollect}
              disabled={collecting}
            >
              <Package className="h-4 w-4 mr-2" />
              Topla — +{pendingAmount.toLocaleString()} {defProdType ? RESOURCE_INFO[defProdType as keyof typeof RESOURCE_INFO]?.name : ''}
            </Button>
          )}

          {/* Upgrade in progress */}
          {building.is_upgrading && isActive ? (
            <div className="space-y-3">
              <div className="bg-secondary/40 rounded-xl p-3 space-y-2 border border-border/30">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Seviye {building.level} → {building.level + 1}</span>
                  <span className="text-gold font-mono font-bold text-sm">{formatted}</span>
                </div>
                <div className="h-2 bg-secondary/60 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${upgradeProgress}%`, background: 'linear-gradient(90deg, oklch(0.78 0.15 75), oklch(0.65 0.18 50))' }}
                  />
                </div>
              </div>
              <Button className="w-full gradient-gold text-primary-foreground font-bold" onClick={handleSpeedUp}>
                <Gem className="h-4 w-4 mr-2" />
                Hızlandır — {diamondCost} 💎 Elmas
              </Button>
            </div>
          ) : building.is_upgrading && !isActive ? (
            <Button className="w-full gradient-gold text-primary-foreground font-bold" onClick={handleFinish}>
              <Zap className="h-4 w-4 mr-2" /> Yükseltmeyi Topla!
            </Button>
          ) : building.level < defMaxLevel ? (
            <div className="space-y-3">
              <div className="bg-secondary/40 rounded-xl p-3 space-y-2 border border-border/30">
                <div className="flex items-center gap-1 mb-1">
                  <ArrowUp className="h-3.5 w-3.5 text-gold" />
                  <p className="text-xs font-bold">Seviye {building.level + 1} Maliyeti</p>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  {Object.entries(upgradeCost).filter(([, v]) => v > 0).map(([res, amount]) => {
                    const hasEnough = player && (player[res as keyof typeof player] as number) >= amount
                    return (
                      <div key={res} className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">{RESOURCE_INFO[res as keyof typeof RESOURCE_INFO]?.name || res}</span>
                        <span className={`font-bold tabular-nums ${hasEnough ? 'text-neon' : 'text-destructive'}`}>
                          {amount.toLocaleString()}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/30">
                  <span className="text-muted-foreground">Süre</span>
                  <span className="flex items-center gap-1 font-mono text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatDuration(upgradeDuration)}
                  </span>
                </div>
              </div>
              {blockedByHq ? (
                <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-2.5 text-center">
                  <p className="text-[11px] text-destructive font-medium">{hqGateMsg}</p>
                </div>
              ) : (
                <Button
                  className="w-full gradient-gold text-primary-foreground font-bold"
                  disabled={!canAfford || upgrading}
                  onClick={handleUpgrade}
                >
                  {upgrading ? (
                    <span className="flex items-center gap-2">Yükseltiliyor...</span>
                  ) : !canAfford ? (
                    <span className="flex items-center gap-2">
                      <Zap className="h-4 w-4" /> Yetersiz Kaynak
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Zap className="h-4 w-4" /> Lv.{building.level + 1}'e Yükselt
                    </span>
                  )}
                </Button>
              )}
            </div>
          ) : (
            <div className="bg-gold/10 border border-gold/20 rounded-xl p-3 text-center">
              <p className="text-sm font-bold text-gold">⭐ Maksimum Seviye!</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
