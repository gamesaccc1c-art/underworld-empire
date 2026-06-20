import { useEffect, useState, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Microscope, Zap, Shield, Banknote, Crosshair, Users, Lock, CircleCheck as CheckCircle, Clock } from 'lucide-react'
import { useGuestStore } from '@/stores/guestStore'
import { useGameStore } from '@/stores/gameStore'
import { useTimer, formatTime } from '@/hooks/useTimer'
import type { ResearchDefinition, UserResearch } from '@/types/game'

const CATEGORIES = [
  { id: 'economy',      label: 'Ekonomi',    icon: Banknote,    color: 'text-green-400' },
  { id: 'combat',       label: 'Savaş',      icon: Crosshair,   color: 'text-red-400' },
  { id: 'defense',      label: 'Savunma',    icon: Shield,      color: 'text-blue-400' },
  { id: 'intelligence', label: 'İstihbarat', icon: Microscope,  color: 'text-purple-400' },
  { id: 'family',       label: 'Aile',       icon: Users,       color: 'text-gold' },
]

// ─── Guest localStorage fallback ─────────────────────────────────────────────

const RESEARCH_KEY = 'uw-research'

interface GuestResearchState {
  levels: Record<string, number>
  active: { id: string; endsAt: string } | null
}

function loadGuestResearch(): GuestResearchState {
  try {
    return {
      levels: JSON.parse(localStorage.getItem(RESEARCH_KEY) || '{}'),
      active: JSON.parse(localStorage.getItem(RESEARCH_KEY + '-active') || 'null'),
    }
  } catch { return { levels: {}, active: null } }
}

function useGuestResearch() {
  const [state, setState] = useState<GuestResearchState>(loadGuestResearch)

  function start(defId: string, durationSec: number) {
    const endsAt = new Date(Date.now() + durationSec * 1000).toISOString()
    const active = { id: defId, endsAt }
    localStorage.setItem(RESEARCH_KEY + '-active', JSON.stringify(active))
    setState(s => ({ ...s, active }))
  }

  function complete(defId: string) {
    const levels = { ...state.levels, [defId]: (state.levels[defId] || 0) + 1 }
    localStorage.setItem(RESEARCH_KEY, JSON.stringify(levels))
    localStorage.removeItem(RESEARCH_KEY + '-active')
    setState({ levels, active: null })
  }

  return { levels: state.levels, active: state.active, start, complete }
}

// ─── Local fallback definitions (guest mode) ──────────────────────────────────

