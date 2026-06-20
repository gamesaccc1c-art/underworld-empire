import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sword, Shield, Eye, Skull, Trophy, Users, Target, RefreshCw, Crown, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useGameStore } from '@/stores/gameStore'
import { useGuestStore } from '@/stores/guestStore'
import * as db from '@/lib/supabase/database'
import { toast } from 'sonner'
import { RESOURCE_INFO } from '@/lib/game/constants'
import type { AttackTarget, NpcTarget, AttackResult, ScoutResult, BattleReport } from '@/types/game'
import { Spinner } from '@/components/ui/spinner'

// ─── Scout Dialog ─────────────────────────────────────────────────────────────

function ScoutDialog({ target, open, onClose }: { target: AttackTarget | null; open: boolean; onClose: () => void }) {
  const [scouting, setScouting] = useState(false)
  const [result, setResult] = useState<ScoutResult | null>(null)
  const player = useGameStore(s => s.player)
  const loadPlayer = useGameStore(s => s.loadPlayer)

  async function handleScout() {
    if (!target) return
    setScouting(true)
    const res = await db.scoutPlayer(target.id)
    setScouting(false)
    if (!res.ok) { toast.error(res.error || 'Kesif basarisiz'); return }
    await loadPlayer()
    setResult(res as ScoutResult)
  }

  function handleClose() {
    setResult(null)
    onClose()
  }

  const riskConfig: Record<string, { label: string; color: string; bg: string }> = {
    low:       { label: 'Dusuk', color: 'text-neon', bg: 'bg-neon/10' },
    medium:    { label: 'Orta', color: 'text-yellow-400', bg: 'bg-yellow-950/20' },
    high:      { label: 'Yuksek', color: 'text-orange-400', bg: 'bg-orange-950/20' },
    very_high: { label: 'Cok Yuksek', color: 'text-red-400', bg: 'bg-red-950/20' },
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border/50 max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-blue-300">
            <Eye className="h-5 w-5 text-blue-400" /> Kesif: {target?.username}
          </DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4 py-2">
            <div className="bg-blue-950/20 border border-blue-900/30 rounded-xl p-3 text-center">
              <Eye className="h-8 w-8 text-blue-400/50 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">50 istihbarat harcayarak hedefi kespet.</p>
              <p className="text-[10px] text-blue-400 mt-1">Mevcut: {player?.intel?.toLocaleString() ?? 0} intel</p>
            </div>
            <Button
              className="w-full bg-blue-700 hover:bg-blue-600 text-white font-bold"
              onClick={handleScout}
              disabled={scouting || (player?.intel ?? 0) < 50}
            >
              <Eye className="h-4 w-4 mr-1.5" />
              {scouting ? 'Kespediliyor...' : 'Kesifet (50 Intel)'}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-secondary/50 rounded-xl p-2.5">
                <p className="text-[9px] text-muted-foreground mb-1">Tahmini Nakit</p>
                <p className="text-sm font-black text-green-400">{result.estimated_cash?.toLocaleString()}</p>
              </div>
              <div className="bg-secondary/50 rounded-xl p-2.5">
                <p className="text-[9px] text-muted-foreground mb-1">Savunma Gucu</p>
                <p className="text-sm font-black text-blue-400">{result.estimated_defense?.toLocaleString()}</p>
              </div>
              <div className="bg-secondary/50 rounded-xl p-2.5">
                <p className="text-[9px] text-muted-foreground mb-1">Karagah</p>
                <p className="text-sm font-black">Lv.{result.hq_level}</p>
              </div>
              {result.risk_level && (() => {
                const rc = riskConfig[result.risk_level] || riskConfig.medium
                return (
                  <div className={`${rc.bg} rounded-xl p-2.5 border border-border/30`}>
                    <p className="text-[9px] text-muted-foreground mb-1">Risk</p>
                    <p className={`text-sm font-black ${rc.color}`}>{rc.label}</p>
                  </div>
                )
              })()}
            </div>
            {result.family_name && (
              <div className="flex items-center gap-1.5 text-xs bg-secondary/30 rounded-lg px-2.5 py-1.5">
                <Users className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Aile:</span>
                <span className="font-semibold">{result.family_name}</span>
              </div>
            )}
            {result.has_shield && (
              <div className="flex items-center gap-1.5 bg-red-950/20 border border-red-900/30 rounded-lg px-2.5 py-1.5 text-xs text-red-400">
                <Shield className="h-3.5 w-3.5" /> Kalkan aktif — saldiri azaltilir!
              </div>
            )}
            <Button variant="outline" className="w-full" onClick={handleClose}>Kapat</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Attack Confirm Dialog ────────────────────────────────────────────────────

function AttackConfirmDialog({
  target, open, onClose, onConfirm, myPower, attacking,
}: {
  target: AttackTarget | null
  open: boolean
  onClose: () => void
  onConfirm: () => void
  myPower: number
  attacking: boolean
}) {
  if (!target) return null
  const powerDiff = myPower - target.power
  const stronger = powerDiff > 0
  const roughly = Math.abs(powerDiff) / Math.max(myPower, target.power) < 0.1

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border/50 max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-300">
            <Sword className="h-5 w-5 text-red-400" /> Saldiri Onayi
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Power comparison */}
          <div className="bg-secondary/40 rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground text-center mb-2 font-bold uppercase tracking-wider">Guc Karsilastirmasi</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 text-center">
                <p className="text-[10px] text-muted-foreground">Sen</p>
                <p className="text-lg font-black text-red-400">{myPower.toLocaleString()}</p>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <Sword className="h-4 w-4 text-muted-foreground" />
                {roughly ? (
                  <Minus className="h-3 w-3 text-yellow-400" />
                ) : stronger ? (
                  <TrendingUp className="h-3 w-3 text-neon" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-400" />
                )}
              </div>
              <div className="flex-1 text-center">
                <p className="text-[10px] text-muted-foreground">{target.username}</p>
                <p className="text-lg font-black text-blue-400">{target.power.toLocaleString()}</p>
              </div>
            </div>
            <div className="mt-2 h-2 bg-secondary/60 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (myPower / (myPower + target.power)) * 100)}%`,
                  background: stronger
                    ? 'linear-gradient(90deg, oklch(0.7 0.15 150), oklch(0.8 0.12 160))'
                    : 'linear-gradient(90deg, oklch(0.55 0.22 25), oklch(0.45 0.25 10))',
                }}
              />
            </div>
            <p className={`text-[10px] text-center mt-1.5 font-semibold ${roughly ? 'text-yellow-400' : stronger ? 'text-neon' : 'text-red-400'}`}>
              {roughly ? 'Esit guc — sonuc belirsiz' : stronger ? `+${powerDiff.toLocaleString()} avantajin var` : `${Math.abs(powerDiff).toLocaleString()} guc eksigin var`}
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={attacking}>
              Vazgec
            </Button>
            <Button
              className="flex-1 bg-red-700 hover:bg-red-600 text-white font-bold"
              onClick={onConfirm}
              disabled={attacking}
            >
              {attacking ? (
                <><Spinner className="h-3.5 w-3.5 mr-1.5" /> Saldiriliyor...</>
              ) : (
                <><Sword className="h-4 w-4 mr-1.5" /> Saldir!</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Battle Result Dialog ─────────────────────────────────────────────────────

function BattleResultDialog({ result, onClose }: { result: AttackResult | null; onClose: () => void }) {
  if (!result) return null
  const isVictory = result.result === 'victory'
  const isDraw = result.result === 'draw'

  return (
    <Dialog open={!!result} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border/50 max-w-sm">
        <div className={`-mx-6 -mt-6 px-6 pt-6 pb-4 rounded-t-2xl ${
          isVictory ? 'bg-gradient-to-br from-neon/10 to-transparent' : isDraw ? 'bg-gradient-to-br from-yellow-950/20 to-transparent' : 'bg-gradient-to-br from-red-950/20 to-transparent'
        }`}>
          <div className="text-center space-y-2">
            <div className={`h-16 w-16 rounded-full mx-auto flex items-center justify-center ${
              isVictory ? 'bg-neon/20 border-2 border-neon/40' : isDraw ? 'bg-yellow-500/20 border-2 border-yellow-500/40' : 'bg-red-500/20 border-2 border-red-500/40'
            }`}>
              {isVictory
                ? <Trophy className="h-8 w-8 text-neon" />
                : isDraw
                ? <Minus className="h-8 w-8 text-yellow-400" />
                : <Skull className="h-8 w-8 text-red-400" />}
            </div>
            <div>
              <p className={`text-2xl font-black font-display ${isVictory ? 'text-neon' : isDraw ? 'text-yellow-400' : 'text-red-400'}`}>
                {isVictory ? 'ZAFER!' : isDraw ? 'BERABERE!' : 'YENILGI!'}
              </p>
              {result.npc_name && (
                <p className="text-xs text-muted-foreground mt-0.5">vs {result.npc_name}</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3 mt-2">
          {/* Power */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-red-950/20 rounded-xl p-2.5 text-center border border-red-900/20">
              <p className="text-[9px] text-muted-foreground mb-0.5">Saldiriniz</p>
              <p className="text-lg font-black text-red-400">{result.attacker_power?.toLocaleString()}</p>
            </div>
            <div className="bg-blue-950/20 rounded-xl p-2.5 text-center border border-blue-900/20">
              <p className="text-[9px] text-muted-foreground mb-0.5">Savunma</p>
              <p className="text-lg font-black text-blue-400">{result.defender_power?.toLocaleString()}</p>
            </div>
          </div>

          {/* Loot */}
          {isVictory && result.loot && Object.values(result.loot).some(v => v > 0) && (
            <div className="bg-neon/5 border border-neon/20 rounded-xl p-3">
              <p className="text-xs font-bold text-neon mb-2 flex items-center gap-1">
                <Trophy className="h-3.5 w-3.5" /> Yagma
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {Object.entries(result.loot).filter(([, v]) => v > 0).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">{RESOURCE_INFO[k as keyof typeof RESOURCE_INFO]?.name ?? k}</span>
                    <span className="text-neon font-bold">+{(v as number).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Casualties */}
          {result.casualties?.attacker && Object.keys(result.casualties.attacker).length > 0 && (
            <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-3">
              <p className="text-xs font-bold text-red-400 mb-2 flex items-center gap-1">
                <Skull className="h-3.5 w-3.5" /> Kayiplariniz
              </p>
              <div className="grid grid-cols-2 gap-1">
                {Object.entries(result.casualties!.attacker!).map(([type, count]) => (
                  <p key={type} className="text-[11px] text-red-300">{type}: <span className="font-bold">-{count as number}</span></p>
                ))}
              </div>
            </div>
          )}

          {result.wounded && Object.keys(result.wounded.attacker || {}).length > 0 && (
            <div className="bg-orange-950/20 border border-orange-900/30 rounded-xl p-3">
              <p className="text-xs font-bold text-orange-400 mb-2">Yaralilariniz</p>
              <div className="grid grid-cols-2 gap-1">
                {Object.entries(result.wounded.attacker || {}).map(([type, count]) => (
                  <p key={type} className="text-[11px] text-orange-300">{type}: {count as number} yarali</p>
                ))}
              </div>
            </div>
          )}

          <Button className="w-full" variant="outline" onClick={onClose}>Kapat</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Battle Report Card ───────────────────────────────────────────────────────

function ReportCard({ report, userId }: { report: BattleReport; userId: string }) {
  const isAttacker = report.attacker_id === userId
  const isVictory = (isAttacker && report.result === 'victory') || (!isAttacker && report.result === 'defeat')
  const isDraw = report.result === 'draw'
  const lootTotal = report.loot ? Object.values(report.loot).reduce((a, b) => a + (b as number), 0) : 0

  return (
    <Card className={`border-l-2 ${isVictory ? 'border-l-neon bg-neon/5 border-border/20' : isDraw ? 'border-l-yellow-500 bg-yellow-950/10 border-border/20' : 'border-l-red-500 bg-red-950/10 border-border/20'}`}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${isVictory ? 'bg-neon/10' : isDraw ? 'bg-yellow-500/10' : 'bg-red-500/10'}`}>
              {isVictory
                ? <Trophy className="h-4 w-4 text-neon" />
                : isDraw
                ? <Minus className="h-4 w-4 text-yellow-400" />
                : <Skull className="h-4 w-4 text-red-400" />}
            </div>
            <div>
              <p className={`text-xs font-bold ${isVictory ? 'text-neon' : isDraw ? 'text-yellow-400' : 'text-red-400'}`}>
                {isVictory ? 'Zafer' : isDraw ? 'Berabere' : 'Yenilgi'}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {report.attacker_power?.toLocaleString()} vs {report.defender_power?.toLocaleString()} guc
              </p>
            </div>
          </div>
          <div className="text-right">
            {lootTotal > 0 && isVictory && (
              <p className="text-xs font-bold text-neon">+{lootTotal.toLocaleString()}</p>
            )}
            <p className="text-[9px] text-muted-foreground">{new Date(report.created_at).toLocaleDateString('tr-TR')}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── PvP Target Card ──────────────────────────────────────────────────────────

function PvPTargetCard({
  target, myPower, onScout, onAttack, attacking,
}: {
  target: AttackTarget
  myPower: number
  onScout: () => void
  onAttack: () => void
  attacking: boolean
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const powerDiff = myPower - target.power
  const stronger = powerDiff > 0
  const roughly = Math.abs(powerDiff) / Math.max(myPower, target.power) < 0.1

  return (
    <>
      <Card className="bg-card/70 border-border/30 hover:border-red-900/30 transition-all">
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center border border-border/50">
                <span className="text-sm font-black text-muted-foreground">{target.username.slice(0, 2).toUpperCase()}</span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-bold">{target.username}</p>
                  {target.family_tag && (
                    <Badge variant="outline" className="text-[8px] h-4 px-1 border-gold/30 text-gold/80">[{target.family_tag}]</Badge>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">Lv.{target.level}</p>
              </div>
            </div>
            {/* Power comparison badge */}
            <div className="text-right">
              <p className={`text-sm font-black ${roughly ? 'text-yellow-400' : stronger ? 'text-neon' : 'text-red-400'}`}>
                {target.power.toLocaleString()}
              </p>
              <div className={`flex items-center justify-end gap-0.5 text-[9px] ${roughly ? 'text-yellow-400' : stronger ? 'text-neon' : 'text-red-400'}`}>
                {roughly ? <Minus className="h-2.5 w-2.5" /> : stronger ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                <span>{roughly ? 'Esit' : stronger ? 'Zayif' : 'Guclu'}</span>
              </div>
            </div>
          </div>

          {/* Power bar */}
          <div className="mb-2.5 h-1.5 bg-secondary/60 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, (myPower / (myPower + target.power)) * 100)}%`,
                background: stronger
                  ? 'linear-gradient(90deg, oklch(0.7 0.15 150), oklch(0.8 0.12 160))'
                  : 'linear-gradient(90deg, oklch(0.55 0.22 25), oklch(0.45 0.25 10))',
              }}
            />
          </div>

          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-7 text-[10px] border-blue-900/40 text-blue-300 hover:bg-blue-950/30"
              onClick={onScout}
            >
              <Eye className="h-3 w-3 mr-1" /> Kesif
            </Button>
            <Button
              size="sm"
              className="flex-1 h-7 text-[10px] bg-red-700/80 hover:bg-red-600 text-white font-bold"
              onClick={() => setConfirmOpen(true)}
              disabled={attacking}
            >
              <Sword className="h-3 w-3 mr-1" />
              {attacking ? '...' : 'Saldir'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AttackConfirmDialog
        target={target}
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => { setConfirmOpen(false); onAttack() }}
        myPower={myPower}
        attacking={attacking}
      />
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function BattlePage() {
  const isGuest = useGuestStore(s => s.isGuest)
  const player = useGameStore(s => s.player)
  const attackTargets = useGameStore(s => s.attackTargets)
  const npcTargets = useGameStore(s => s.npcTargets)
  const battleReports = useGameStore(s => s.battleReports)
  const { attackPlayerAction, attackNpcAction, loadBattleData } = useGameStore()

  const [scoutTarget, setScoutTarget] = useState<AttackTarget | null>(null)
  const [battleResult, setBattleResult] = useState<AttackResult | null>(null)
  const [attacking, setAttacking] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!isGuest) loadBattleData()
  }, [isGuest, loadBattleData])

  async function refreshTargets() {
    setRefreshing(true)
    await loadBattleData()
    setRefreshing(false)
  }

  async function handleAttackPlayer(target: AttackTarget) {
    setAttacking(target.id)
    const result = await attackPlayerAction(target.id, 'raid')
    setAttacking(null)
    if (result) setBattleResult(result)
    await loadBattleData()
  }

  async function handleAttackNpc(npc: NpcTarget) {
    setAttacking(npc.id)
    const result = await attackNpcAction(npc.id)
    setAttacking(null)
    if (result) setBattleResult(result)
  }

  if (isGuest) {
    return (
      <div className="p-3 pb-6 space-y-4">
        <div className="relative rounded-2xl overflow-hidden border border-border/30 bg-gradient-to-br from-slate-900 via-card to-red-950/20">
          <div className="absolute inset-0 bg-gradient-to-br from-red-950/20 via-transparent to-transparent pointer-events-none" />
          <div className="relative px-4 py-5 text-center space-y-2">
            <Sword className="h-10 w-10 text-red-400/40 mx-auto" />
            <h1 className="font-display text-xl font-black tracking-wider text-red-300">SAVAS</h1>
            <p className="text-xs text-muted-foreground">PvP savas sistemi icin giris yapmaniz gerekiyor.</p>
          </div>
        </div>
      </div>
    )
  }

  const myPower = player?.power ?? 0

  return (
    <div className="p-3 space-y-4 pb-6">
      {/* Header */}
      <div className="relative rounded-2xl overflow-hidden border border-border/30 bg-gradient-to-br from-slate-900 via-card to-red-950/20">
        <div className="absolute inset-0 bg-gradient-to-br from-red-950/25 via-transparent to-orange-950/10 pointer-events-none" />
        <div className="relative px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-black tracking-wider text-red-300 drop-shadow-[0_0_15px_rgba(239,68,68,0.3)]">
              SAVAS
            </h1>
            <p className="text-[10px] text-muted-foreground mt-0.5">Baskin yap, yagmala, guclen</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-xl font-black text-red-400 font-display tabular-nums">{player?.raid_energy ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">Baskin Enerjisi</p>
            </div>
            <div className="h-10 w-px bg-border/30" />
            <div className="text-right">
              <p className="text-lg font-black text-foreground font-display tabular-nums">{myPower.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">Gucunuz</p>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="pvp">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pvp" className="text-xs"><Users className="h-3.5 w-3.5 mr-1" />PvP</TabsTrigger>
          <TabsTrigger value="npc" className="text-xs"><Target className="h-3.5 w-3.5 mr-1" />NPC</TabsTrigger>
          <TabsTrigger value="reports" className="text-xs"><Trophy className="h-3.5 w-3.5 mr-1" />Raporlar</TabsTrigger>
        </TabsList>

        {/* PvP targets */}
        <TabsContent value="pvp" className="space-y-3 mt-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">{attackTargets.length} hedef</p>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1"
              onClick={refreshTargets}
              disabled={refreshing}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Yenile
            </Button>
          </div>

          {attackTargets.length === 0 ? (
            <div className="bg-card/40 border border-dashed border-border/40 rounded-2xl p-10 text-center space-y-2">
              <Target className="h-10 w-10 text-muted-foreground/30 mx-auto" />
              <p className="text-sm font-semibold text-muted-foreground">Hedef bulunamadi</p>
              <p className="text-xs text-muted-foreground/60">Yenilemeyi deneyin.</p>
              <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={refreshTargets}>
                <RefreshCw className="h-3 w-3 mr-1" /> Yenile
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {attackTargets.map(target => (
                <PvPTargetCard
                  key={target.id}
                  target={target}
                  myPower={myPower}
                  onScout={() => setScoutTarget(target)}
                  onAttack={() => handleAttackPlayer(target)}
                  attacking={attacking === target.id}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* NPC targets */}
        <TabsContent value="npc" className="space-y-3 mt-3">
          <p className="text-xs text-muted-foreground">NPC hedefler duşuk risklidir, ancak birlik kaybedebilirsiniz.</p>
          {npcTargets.length === 0 ? (
            <div className="bg-card/40 border border-dashed border-border/40 rounded-2xl p-8 text-center">
              <Target className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">NPC hedef yok.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {npcTargets.map(npc => {
                const canAttack = (player?.level ?? 0) >= npc.required_level
                const npcPowerRelative = npc.defense_power <= myPower * 0.7 ? 'easy' : npc.defense_power <= myPower ? 'medium' : 'hard'
                const difficultyConfig = {
                  easy: { label: 'Kolay', color: 'text-neon', border: 'border-neon/20', bg: 'bg-neon/5' },
                  medium: { label: 'Orta', color: 'text-yellow-400', border: 'border-yellow-900/30', bg: 'bg-yellow-950/10' },
                  hard: { label: 'Zor', color: 'text-red-400', border: 'border-red-900/30', bg: 'bg-red-950/10' },
                }[npcPowerRelative]

                return (
                  <Card
                    key={npc.id}
                    className={`border ${difficultyConfig.border} ${difficultyConfig.bg} ${!canAttack ? 'opacity-50' : ''}`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="h-9 w-9 rounded-lg bg-secondary/60 flex items-center justify-center shrink-0">
                            <Target className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold">{npc.name}</p>
                              <Badge variant="outline" className={`text-[8px] h-4 px-1 ${difficultyConfig.border} ${difficultyConfig.color}`}>
                                {difficultyConfig.label}
                              </Badge>
                            </div>
                            <p className="text-[10px] text-muted-foreground">{npc.description}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-sm font-black ${difficultyConfig.color}`}>{npc.defense_power.toLocaleString()}</p>
                          <p className="text-[9px] text-muted-foreground">Savunma</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-1 flex-1">
                          {Object.entries(npc.loot).filter(([k]) => k !== 'xp').map(([k, v]) => (
                            <Badge key={k} variant="outline" className="text-[9px] px-1 text-neon border-neon/20">
                              +{(v as number).toLocaleString()} {RESOURCE_INFO[k as keyof typeof RESOURCE_INFO]?.name ?? k}
                            </Badge>
                          ))}
                        </div>
                        <Button
                          size="sm"
                          className="h-7 text-[10px] bg-orange-700/80 hover:bg-orange-600 text-white font-bold shrink-0"
                          disabled={!canAttack || attacking === npc.id || (player?.raid_energy ?? 0) <= 0}
                          onClick={() => handleAttackNpc(npc)}
                        >
                          {!canAttack
                            ? `Lv.${npc.required_level}`
                            : attacking === npc.id
                            ? <Spinner className="h-3 w-3" />
                            : <><Sword className="h-3 w-3 mr-1" />Baskin</>}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* Reports */}
        <TabsContent value="reports" className="space-y-2 mt-3">
          {battleReports.length === 0 ? (
            <div className="bg-card/40 border border-dashed border-border/40 rounded-2xl p-10 text-center space-y-2">
              <Crown className="h-10 w-10 text-muted-foreground/30 mx-auto" />
              <p className="text-sm font-semibold text-muted-foreground">Henuz savas raporu yok</p>
              <p className="text-xs text-muted-foreground/60">Bir NPC'ye ya da oyuncuya saldirin.</p>
            </div>
          ) : (
            battleReports.map(report => (
              <ReportCard key={report.id} report={report} userId={player?.id ?? ''} />
            ))
          )}
        </TabsContent>
      </Tabs>

      <ScoutDialog target={scoutTarget} open={!!scoutTarget} onClose={() => setScoutTarget(null)} />
      <BattleResultDialog result={battleResult} onClose={() => setBattleResult(null)} />
    </div>
  )
}
