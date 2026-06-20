import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Swords, Shield, Banknote, Crosshair, ArrowUp, Package, Gem, Sparkles, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { getRarityColor, getRarityBg, ENFORCER_PRESETS } from '@/lib/game/constants'
import { useGuestStore } from '@/stores/guestStore'
import { useGameStore } from '@/stores/gameStore'
import * as db from '@/lib/supabase/database'
import type { Rarity, UserEnforcer } from '@/types/game'

const CHEST_TYPES = [
  {
    id: 'bronze', name: 'Bronz Sandık', description: 'Common/Uncommon enforcer şardları',
    cost: { diamonds: 50 },
    odds: { common: 70, uncommon: 25, rare: 5, epic: 0, legendary: 0, mythic: 0 },
    color: 'from-amber-900/40 to-amber-800/20 border-amber-700/30', badgeColor: 'text-amber-600',
  },
  {
    id: 'silver', name: 'Gümüş Sandık', description: 'Rare ve üstü enforcer şardları',
    cost: { diamonds: 150 },
    odds: { common: 20, uncommon: 40, rare: 30, epic: 9, legendary: 1, mythic: 0 },
    color: 'from-slate-800/40 to-slate-700/20 border-slate-600/30', badgeColor: 'text-slate-300',
  },
  {
    id: 'gold', name: 'Altın Sandık', description: 'Epic ve üstü garantili',
    cost: { diamonds: 400 },
    odds: { common: 0, uncommon: 10, rare: 30, epic: 40, legendary: 18, mythic: 2 },
    color: 'from-amber-950/40 to-yellow-900/20 border-gold/30', badgeColor: 'text-gold',
  },
]

const SHARD_UNLOCK_COST = 20
const SHARD_UPGRADE_COST = 5
const GUEST_KEY = 'uw-enforcers'

function rarityLabel(r: Rarity) {
  const map: Record<Rarity, string> = { common: 'Yaygın', uncommon: 'Sıradan', rare: 'Nadir', epic: 'Epik', legendary: 'Efsanevi', mythic: 'Mitik' }
  return map[r] || r
}

// ─── Guest enforcer state ─────────────────────────────────────────────────────

function useGuestEnforcers() {
  const [shards, setShards] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem(GUEST_KEY + '-shards') || '{}') } catch { return {} }
  })
  const [unlocked, setUnlocked] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(GUEST_KEY + '-unlocked') || '[]') } catch { return [] }
  })

  function saveShards(s: Record<string, number>) {
    localStorage.setItem(GUEST_KEY + '-shards', JSON.stringify(s))
    setShards(s)
  }
  function saveUnlocked(u: string[]) {
    localStorage.setItem(GUEST_KEY + '-unlocked', JSON.stringify(u))
    setUnlocked(u)
  }

  function upgradeGuest(enf: typeof ENFORCER_PRESETS[0]) {
    if ((shards[enf.id] || 0) < SHARD_UPGRADE_COST) {
      toast.error(`${SHARD_UPGRADE_COST} şard gerekli (mevcut: ${shards[enf.id] || 0})`)
      return
    }
    saveShards({ ...shards, [enf.id]: shards[enf.id] - SHARD_UPGRADE_COST })
    toast.success(`${enf.name} yükseltildi!`)
  }

  return { shards, unlocked, saveShards, saveUnlocked, upgradeGuest }
}

// ─── EnforcerCard ─────────────────────────────────────────────────────────────

