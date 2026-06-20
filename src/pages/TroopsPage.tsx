import { useEffect, useState, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Sword, Shield, Zap, Users, Car, Clock, Plus, Minus, Heart, Wind, Briefcase, TriangleAlert as AlertTriangle } from 'lucide-react'
import { useGuestStore } from '@/stores/guestStore'
import { useGameStore } from '@/stores/gameStore'
import { useTimer, formatTime } from '@/hooks/useTimer'
import { computeResearchEffects, applyTrainingSpeed } from '@/lib/game/effects'
import { RESOURCE_INFO, VIP_REWARDS } from '@/lib/game/constants'

const TROOP_DEFS = [
  {
    id: 'street_thugs', name: 'Sokak Adamları', icon: Users,
    attack: 10, defense: 5,  health: 100, speed: 8,  capacity: 2,
    cost: { cash: 200, loyalty: 10 }, baseDuration: 30,
    description: 'Ucuz ve hızlı. Kalabalık kuvvet için ideal. Şehir içi çatışmalarda etkili.',
  },
  {
    id: 'hitmen', name: 'Tetikçiler', icon: Sword,
    attack: 35, defense: 10, health: 80,  speed: 10, capacity: 1,
    cost: { cash: 800, black_money: 50 }, baseDuration: 90,
    description: 'Yüksek saldırı gücü. Hassas operasyonlar ve suikastlar için.',
  },
  {
    id: 'bodyguards', name: 'Koruma Ekibi', icon: Shield,
    attack: 10, defense: 40, health: 200, speed: 5,  capacity: 3,
    cost: { cash: 600, loyalty: 30 }, baseDuration: 80,
    description: 'Savunma uzmanı. Lider ve binaları korur. Sağlığı yüksektir.',
  },
  {
    id: 'bikers', name: 'Motorcular', icon: Zap,
    attack: 25, defense: 15, health: 90,  speed: 15, capacity: 2,
    cost: { cash: 1000, weapon_power: 100 }, baseDuration: 120,
    description: 'Hızlı ve agresif. Ani baskınlarda ve takiplerde güçlü.',
  },
  {
    id: 'vehicle_crew', name: 'Araçlı Ekip', icon: Car,
    attack: 40, defense: 30, health: 180, speed: 12, capacity: 5,
    cost: { cash: 2000, black_money: 200 }, baseDuration: 180,
    description: 'Araç destek kuvveti. Yüksek taşıma kapasitesi, dengeli savaş gücü.',
  },
  {
    id: 'heavy_crew', name: 'Ağır Ekip', icon: Sword,
    attack: 60, defense: 50, health: 300, speed: 4,  capacity: 8,
    cost: { cash: 5000, weapon_power: 500, black_money: 300 }, baseDuration: 300,
    description: 'En güçlü birlik tipi. Yavaş ama yüksek kayıp kapasitesi ile büyük operasyonlar için.',
  },
] as const

type TroopId = typeof TROOP_DEFS[number]['id']

// ─── VIP speed bonus helper ───────────────────────────────────────────────────
function getVipTrainingSpeedBonus(vipLevel: number): number {
  return VIP_REWARDS
    .filter(r => r.vip_level <= vipLevel && r.bonus_type === 'training_speed')
    .reduce((acc, r) => acc + r.bonus_value, 0)
}

// ─── Guest localStorage fallback ─────────────────────────────────────────────
const TROOPS_KEY = 'uw-troops'
const QUEUE_KEY  = 'uw-troops-queue'

function useGuestTroops() {
  const [troops, setTroops] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem(TROOPS_KEY) || '{}') } catch { return {} }
  })
  const [queue, setQueue] = useState<Array<{ id: string; queueId: string; count: number; endsAt: string }>>(() => {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]') } catch { return [] }
  })

  function trainTroops(troopId: string, count: number, durationPerUnit: number) {
    const endsAt = new Date(Date.now() + durationPerUnit * count * 1000).toISOString()
    const item = { id: troopId, queueId: 'g-' + Math.random().toString(36).slice(2), count, endsAt }
    const newQ = [...queue, item]
    localStorage.setItem(QUEUE_KEY, JSON.stringify(newQ))
    setQueue(newQ)
  }

  function completeTroop(queueId: string) {
    const item = queue.find(q => q.queueId === queueId)
    if (!item) return
    const newTroops = { ...troops, [item.id]: (troops[item.id] || 0) + item.count }
    const newQ = queue.filter(q => q.queueId !== queueId)
    localStorage.setItem(TROOPS_KEY, JSON.stringify(newTroops))
    localStorage.setItem(QUEUE_KEY, JSON.stringify(newQ))
    setTroops(newTroops)
    setQueue(newQ)
  }

  return { troops, queue, trainTroops, completeTroop }
}