const LOCAL_DEFS: Array<{
  id: string; key: string; name: string; description: string; category: string
  max_level: number; base_cost: Record<string, number>; base_duration: number
  effect_type: 'percent' | 'flat'; effect_value: number; requires?: string
}> = [
  { id: 'cash_flow',         key: 'cash_flow',            name: 'Nakit Akışı',               description: 'Nakit üretimini artırır.',          category: 'economy',      max_level: 10, base_cost: { cash: 2000, intel: 100 }, base_duration: 120, effect_type: 'percent', effect_value: 5 },
  { id: 'black_market_ops',  key: 'black_money_production',name: 'Kara Borsa Ops',            description: 'Kara para üretimini artırır.',      category: 'economy',      max_level: 10, base_cost: { cash: 3000, intel: 200 }, base_duration: 180, effect_type: 'percent', effect_value: 8, requires: 'cash_flow' },
  { id: 'tax_evasion',       key: 'loot_bonus',            name: 'Vergi Kaçakçılığı',         description: 'Yağma miktarını artırır.',           category: 'economy',      max_level: 5,  base_cost: { cash: 5000, intel: 500 }, base_duration: 300, effect_type: 'percent', effect_value: 10, requires: 'black_market_ops' },
  { id: 'street_tactics',    key: 'attack',                name: 'Sokak Taktikleri',          description: 'Saldırı gücünü artırır.',            category: 'combat',       max_level: 10, base_cost: { cash: 2500, intel: 150 }, base_duration: 150, effect_type: 'percent', effect_value: 5 },
  { id: 'ambush_mastery',    key: 'raid_damage',           name: 'Pusu Ustası',               description: 'Baskın hasarını artırır.',           category: 'combat',       max_level: 8,  base_cost: { cash: 4000, intel: 300 }, base_duration: 240, effect_type: 'percent', effect_value: 8, requires: 'street_tactics' },
  { id: 'heavy_firepower',   key: 'heavy_attack',          name: 'Ağır Ateşli Silahlar',      description: 'Ağır birlik saldırısını artırır.',  category: 'combat',       max_level: 5,  base_cost: { cash: 8000, intel: 600 }, base_duration: 420, effect_type: 'percent', effect_value: 15, requires: 'ambush_mastery' },
  { id: 'fortification',     key: 'defense',               name: 'Tahkimat',                  description: 'Savunmayı artırır.',                 category: 'defense',      max_level: 10, base_cost: { cash: 2000, intel: 100 }, base_duration: 120, effect_type: 'percent', effect_value: 5 },
  { id: 'counter_intel',     key: 'spy_resist',            name: 'Karşı İstihbarat',          description: 'Casusluk direncini artırır.',       category: 'defense',      max_level: 8,  base_cost: { cash: 3500, intel: 400 }, base_duration: 200, effect_type: 'percent', effect_value: 10, requires: 'fortification' },
  { id: 'spy_network',       key: 'intel_production',      name: 'Casus Ağı',                 description: 'İstihbarat üretimini artırır.',     category: 'intelligence', max_level: 10, base_cost: { cash: 1500, intel: 200 }, base_duration: 100, effect_type: 'percent', effect_value: 8 },
  { id: 'inside_info',       key: 'crime_success',         name: 'İç Bilgi',                  description: 'Karanlık iş başarısını artırır.',   category: 'intelligence', max_level: 8,  base_cost: { cash: 3000, intel: 350 }, base_duration: 180, effect_type: 'percent', effect_value: 10, requires: 'spy_network' },
  { id: 'loyalty_program',   key: 'loyalty_production',    name: 'Sadakat Programı',          description: 'Sadakat üretimini artırır.',         category: 'family',       max_level: 10, base_cost: { cash: 2000, intel: 50 },  base_duration: 90,  effect_type: 'percent', effect_value: 6 },
  { id: 'recruitment_drive', key: 'training_speed',        name: 'Adam Toplama Kampanyası',   description: 'Eğitim hızını artırır.',             category: 'family',       max_level: 5,  base_cost: { cash: 4000, intel: 200 }, base_duration: 240, effect_type: 'percent', effect_value: 15, requires: 'loyalty_program' },
]

// ─── ResearchCard ──────────────────────────────────────────────────────────────

