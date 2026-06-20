import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { ChartBar as BarChart3, Swords, Shield, Trophy, TrendingUp, Clock, Target, Zap, Crown, Crosshair, Banknote, Gem } from 'lucide-react'
import { useGameStore } from '@/stores/gameStore'
import { useGuestStore } from '@/stores/guestStore'
import * as db from '@/lib/supabase/database'
import type { BattleReport } from '@/types/game'

interface PlayerStats {
  total_battles: number
  victories: number
  defeats: number
  draws: number
  total_loot_cash: number
  total_loot_diamonds: number
  total_casualties: number
  total_power_defeated: number
  win_rate: number
  best_streak: number
}

export function StatisticsPage() {
  const isGuest = useGuestStore(s => s.isGuest)
  const guestPlayer = useGuestStore(s => s.player)
  const session = useGameStore(s => s.session)
  const authPlayer = useGameStore(s => s.player)
  const player = isGuest ? guestPlayer : authPlayer

  const [reports, setReports] = useState<BattleReport[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (isGuest || !session?.user) { setLoading(false); return }
    try {
      const data = await db.getBattleReports(session.user.id)
      setReports(data)
    } catch {}
    setLoading(false)
  }, [isGuest, session])

  useEffect(() => { load() }, [load])

  if (!player) return null

  const stats = computeStats(reports, session?.user?.id || '')

  if (loading) {
    return <div className="flex items-center justify-center min-h-[300px]"><Spinner className="h-6 w-6 text-gold" /></div>
  }

  return (
    <div className="p-3 space-y-4 pb-6">
      <div className="text-center">
        <h1 className="font-display text-xl font-black tracking-wider text-gold">ISTATISTIKLER</h1>
        <p className="text-xs text-muted-foreground">Performansini ve ilerlemeyi takip et</p>
      </div>

      {/* Overview stats */}
      <Card className="border-gold/20 bg-gradient-to-br from-amber-950/20 to-card">
        <CardContent className="p-4 space-y-3">
          <h3 className="text-xs font-semibold flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5 text-gold" /> Genel Bakis
          </h3>
          <div className="grid grid-cols-3 gap-2">
            <StatTile icon={<Zap className="h-4 w-4 text-gold" />} value={player.power.toLocaleString()} label="Guc" />
            <StatTile icon={<Crown className="h-4 w-4 text-purple-400" />} value={String(player.level)} label="Seviye" />
            <StatTile icon={<Trophy className="h-4 w-4 text-amber-400" />} value={String(player.reputation)} label="Itibar" />
          </div>
          <Separator className="opacity-30" />
          <div className="grid grid-cols-4 gap-2">
            <StatTile icon={<Banknote className="h-3.5 w-3.5 text-green-400" />} value={formatNumber(player.cash)} label="Nakit" small />
            <StatTile icon={<Gem className="h-3.5 w-3.5 text-cyan-400" />} value={String(player.diamonds)} label="Elmas" small />
            <StatTile icon={<Shield className="h-3.5 w-3.5 text-blue-400" />} value={String(player.influence)} label="Etki" small />
            <StatTile icon={<Target className="h-3.5 w-3.5 text-red-400" />} value={`${player.police_heat}%`} label="Polis" small />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="battle">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="battle" className="text-xs">Savas Istatistikleri</TabsTrigger>
          <TabsTrigger value="history" className="text-xs">Savas Gecmisi</TabsTrigger>
        </TabsList>

        <TabsContent value="battle" className="mt-3 space-y-3">
          {/* Battle stats */}
          <Card className="border-border/40 bg-card/70">
            <CardContent className="p-4 space-y-3">
              <h3 className="text-xs font-semibold flex items-center gap-1.5">
                <Swords className="h-3.5 w-3.5 text-red-400" /> Savas Ozeti
              </h3>

              {stats.total_battles === 0 ? (
                <div className="text-center py-4">
                  <Crosshair className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Henuz savas yapilmadi</p>
                  <p className="text-[10px] text-muted-foreground">Savas sayfasindan ilk saldirinizi gerceklestirin</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-2">
                    <StatTile icon={<Swords className="h-3.5 w-3.5 text-foreground" />} value={String(stats.total_battles)} label="Toplam" small />
                    <StatTile icon={<Trophy className="h-3.5 w-3.5 text-green-400" />} value={String(stats.victories)} label="Galibiyet" small />
                    <StatTile icon={<Shield className="h-3.5 w-3.5 text-red-400" />} value={String(stats.defeats)} label="Maglubiyet" small />
                    <StatTile icon={<TrendingUp className="h-3.5 w-3.5 text-gold" />} value={`${stats.win_rate}%`} label="Oran" small />
                  </div>

                  {/* Win rate bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span className="text-green-400">Galibiyet</span>
                      <span className="text-red-400">Maglubiyet</span>
                    </div>
                    <div className="h-3 bg-secondary/50 rounded-full overflow-hidden flex">
                      {stats.victories > 0 && (
                        <div
                          className="h-full bg-gradient-to-r from-green-600 to-green-500 transition-all"
                          style={{ width: `${stats.win_rate}%` }}
                        />
                      )}
                      {stats.draws > 0 && (
                        <div
                          className="h-full bg-yellow-600/50"
                          style={{ width: `${(stats.draws / stats.total_battles) * 100}%` }}
                        />
                      )}
                      {stats.defeats > 0 && (
                        <div
                          className="h-full bg-gradient-to-r from-red-500 to-red-600 transition-all flex-1"
                        />
                      )}
                    </div>
                  </div>

                  <Separator className="opacity-30" />

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-secondary/30 rounded-lg p-2.5 text-center">
                      <p className="text-sm font-bold text-green-400">{formatNumber(stats.total_loot_cash)}</p>
                      <p className="text-[9px] text-muted-foreground">Toplam Yagma</p>
                    </div>
                    <div className="bg-secondary/30 rounded-lg p-2.5 text-center">
                      <p className="text-sm font-bold text-red-400">{stats.total_casualties.toLocaleString()}</p>
                      <p className="text-[9px] text-muted-foreground">Kayiplar</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-3 space-y-2">
          {reports.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Savas gecmisi bos</p>
            </div>
          ) : (
            reports.map(report => (
              <BattleReportCard key={report.id} report={report} playerId={session?.user?.id || ''} />
            ))
          )}
          {reports.length > 0 && (
            <p className="text-center text-[10px] text-muted-foreground">Son 20 savas gosteriliyor</p>
          )}
        </TabsContent>
      </Tabs>

      {/* Refresh */}
      {!isGuest && (
        <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => { setLoading(true); load() }}>
          Yenile
        </Button>
      )}
    </div>
  )
}