// ─── Queue item row ───────────────────────────────────────────────────────────
function QueueRow({ troopId, count, endsAt, onClaim }: {
  troopId: string; count: number; endsAt: string; onClaim: () => void
}) {
  const { isActive, formatted } = useTimer(endsAt)
  const def = TROOP_DEFS.find(t => t.id === troopId)
  const Icon = def?.icon || Users
  const autoClaimedRef = useRef(false)
  const claimRef = useRef(onClaim)
  claimRef.current = onClaim

  useEffect(() => {
    if (!isActive && !autoClaimedRef.current) {
      autoClaimedRef.current = true
      claimRef.current()
    }
    if (isActive) autoClaimedRef.current = false
  }, [isActive])

  return (
    <div className="flex items-center justify-between gap-2 py-2 border-b border-border/30 last:border-0">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-orange-400/70" />
        <div>
          <p className="text-xs font-medium">{def?.name ?? troopId}</p>
          <p className="text-[10px] text-muted-foreground">×{count} birlik</p>
        </div>
      </div>
      {isActive
        ? <span className="text-xs text-gold font-mono">{formatted}</span>
        : <Button size="sm" className="h-6 text-[10px] gradient-gold text-primary-foreground" onClick={onClaim}>Topla!</Button>
      }
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function TroopsPage() {
  const isGuest = useGuestStore(s => s.isGuest)
  const guestPlayer = useGuestStore(s => s.player)
  const guestSpend = useGuestStore(s => s.spendResources)
  const { troops: guestTroops, queue: guestQueue, trainTroops: guestTrain, completeTroop: guestComplete } = useGuestTroops()

  const authPlayer = useGameStore(s => s.player)
  const authTroops = useGameStore(s => s.troops)
  const authQueue = useGameStore(s => s.trainingQueue)
  const userResearch = useGameStore(s => s.userResearch)
  const researchDefs = useGameStore(s => s.researchDefinitions)
  const { trainTroops: authTrain, claimTroopTraining, loadTroops, loadResearch } = useGameStore()

  const player = isGuest ? guestPlayer : authPlayer

  useEffect(() => {
    if (!isGuest) {
      loadTroops()
      loadResearch()
    }
  }, [isGuest, loadTroops, loadResearch])

  // Combined speed bonus: research + VIP
  const researchEffects = isGuest ? null : computeResearchEffects(userResearch, researchDefs)
  const researchSpeedBonus = researchEffects?.trainingSpeedBonus ?? 0
  const vipSpeedBonus = getVipTrainingSpeedBonus(player?.vip_level ?? 0)
  const totalSpeedBonus = researchSpeedBonus + vipSpeedBonus

  const [selectedId, setSelectedId] = useState<TroopId | null>(null)
  const [count, setCount] = useState(1)

  const selectedDef = TROOP_DEFS.find(t => t.id === selectedId) ?? null

  function getEffectiveDuration(def: typeof TROOP_DEFS[number]) {
    return applyTrainingSpeed(def.baseDuration, totalSpeedBonus)
  }

  async function handleTrain() {
    if (!selectedDef) return
    const cost = Object.fromEntries(
      Object.entries(selectedDef.cost).map(([k, v]) => [k, (v as number) * count])
    )
    if (isGuest) {
      if (!guestSpend(cost as Parameters<typeof guestSpend>[0])) return
      guestTrain(selectedDef.id, count, getEffectiveDuration(selectedDef))
    } else {
      await authTrain(selectedDef.id, count)
    }
    setSelectedId(null)
    setCount(1)
  }

  // Unified troop counts + wounded from DB
  const troopData: Record<string, { amount: number; wounded: number }> = isGuest
    ? Object.fromEntries(Object.entries(guestTroops).map(([k, v]) => [k, { amount: v, wounded: 0 }]))
    : Object.fromEntries(authTroops.map(t => [t.troop_type, { amount: t.amount, wounded: t.wounded_amount }]))

  const totalUnits   = Object.values(troopData).reduce((a, b) => a + b.amount, 0)
  const totalWounded = Object.values(troopData).reduce((a, b) => a + b.wounded, 0)
  const totalPower   = TROOP_DEFS.reduce((acc, t) => acc + (troopData[t.id]?.amount ?? 0) * (t.attack + t.defense), 0)
  const queueCount   = isGuest ? guestQueue.length : authQueue.length

  return (
    <div className="p-3 space-y-4 pb-6">
      <div className="text-center">
        <h1 className="font-display text-xl font-black tracking-wider text-orange-400">BİRLİKLER</h1>
        <p className="text-xs text-muted-foreground">Ordunu güçlendir</p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: Users,  value: totalUnits,   label: 'Toplam Adam',  color: 'text-orange-400' },
          { icon: Sword,  value: totalPower,   label: 'Ordu Gücü',    color: 'text-red-400' },
          { icon: Clock,  value: queueCount,   label: 'Eğitimde',     color: 'text-yellow-400' },
        ].map(({ icon: Icon, value, label, color }) => (
          <div key={label} className="bg-card/70 border border-border/40 rounded-xl p-3 text-center">
            <Icon className={`h-4 w-4 ${color} mx-auto mb-1`} />
            <p className={`text-xl font-black ${color} font-display`}>{value.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Wounded healing section */}
      {totalWounded > 0 && (
        <Card className="border-red-900/30 bg-red-950/10">
          <CardContent className="p-3 space-y-2">
            <p className="text-xs font-semibold flex items-center gap-1 text-red-300">
              <AlertTriangle className="h-3.5 w-3.5" /> Yaralı Birlikler ({totalWounded})
            </p>
            {TROOP_DEFS.filter(t => (troopData[t.id]?.wounded ?? 0) > 0).map(troop => {
              const wounded = troopData[troop.id]?.wounded ?? 0
              const HEAL_COSTS: Record<string, number> = { street_thugs: 100, hitmen: 400, bodyguards: 300, bikers: 500, vehicle_crew: 1000, heavy_crew: 2500 }
              const healCost = Math.round(HEAL_COSTS[troop.id] ?? 100)
              const Icon = troop.icon
              return (
                <div key={troop.id} className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-red-400/70" />
                    <div>
                      <p className="text-xs font-medium">{troop.name}</p>
                      <p className="text-[10px] text-muted-foreground">{wounded} yaralı · {(healCost * wounded).toLocaleString()} nakit</p>
                    </div>
                  </div>
                  <Button
                    size="sm" className="h-6 text-[10px] bg-red-600 hover:bg-red-700 text-white"
                    disabled={!player || player.cash < healCost * wounded}
                    onClick={async () => {
                      if (!isGuest) {
                        const { healWounded } = useGameStore.getState()
                        await healWounded(troop.id, wounded)
                      }
                    }}
                  >
                    <Heart className="h-3 w-3 mr-0.5" /> İyileştir
                  </Button>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Speed bonuses */}
      {totalSpeedBonus > 0 && (
        <div className="bg-orange-950/20 border border-orange-900/30 rounded-lg px-3 py-2 text-xs text-orange-300 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5" />
          Eğitim hızı: -%{totalSpeedBonus}
          {researchSpeedBonus > 0 && <span className="text-muted-foreground ml-1">(Araştırma -%{researchSpeedBonus}</span>}
          {vipSpeedBonus > 0 && <span className="text-muted-foreground">{researchSpeedBonus > 0 ? ', ' : '('}VIP -%{vipSpeedBonus}</span>}
          {totalSpeedBonus > 0 && <span className="text-muted-foreground">)</span>}
        </div>
      )}

      {/* Training queue */}
      {queueCount > 0 && (
        <Card className="border-orange-900/30 bg-orange-950/10">
          <CardContent className="p-3">
            <p className="text-xs font-semibold mb-2 flex items-center gap-1 text-orange-300">
              <Clock className="h-3.5 w-3.5" /> Eğitim Kuyruğu ({queueCount})
            </p>
            {isGuest
              ? guestQueue.map(item => (
                  <QueueRow key={item.queueId} troopId={item.id} count={item.count} endsAt={item.endsAt} onClaim={() => guestComplete(item.queueId)} />
                ))
              : authQueue.map(item => (
                  <QueueRow key={item.id} troopId={item.troop_type} count={item.amount} endsAt={item.ends_at} onClaim={() => claimTroopTraining(item.id)} />
                ))
            }
          </CardContent>
        </Card>
      )}

      {/* Troop catalog */}
      <div className="space-y-2">
        <h2 className="text-sm font-bold">Birlik Eğit</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {TROOP_DEFS.map(troop => {
            const data = troopData[troop.id] ?? { amount: 0, wounded: 0 }
            const Icon = troop.icon
            const dur = getEffectiveDuration(troop)
            return (
              <Dialog
                key={troop.id}
                open={selectedId === troop.id}
                onOpenChange={open => { if (!open) { setSelectedId(null); setCount(1) } }}
              >
                <DialogTrigger asChild>
                  <Card
                    className="bg-card/70 border-border/40 hover:border-orange-500/25 cursor-pointer transition-all active:scale-95"
                    onClick={() => setSelectedId(troop.id as TroopId)}
                  >
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-5 w-5 text-orange-400" />
                          <div>
                            <p className="text-xs font-semibold">{troop.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {data.amount.toLocaleString()} aktif
                              {data.wounded > 0 && <span className="text-red-400 ml-1">({data.wounded} yaralı)</span>}
                            </p>
                          </div>
                        </div>
                        <div className="text-right space-y-0.5">
                          <p className="text-[10px] text-red-400">Atk {troop.attack}</p>
                          <p className="text-[10px] text-blue-400">Def {troop.defense}</p>
                        </div>
                      </div>
                      {/* Mini stat pills */}
                      <div className="flex gap-1">
                        <span className="text-[9px] bg-secondary/60 rounded px-1.5 py-0.5 flex items-center gap-0.5">
                          <Heart className="h-2.5 w-2.5 text-pink-400" />{troop.health}
                        </span>
                        <span className="text-[9px] bg-secondary/60 rounded px-1.5 py-0.5 flex items-center gap-0.5">
                          <Wind className="h-2.5 w-2.5 text-cyan-400" />{troop.speed}
                        </span>
                        <span className="text-[9px] bg-secondary/60 rounded px-1.5 py-0.5 flex items-center gap-0.5">
                          <Briefcase className="h-2.5 w-2.5 text-amber-400" />{troop.capacity}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(troop.cost).map(([k, v]) => (
                          <Badge key={k} variant="outline" className="text-[9px] px-1">
                            {(v as number).toLocaleString()} {RESOURCE_INFO[k as keyof typeof RESOURCE_INFO]?.name ?? k}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </DialogTrigger>

                <DialogContent className="bg-card border-border/50 max-w-sm">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-orange-400" /> {troop.name}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">{troop.description}</p>

                    {/* Full stat grid */}
                    <div className="grid grid-cols-5 gap-1.5 text-[10px]">
                      {[
                        { icon: Sword,    label: 'Saldırı', value: troop.attack,   color: 'text-red-400' },
                        { icon: Shield,   label: 'Savunma', value: troop.defense,  color: 'text-blue-400' },
                        { icon: Heart,    label: 'Sağlık',  value: troop.health,   color: 'text-pink-400' },
                        { icon: Wind,     label: 'Hız',     value: troop.speed,    color: 'text-cyan-400' },
                        { icon: Briefcase,label: 'Kapasite',value: troop.capacity, color: 'text-amber-400' },
                      ].map(({ icon: SI, label, value, color }) => (
                        <div key={label} className="bg-secondary/50 rounded-lg p-1.5 text-center">
                          <SI className={`h-3 w-3 mx-auto ${color} mb-0.5`} />
                          <p className={`text-xs font-bold ${color}`}>{value}</p>
                          <p className="text-[9px] text-muted-foreground leading-tight">{label}</p>
                        </div>
                      ))}
                    </div>

                    {data.wounded > 0 && (
                      <div className="flex items-center gap-1.5 bg-red-950/30 border border-red-900/30 rounded-lg px-2.5 py-1.5 text-xs text-red-300">
                        <AlertTriangle className="h-3 w-3" /> {data.wounded} yaralı birlik mevcut
                      </div>
                    )}

                    <div className="bg-secondary/50 rounded-lg p-2.5 space-y-1.5">
                      <p className="text-xs font-semibold">Eğitim Maliyeti (adet başı)</p>
                      {Object.entries(troop.cost).map(([k, v]) => (
                        <div key={k} className="flex justify-between text-[11px]">
                          <span className="text-muted-foreground">{RESOURCE_INFO[k as keyof typeof RESOURCE_INFO]?.name ?? k}</span>
                          <span className={player && (player[k as keyof typeof player] as number) >= (v as number) * count ? 'text-neon' : 'text-destructive'}>
                            {((v as number) * count).toLocaleString()}
                          </span>
                        </div>
                      ))}
                      <div className="flex justify-between text-[11px] pt-1 border-t border-border/30">
                        <span className="text-muted-foreground">Toplam Süre</span>
                        <span className="flex items-center gap-1">
                          {formatTime(dur * count)}
                          {totalSpeedBonus > 0 && <span className="text-neon text-[9px]">(-{totalSpeedBonus}%)</span>}
                        </span>
                      </div>
                    </div>

                    {/* Count selector */}
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setCount(c => Math.max(1, c - 1))}>
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <div className="flex-1 text-center">
                        <p className="text-lg font-bold">{count}</p>
                        <p className="text-[10px] text-muted-foreground">birlik</p>
                      </div>
                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setCount(c => Math.min(100, c + 1))}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {[5, 10, 25, 50].map(n => (
                        <Button key={n} size="sm" variant="outline" className="text-xs h-7" onClick={() => setCount(n)}>×{n}</Button>
                      ))}
                    </div>
                    <Button className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold" onClick={handleTrain}>
                      <Users className="h-4 w-4 mr-1" /> {count} Birlik Eğit
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )
          })}
        </div>
      </div>
    </div>
  )
}