function AuthEnforcerCard({ ue }: { ue: UserEnforcer }) {
  const { upgradeEnforcerAction } = useGameStore()
  const enf = ue.enforcer
  if (!enf) return null
  const canUpgrade = ue.shards >= SHARD_UPGRADE_COST
  return (
    <Card className={`border ${getRarityBg(enf.rarity as Rarity)}`}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <p className={`text-sm font-bold ${getRarityColor(enf.rarity as Rarity)}`}>{enf.name}</p>
            <p className="text-[10px] text-muted-foreground">{enf.class.replace('_', ' ')}</p>
          </div>
          <div className="text-right">
            <Badge variant="outline" className={`text-[9px] ${getRarityColor(enf.rarity as Rarity)} border-current`}>
              {rarityLabel(enf.rarity as Rarity)}
            </Badge>
            {ue.stars > 0 && (
              <p className="text-[9px] text-gold mt-0.5">{'★'.repeat(ue.stars)}</p>
            )}
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground line-clamp-2">{enf.description}</p>
        <div className="grid grid-cols-4 gap-1 text-[10px]">
          <div className="text-center bg-secondary/30 rounded p-1"><Swords className="h-3 w-3 mx-auto text-red-400" /><span>+{enf.attack_bonus}</span></div>
          <div className="text-center bg-secondary/30 rounded p-1"><Shield className="h-3 w-3 mx-auto text-blue-400" /><span>+{enf.defense_bonus}</span></div>
          <div className="text-center bg-secondary/30 rounded p-1"><Banknote className="h-3 w-3 mx-auto text-green-400" /><span>+{enf.economy_bonus}</span></div>
          <div className="text-center bg-secondary/30 rounded p-1"><Crosshair className="h-3 w-3 mx-auto text-purple-400" /><span>+{enf.crime_success_bonus}</span></div>
        </div>
        <div className="bg-secondary/30 rounded p-1.5">
          <p className="text-[9px] text-gold font-medium">{enf.active_skill}</p>
          <p className="text-[9px] text-muted-foreground mt-0.5">{enf.passive_skill}</p>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-[9px] text-muted-foreground">
            <span>Şard: {ue.shards}/{SHARD_UNLOCK_COST}</span>
            <span>Yükseltme ({SHARD_UPGRADE_COST} şard)</span>
          </div>
          <Progress value={Math.min(100, (ue.shards / SHARD_UNLOCK_COST) * 100)} className="h-1.5" />
        </div>
        <Button
          size="sm" className="w-full h-7 text-[10px]" variant="outline"
          disabled={!canUpgrade}
          onClick={() => upgradeEnforcerAction(ue.id)}
        >
          <ArrowUp className="h-3 w-3 mr-1" />
          Yükselt {canUpgrade ? '✓' : `(${ue.shards}/${SHARD_UPGRADE_COST} şard)`}
        </Button>
      </CardContent>
    </Card>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export function EnforcersPage() {
  const isGuest = useGuestStore(s => s.isGuest)
  const guestPlayer = useGuestStore(s => s.player)
  const guestSpend = useGuestStore(s => s.spendResources)
  const guestAdd = useGuestStore(s => s.addResources)
  const { shards: guestShards, unlocked: guestUnlocked, saveShards, saveUnlocked, upgradeGuest } = useGuestEnforcers()

  const authPlayer = useGameStore(s => s.player)
  const authEnforcers = useGameStore(s => s.enforcers)
  const { loadEnforcers, loadPlayer } = useGameStore()

  const player = isGuest ? guestPlayer : authPlayer

  useEffect(() => {
    if (!isGuest) loadEnforcers()
  }, [isGuest, loadEnforcers])

  const [openChestId, setOpenChestId] = useState<string | null>(null)
  const [rollResult, setRollResult] = useState<{ type: 'unlock' | 'shard'; enforcer: typeof ENFORCER_PRESETS[0]; shards?: number } | null>(null)
  const [rolling, setRolling] = useState(false)

  async function handleRoll(chestId: string) {
    if (rolling) return
    setRolling(true)
    setTimeout(async () => {
      const chest = CHEST_TYPES.find(c => c.id === chestId)
      if (!chest || !player) { setRolling(false); return }

      if (!isGuest) {
        const result = await db.openChest(chestId as 'bronze' | 'silver' | 'gold')
        if (!result.ok) {
          toast.error(result.error || 'Sandık açılamadı')
          setRolling(false)
          setOpenChestId(null)
          return
        }
        await Promise.all([loadPlayer(), loadEnforcers()])
        const key = result.enforcer_key || ''
        const enf = ENFORCER_PRESETS.find(e => e.key === key || e.id === key)
        if (enf) {
          setRollResult({
            type: result.unlocked ? 'unlock' : 'shard',
            enforcer: enf,
            shards: result.unlocked ? undefined : result.shards,
          })
        }
        setOpenChestId(null)
        setRolling(false)
        return
      }

      // Guest roll
      if (!guestSpend({ diamonds: chest.cost.diamonds })) {
        toast.error('Yeterli elmas yok')
        setRolling(false)
        setOpenChestId(null)
        return
      }

      const roll = Math.random() * 100
      let rarity: Rarity
      let cumulative = 0
      const odds = chest.odds
      if (roll < (cumulative += odds.mythic))     rarity = 'mythic'
      else if (roll < (cumulative += odds.legendary)) rarity = 'legendary'
      else if (roll < (cumulative += odds.epic))   rarity = 'epic'
      else if (roll < (cumulative += odds.rare))   rarity = 'rare'
      else if (roll < (cumulative += odds.uncommon)) rarity = 'uncommon'
      else rarity = 'common'

      const pool = ENFORCER_PRESETS.filter(e => e.rarity === rarity)
      if (!pool.length) { setRolling(false); setOpenChestId(null); return }
      const enf = pool[Math.floor(Math.random() * pool.length)]

      if (guestUnlocked.includes(enf.id)) {
        const newShards = { ...guestShards, [enf.id]: (guestShards[enf.id] || 0) + 5 }
        saveShards(newShards)
        setRollResult({ type: 'shard', enforcer: enf, shards: newShards[enf.id] })
      } else {
        const newShards = { ...guestShards, [enf.id]: (guestShards[enf.id] || 0) + 1 }
        const total = newShards[enf.id]
        if (total >= SHARD_UNLOCK_COST) {
          saveUnlocked([...guestUnlocked, enf.id])
          saveShards({ ...newShards, [enf.id]: total - SHARD_UNLOCK_COST })
          guestAdd({ xp: 500 })
          setRollResult({ type: 'unlock', enforcer: enf })
        } else {
          saveShards(newShards)
          setRollResult({ type: 'shard', enforcer: enf, shards: total })
        }
      }
      setOpenChestId(null)
      setRolling(false)
    }, 800)
  }

  // Auth: unlocked = level >= 1; locked = level 0
  const authUnlocked = authEnforcers.filter(ue => ue.level >= 1)
  const authLocked = authEnforcers.filter(ue => ue.level === 0)

  // Guest: derive from presets + localStorage
  const guestUnlockedEnforcers = ENFORCER_PRESETS.filter(e => guestUnlocked.includes(e.id))
  const guestLockedEnforcers = ENFORCER_PRESETS.filter(e => !guestUnlocked.includes(e.id))

  const unlockedCount = isGuest ? guestUnlockedEnforcers.length : authUnlocked.length

  return (
    <div className="p-3 space-y-4 pb-6">
      <div className="text-center">
        <h1 className="font-display text-xl font-black tracking-wider text-gold">ENFORCERLAR</h1>
        <p className="text-xs text-muted-foreground">Özel karakterleri topla ve geliştir</p>
      </div>

      <Tabs defaultValue="roster">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="roster">Kadrom ({unlockedCount})</TabsTrigger>
          <TabsTrigger value="chests">Sandıklar</TabsTrigger>
        </TabsList>

        {/* Roster */}
        <TabsContent value="roster" className="space-y-3 mt-3">
          {unlockedCount === 0 && (
            <Card className="bg-card/50 border-dashed border-border/50">
              <CardContent className="p-6 text-center space-y-2">
                <Package className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">Henüz enforcer yok</p>
                <p className="text-xs text-muted-foreground">Sandık aç, şard topla, unlock et!</p>
              </CardContent>
            </Card>
          )}

          {/* Auth unlocked */}
          {!isGuest && authUnlocked.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {authUnlocked.map(ue => <AuthEnforcerCard key={ue.id} ue={ue} />)}
            </div>
          )}

          {/* Guest unlocked */}
          {isGuest && guestUnlockedEnforcers.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {guestUnlockedEnforcers.map(enf => {
                const shardCount = guestShards[enf.id] || 0
                const canUpgrade = shardCount >= SHARD_UPGRADE_COST
                return (
                  <Card key={enf.id} className={`border ${getRarityBg(enf.rarity as Rarity)}`}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className={`text-sm font-bold ${getRarityColor(enf.rarity as Rarity)}`}>{enf.name}</p>
                          <p className="text-[10px] text-muted-foreground">{enf.class.replace('_', ' ')}</p>
                        </div>
                        <Badge variant="outline" className={`text-[9px] ${getRarityColor(enf.rarity as Rarity)} border-current`}>
                          {rarityLabel(enf.rarity as Rarity)}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground line-clamp-2">{enf.description}</p>
                      <div className="grid grid-cols-4 gap-1 text-[10px]">
                        <div className="text-center bg-secondary/30 rounded p-1"><Swords className="h-3 w-3 mx-auto text-red-400" /><span>+{enf.attack_bonus}</span></div>
                        <div className="text-center bg-secondary/30 rounded p-1"><Shield className="h-3 w-3 mx-auto text-blue-400" /><span>+{enf.defense_bonus}</span></div>
                        <div className="text-center bg-secondary/30 rounded p-1"><Banknote className="h-3 w-3 mx-auto text-green-400" /><span>+{enf.economy_bonus}</span></div>
                        <div className="text-center bg-secondary/30 rounded p-1"><Crosshair className="h-3 w-3 mx-auto text-purple-400" /><span>+{enf.crime_success_bonus}</span></div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] text-muted-foreground">
                          <span>Şard: {shardCount}/{SHARD_UNLOCK_COST}</span>
                          <span>Yükseltme</span>
                        </div>
                        <Progress value={Math.min(100, (shardCount / SHARD_UNLOCK_COST) * 100)} className="h-1.5" />
                      </div>
                      <Button size="sm" className="w-full h-7 text-[10px]" variant="outline" disabled={!canUpgrade} onClick={() => upgradeGuest(enf as unknown as typeof ENFORCER_PRESETS[0])}>
                        <ArrowUp className="h-3 w-3 mr-1" />
                        Yükselt {canUpgrade ? '✓' : `(${shardCount}/${SHARD_UPGRADE_COST} şard)`}
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          {/* Locked preview */}
          {(() => {
            const lockedList = isGuest
              ? guestLockedEnforcers
              : ENFORCER_PRESETS.filter(ep => !authUnlocked.some(ue => ue.enforcer?.key === ep.key))
            const lockedWithShards = isGuest
              ? lockedList.map(e => ({ ...e, shardCount: guestShards[e.id] || 0 }))
              : lockedList.map(e => {
                  const ue = authLocked.find(u => u.enforcer?.key === e.key)
                  return { ...e, shardCount: ue?.shards ?? 0 }
                })
            if (!lockedWithShards.length) return null
            return (
              <div className="space-y-2 mt-4">
                <h2 className="text-xs font-semibold text-muted-foreground">Kilitli ({lockedWithShards.length})</h2>
                <div className="grid grid-cols-2 gap-2">
                  {lockedWithShards.map(enf => (
                    <Card key={enf.id} className="border-border/30 bg-card/40 opacity-70">
                      <CardContent className="p-2.5 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className={`text-xs font-semibold ${getRarityColor(enf.rarity as Rarity)}`}>{enf.name}</p>
                          <Lock className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <div className="flex justify-between text-[9px] text-muted-foreground">
                          <span>{rarityLabel(enf.rarity as Rarity)}</span>
                          <span>{enf.shardCount}/{SHARD_UNLOCK_COST} şard</span>
                        </div>
                        <Progress value={Math.min(100, (enf.shardCount / SHARD_UNLOCK_COST) * 100)} className="h-1" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )
          })()}
        </TabsContent>

        {/* Chests */}
        <TabsContent value="chests" className="space-y-3 mt-3">
          <div className="bg-secondary/30 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">
              Sandıktan <span className="text-neon font-semibold">şard</span> kazan. {SHARD_UNLOCK_COST} şard = enforcer unlock!
            </p>
          </div>

          {CHEST_TYPES.map(chest => {
            const canAfford = player && (player.diamonds || 0) >= chest.cost.diamonds
            return (
              <Card key={chest.id} className={`bg-gradient-to-br ${chest.color}`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-10 w-10 rounded-xl bg-black/30 flex items-center justify-center">
                        <Package className={`h-5 w-5 ${chest.badgeColor}`} />
                      </div>
                      <div>
                        <p className={`text-sm font-bold ${chest.badgeColor}`}>{chest.name}</p>
                        <p className="text-[10px] text-muted-foreground">{chest.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-sm font-bold">
                      <Gem className="h-4 w-4 text-cyan-400" />
                      <span>{chest.cost.diamonds}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                    {(Object.entries(chest.odds) as [Rarity, number][])
                      .filter(([, v]) => v > 0)
                      .map(([rarity, pct]) => (
                        <div key={rarity} className="bg-black/20 rounded px-1.5 py-1 flex justify-between">
                          <span className={getRarityColor(rarity)}>{rarityLabel(rarity)}</span>
                          <span className="text-muted-foreground">{pct}%</span>
                        </div>
                      ))}
                  </div>
                  <Button
                    className="w-full font-bold"
                    style={{ background: canAfford ? 'oklch(0.55 0.20 75)' : undefined }}
                    variant={canAfford ? 'default' : 'outline'}
                    disabled={!canAfford || rolling}
                    onClick={() => { setOpenChestId(chest.id); handleRoll(chest.id) }}
                  >
                    {rolling && openChestId === chest.id
                      ? <><Sparkles className="h-4 w-4 mr-1 animate-spin" /> Açılıyor...</>
                      : <><Package className="h-4 w-4 mr-1" /> Sandığı Aç</>
                    }
                  </Button>
                </CardContent>
              </Card>
            )
          })}

          <Card className="border-gold/30 bg-gradient-to-br from-amber-950/30 to-card">
            <CardContent className="p-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-gold">10× Altın Çekiş</p>
                <p className="text-[10px] text-muted-foreground">10 sandık aç, 1 Epic garantili!</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 font-bold">
                  <Gem className="h-4 w-4 text-cyan-400" />
                  <span>3600</span>
                </div>
                <p className="text-[9px] text-neon">%10 indirim</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Roll result dialog */}
      <Dialog open={!!rollResult} onOpenChange={() => setRollResult(null)}>
        <DialogContent className="bg-card border-border/50 max-w-xs text-center">
          <DialogHeader>
            <DialogTitle className="text-center">
              {rollResult?.type === 'unlock' ? 'Enforcer Unlock!' : 'Şard Kazandın!'}
            </DialogTitle>
          </DialogHeader>
          {rollResult && (
            <div className="space-y-4 py-2">
              <div className={`w-20 h-20 rounded-2xl mx-auto flex items-center justify-center ${getRarityBg(rollResult.enforcer.rarity as Rarity)}`}>
                <Sparkles className={`h-10 w-10 ${getRarityColor(rollResult.enforcer.rarity as Rarity)}`} />
              </div>
              <div>
                <p className={`text-lg font-black ${getRarityColor(rollResult.enforcer.rarity as Rarity)}`}>
                  {rollResult.enforcer.name}
                </p>
                <Badge variant="outline" className={`${getRarityColor(rollResult.enforcer.rarity as Rarity)} border-current text-xs mt-1`}>
                  {rarityLabel(rollResult.enforcer.rarity as Rarity)}
                </Badge>
              </div>
              {rollResult.type === 'unlock'
                ? <p className="text-sm text-neon font-semibold">Kadronuza katıldı!</p>
                : <p className="text-sm text-muted-foreground"><span className="text-gold font-bold">{rollResult.shards}</span> / {SHARD_UNLOCK_COST} şard</p>
              }
              <Button className="w-full gradient-gold text-primary-foreground" onClick={() => setRollResult(null)}>
                Harika!
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