function ResearchCard({
  def, currentLevel, isUnlocked, activeEndsAt, isActive: isActiveNode,
  onStart, onComplete, player,
}: {
  def: typeof LOCAL_DEFS[0] | ResearchDefinition
  currentLevel: number
  isUnlocked: boolean
  activeEndsAt?: string
  isActive: boolean
  onStart: () => void
  onComplete: () => void
  player: { cash: number; intel: number } | null
}) {
  const [open, setOpen] = useState(false)
  const { remaining, isActive: timerActive, formatted } = useTimer(activeEndsAt)
  const autoCompletedRef = useRef(false)
  const completeRef = useRef(onComplete)
  completeRef.current = onComplete

  // Auto-complete when timer expires
  useEffect(() => {
    if (isActiveNode && !timerActive && remaining <= 0 && !autoCompletedRef.current) {
      autoCompletedRef.current = true
      completeRef.current()
    }
    if (timerActive) autoCompletedRef.current = false
  }, [isActiveNode, timerActive, remaining])
  const isMaxed = currentLevel >= def.max_level
  const cashCost  = (def.base_cost?.cash  ?? 0) * (currentLevel + 1)
  const intelCost = (def.base_cost?.intel ?? 0) * (currentLevel + 1)
  const duration  = def.base_duration * (currentLevel + 1)
  const canAfford = player && player.cash >= cashCost && player.intel >= intelCost
  const totalDur  = isActiveNode && activeEndsAt && !timerActive ? 1 : duration
  const prog = isActiveNode && timerActive ? Math.max(0, 100 - (remaining / totalDur) * 100) : isActiveNode && !timerActive ? 100 : 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Card className={`border-border/40 cursor-pointer transition-all group ${!isUnlocked ? 'opacity-40' : 'bg-card/70 hover:border-purple-500/30'} ${isMaxed ? 'border-gold/20 bg-amber-950/10' : ''}`}>
          <CardContent className="p-3 space-y-2">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">{def.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {def.key}: +{Number(def.effect_value) * (currentLevel || 1)}%
                </p>
              </div>
              {!isUnlocked ? <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                : isMaxed ? <CheckCircle className="h-4 w-4 text-gold shrink-0" />
                : currentLevel > 0 ? <Badge variant="outline" className="text-[9px] border-purple-500/30 text-purple-400 shrink-0">Lv.{currentLevel}</Badge>
                : null}
            </div>
            {isActiveNode && timerActive && (
              <div className="space-y-0.5">
                <Progress value={prog} className="h-1" />
                <p className="text-[10px] text-gold font-mono">{formatted}</p>
              </div>
            )}
            {isActiveNode && !timerActive && remaining <= 0 && (
              <Button size="sm" className="w-full h-6 text-[10px] gradient-gold text-primary-foreground" onClick={e => { e.stopPropagation(); onComplete() }}>
                Tamamla!
              </Button>
            )}
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="bg-card border-border/50 max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Microscope className="h-5 w-5 text-purple-400" /> {def.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{def.description}</p>
          <div className="bg-secondary/50 rounded-lg p-2.5 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Mevcut Bonus</span>
              <span className="text-neon">+{Number(def.effect_value) * currentLevel}%</span>
            </div>
            {!isMaxed && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Sonraki Bonus</span>
                <span className="text-gold">+{Number(def.effect_value) * (currentLevel + 1)}%</span>
              </div>
            )}
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Nakit</span>
              <span className={player && player.cash >= cashCost ? 'text-neon' : 'text-destructive'}>{cashCost.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">İstihbarat</span>
              <span className={player && player.intel >= intelCost ? 'text-neon' : 'text-destructive'}>{intelCost.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Süre</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
          {!isUnlocked ? (
            <p className="text-xs text-destructive text-center">Önkoşul tamamlanmamış</p>
          ) : isMaxed ? (
            <Badge className="w-full justify-center gradient-gold text-primary-foreground">Maksimum Seviye!</Badge>
          ) : isActiveNode && timerActive ? (
            <div className="space-y-1.5">
              <Progress value={prog} />
              <p className="text-center text-xs text-gold font-mono">{formatted} kaldı</p>
            </div>
          ) : isActiveNode && !timerActive && remaining <= 0 ? (
            <Button className="w-full gradient-gold text-primary-foreground font-bold" onClick={() => { onComplete(); setOpen(false) }}>
              Araştırmayı Tamamla!
            </Button>
          ) : (
            <Button
              className="w-full text-white font-bold"
              style={{ background: 'linear-gradient(135deg, oklch(0.60 0.18 280), oklch(0.45 0.22 290))' }}
              disabled={!canAfford}
              onClick={() => { onStart(); setOpen(false) }}
            >
              <Zap className="h-4 w-4 mr-1" /> Araştırmayı Başlat
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ActiveResearchBanner({
  def, endsAt, onComplete,
}: { def: typeof LOCAL_DEFS[0] | ResearchDefinition | undefined; endsAt: string; onComplete: () => void }) {
  const { isActive, formatted } = useTimer(endsAt)
  return (
    <Card className="border-purple-500/20 bg-purple-950/20">
      <CardContent className="p-3">
        <p className="text-xs font-semibold text-purple-300 mb-1.5 flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" /> Aktif Araştırma
        </p>
        <p className="text-sm font-bold">{def?.name ?? '...'}</p>
        {isActive
          ? <p className="text-xs text-gold font-mono mt-1">{formatted} kaldı</p>
          : <Button size="sm" className="mt-1 gradient-gold text-primary-foreground text-xs" onClick={onComplete}>Tamamla!</Button>
        }
      </CardContent>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ResearchPage() {
  const isGuest = useGuestStore(s => s.isGuest)
  const guestPlayer = useGuestStore(s => s.player)
  const guestSpend  = useGuestStore(s => s.spendResources)
  const { levels: guestLevels, active: guestActive, start: guestStart, complete: guestComplete } = useGuestResearch()

  const authPlayer = useGameStore(s => s.player)
  const authUserResearch = useGameStore(s => s.userResearch)
  const authDefs = useGameStore(s => s.researchDefinitions)
  const { startResearchAction, completeResearchAction, loadResearch } = useGameStore()

  const player = isGuest ? guestPlayer : authPlayer

  useEffect(() => {
    if (!isGuest) loadResearch()
  }, [isGuest, loadResearch])

  // Normalise to a unified shape for rendering
  const defs = isGuest ? LOCAL_DEFS : (authDefs.length > 0 ? authDefs.map(d => ({
    ...d,
    requires: undefined as string | undefined,
  })) : LOCAL_DEFS)

  function getLevelForDef(def: typeof LOCAL_DEFS[0] | ResearchDefinition): number {
    if (isGuest) return guestLevels[(def as typeof LOCAL_DEFS[0]).id] || 0
    const ur = authUserResearch.find(r => r.research_id === def.id)
    return ur?.level ?? 0
  }

  function getActiveUr(): UserResearch | null {
    if (isGuest) return null
    return authUserResearch.find(r => r.is_researching) ?? null
  }

  const activeUr = getActiveUr()
  const activeDef = activeUr ? authDefs.find(d => d.id === activeUr.research_id) : undefined
  const guestActiveDef = guestActive ? LOCAL_DEFS.find(d => d.id === guestActive.id) : undefined

  function isUnlocked(def: typeof LOCAL_DEFS[0] | ResearchDefinition): boolean {
    const localDef = def as typeof LOCAL_DEFS[0]
    if (!localDef.requires) return true
    if (isGuest) return (guestLevels[localDef.requires] || 0) > 0
    // For DB defs requires is not stored in DB — all unlocked by default (tree enforced visually)
    return true
  }

  function handleStart(def: typeof LOCAL_DEFS[0] | ResearchDefinition) {
    const currentLevel = getLevelForDef(def)
    const cashCost  = (def.base_cost?.cash  ?? 0) * (currentLevel + 1)
    const intelCost = (def.base_cost?.intel ?? 0) * (currentLevel + 1)
    if (isGuest) {
      if (guestSpend({ cash: cashCost, intel: intelCost })) {
        guestStart((def as typeof LOCAL_DEFS[0]).id, def.base_duration * (currentLevel + 1))
      }
    } else {
      startResearchAction(def.id)
    }
  }

  function handleComplete(def: typeof LOCAL_DEFS[0] | ResearchDefinition) {
    if (isGuest) {
      guestComplete((def as typeof LOCAL_DEFS[0]).id)
    } else {
      completeResearchAction(def.id)
    }
  }

  const hasActiveResearch = isGuest ? !!guestActive : !!activeUr

  return (
    <div className="p-3 space-y-4 pb-6">
      <div className="text-center">
        <h1 className="font-display text-xl font-black tracking-wider text-purple-400">ARAŞTIRMA</h1>
        <p className="text-xs text-muted-foreground">İmparatorluğunu geliştir</p>
      </div>

      {isGuest && guestActive && guestActiveDef && (
        <ActiveResearchBanner
          def={guestActiveDef}
          endsAt={guestActive.endsAt}
          onComplete={() => handleComplete(guestActiveDef)}
        />
      )}
      {!isGuest && activeUr && (
        <ActiveResearchBanner
          def={activeDef}
          endsAt={activeUr.ends_at!}
          onComplete={() => activeDef && handleComplete(activeDef)}
        />
      )}

      <Tabs defaultValue="economy">
        <TabsList className="grid grid-cols-5 w-full h-8">
          {CATEGORIES.map(c => (
            <TabsTrigger key={c.id} value={c.id} className="text-[10px] p-0">
              <c.icon className={`h-3.5 w-3.5 ${c.color}`} />
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="flex justify-center gap-3 mt-1 mb-3">
          {CATEGORIES.map(c => (
            <span key={c.id} className={`text-[10px] ${c.color}`}>{c.label}</span>
          ))}
        </div>

        {CATEGORIES.map(cat => {
          const catDefs = defs.filter(d => d.category === cat.id)
          return (
            <TabsContent key={cat.id} value={cat.id} className="space-y-2 mt-0">
              {catDefs.map(def => {
                const currentLevel = getLevelForDef(def)
                const unlocked = isUnlocked(def)
                const localDef = def as typeof LOCAL_DEFS[0]
                const isActiveNode = isGuest
                  ? guestActive?.id === localDef.id
                  : activeUr?.research_id === def.id
                const activeEndsAt = isActiveNode
                  ? (isGuest ? guestActive?.endsAt : activeUr?.ends_at ?? undefined)
                  : undefined
                return (
                  <ResearchCard
                    key={def.id}
                    def={def}
                    currentLevel={currentLevel}
                    isUnlocked={unlocked}
                    isActive={isActiveNode}
                    activeEndsAt={activeEndsAt}
                    onStart={() => handleStart(def)}
                    onComplete={() => handleComplete(def)}
                    player={player}
                  />
                )
              })}
              {hasActiveResearch && (
                <p className="text-[10px] text-muted-foreground text-center py-2">
                  Aynı anda sadece 1 araştırma aktif olabilir
                </p>
              )}
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}