function StatTile({ icon, value, label, small }: { icon: React.ReactNode; value: string; label: string; small?: boolean }) {
  return (
    <div className="bg-secondary/30 rounded-lg p-2 text-center">
      <div className="flex justify-center mb-0.5">{icon}</div>
      <p className={`font-bold font-display ${small ? 'text-xs' : 'text-base'}`}>{value}</p>
      <p className="text-[9px] text-muted-foreground">{label}</p>
    </div>
  )
}

function BattleReportCard({ report, playerId }: { report: BattleReport; playerId: string }) {
  const isAttacker = report.attacker_id === playerId
  const won = report.result === 'victory'
  const lost = report.result === 'defeat'
  const loot = report.loot || {}
  const myCasualties = isAttacker ? report.casualties?.attacker : report.casualties?.defender
  const totalCasualties = myCasualties ? Object.values(myCasualties).reduce((a, b) => a + b, 0) : 0

  return (
    <Card className={`border ${won ? 'border-green-800/30 bg-green-950/10' : lost ? 'border-red-800/30 bg-red-950/10' : 'border-border/30 bg-card/50'}`}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <Badge className={`text-[9px] px-1.5 ${
              won ? 'bg-green-900/40 text-green-400 border-green-700/40'
              : lost ? 'bg-red-900/40 text-red-400 border-red-700/40'
              : 'bg-yellow-900/40 text-yellow-400 border-yellow-700/40'
            }`}>
              {won ? 'ZAFER' : lost ? 'YENILGI' : 'BERABERE'}
            </Badge>
            <Badge variant="outline" className="text-[9px] px-1.5">
              {isAttacker ? 'Saldiran' : 'Savunan'}
            </Badge>
          </div>
          <span className="text-[9px] text-muted-foreground">
            {new Date(report.created_at).toLocaleDateString('tr-TR')}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground">Guc</p>
              <p className="font-bold text-gold">{report.attacker_power.toLocaleString()}</p>
            </div>
            <Swords className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground">Rakip</p>
              <p className="font-bold">{report.defender_power.toLocaleString()}</p>
            </div>
          </div>
          <div className="text-right">
            {Object.entries(loot).filter(([, v]) => v > 0).length > 0 && (
              <p className="text-[10px] text-green-400">
                {Object.entries(loot).filter(([, v]) => v > 0).map(([k, v]) => `+${v} ${k}`).join(', ')}
              </p>
            )}
            {totalCasualties > 0 && (
              <p className="text-[10px] text-red-400">-{totalCasualties} birlik</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function computeStats(reports: BattleReport[], playerId: string): PlayerStats {
  const stats: PlayerStats = {
    total_battles: reports.length,
    victories: 0,
    defeats: 0,
    draws: 0,
    total_loot_cash: 0,
    total_loot_diamonds: 0,
    total_casualties: 0,
    total_power_defeated: 0,
    win_rate: 0,
    best_streak: 0,
  }

  let streak = 0
  for (const r of reports) {
    if (r.result === 'victory') {
      stats.victories++
      streak++
      stats.best_streak = Math.max(stats.best_streak, streak)
      stats.total_power_defeated += r.defender_power
    } else if (r.result === 'defeat') {
      stats.defeats++
      streak = 0
    } else {
      stats.draws++
      streak = 0
    }

    if (r.loot) {
      stats.total_loot_cash += r.loot.cash || 0
      stats.total_loot_diamonds += r.loot.diamonds || 0
    }

    const isAttacker = r.attacker_id === playerId
    const myCasualties = isAttacker ? r.casualties?.attacker : r.casualties?.defender
    if (myCasualties) {
      stats.total_casualties += Object.values(myCasualties).reduce((a, b) => a + b, 0)
    }
  }

  stats.win_rate = stats.total_battles > 0 ? Math.round((stats.victories / stats.total_battles) * 100) : 0
  return stats
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}
