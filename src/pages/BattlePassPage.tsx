import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Badge } from '@/components/ui/badge'
import { CircleCheck as CheckCircle2, Lock, Star, Crown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { useGameStore } from '@/stores/gameStore'

interface BpLevel {
  level_number: number
  xp_required: number
  free_reward_type: string
  free_reward_amount: number
  premium_reward_type: string
  premium_reward_amount: number
  free_claimed: boolean
  premium_claimed: boolean
}

interface BpProgress {
  current_level: number
  current_xp: number
  total_xp: number
  is_premium: boolean
}

interface BpSeason {
  id: string
  season_number: number
  name: string
  starts_at: string
  ends_at: string
  premium_cost_diamonds: number
}

interface BpData {
  season: BpSeason
  progress: BpProgress
  levels: BpLevel[]
}

const REWARD_ICONS: Record<string, string> = { cash: '💰', diamonds: '💎', xp: '⭐' }
const REWARD_COLORS: Record<string, string> = { cash: 'text-gold', diamonds: 'text-blue-400', xp: 'text-green-400' }

function formatReward(type: string, amount: number) {
  if (!type) return null
  const icon = REWARD_ICONS[type] || '🎁'
  const color = REWARD_COLORS[type] || 'text-white'
  const fmt = type === 'cash' ? `${(amount / 1000).toFixed(0)}K` : `${amount}`
  return { icon, color, fmt }
}

export function BattlePassPage() {
  const loadPlayer = useGameStore(s => s.loadPlayer)
  const session = useGameStore(s => s.session)
  const [data, setData] = useState<BpData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [unlocking, setUnlocking] = useState(false)

  const load = useCallback(async () => {
    if (!session) { setLoading(false); return }
    try {
      const { data: result } = await supabase.rpc('get_battle_pass')
      if (result?.ok) setData(result as BpData)
      else setLoadError(true)
    } catch {
      setLoadError(true)
    }
    setLoading(false)
  }, [session])

  useEffect(() => { load() }, [load])

  async function claimReward(levelNumber: number, track: 'free' | 'premium') {
    const key = `${levelNumber}_${track}`
    setClaiming(key)
    const { data: result } = await supabase.rpc('claim_bp_reward', { p_level_number: levelNumber, p_track: track })
    if (result?.ok) {
      toast.success(`Ödül alındı!`)
      await Promise.all([load(), loadPlayer()])
    } else {
      toast.error(result?.error || 'Hata')
    }
    setClaiming(null)
  }

  async function unlockPremium() {
    setUnlocking(true)
    const { data: result } = await supabase.rpc('unlock_premium_pass')
    if (result?.ok) {
      toast.success('Premium Battle Pass açıldı!')
      await Promise.all([load(), loadPlayer()])
    } else {
      toast.error(result?.error || 'Yetersiz elmas')
    }
    setUnlocking(false)
  }

  if (!session) return (
    <div className="p-4 flex flex-col items-center justify-center h-full text-center space-y-3">
      <Crown className="h-12 w-12 text-gold" />
      <p className="text-sm text-muted-foreground">Battle Pass için giriş yapman gerekiyor.</p>
    </div>
  )

  if (loading) return <div className="flex items-center justify-center h-full"><Spinner className="h-6 w-6 text-gold" /></div>
  if (!data) return (
    <div className="p-4 flex flex-col items-center justify-center min-h-[200px] text-center space-y-3">
      <Crown className="h-10 w-10 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{loadError ? 'Battle Pass yuklenemedi' : 'Aktif sezon bulunamadi'}</p>
      <Button size="sm" variant="outline" onClick={() => { setLoading(true); setLoadError(false); load() }}>
        Tekrar Dene
      </Button>
    </div>
  )

  const { season, progress, levels } = data
  const daysLeft = Math.max(0, Math.ceil((new Date(season.ends_at).getTime() - Date.now()) / 86400000))
  const nextLevelXp = levels.find(l => l.level_number === progress.current_level)?.xp_required || 200

  return (
    <div className="p-3 space-y-4 pb-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-amber-950/50 to-card border border-gold/20 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-lg font-black tracking-wider text-gold">{season.name}</h1>
            <p className="text-xs text-muted-foreground">{daysLeft} gün kaldı</p>
          </div>
          {progress.is_premium
            ? <Badge className="bg-gold/20 text-gold border-gold/40"><Crown className="h-3 w-3 mr-1" />Premium</Badge>
            : <Button size="sm" onClick={unlockPremium} disabled={unlocking}
                className="gradient-gold text-primary-foreground font-bold text-xs">
                {unlocking ? <Spinner className="h-3 w-3" /> : <><Crown className="h-3 w-3 mr-1" />{season.premium_cost_diamonds}💎</>}
              </Button>
          }
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Seviye {progress.current_level}</span>
            <span>{progress.current_xp} / {nextLevelXp} XP</span>
          </div>
          <div className="h-3 bg-secondary/50 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min((progress.current_xp / nextLevelXp) * 100, 100)}%`,
                background: 'linear-gradient(90deg, oklch(0.65 0.18 75), oklch(0.78 0.15 75))'
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Seviye</p>
            <p className="text-lg font-bold text-gold">{progress.current_level}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Toplam XP</p>
            <p className="text-lg font-bold text-blue-400">{progress.total_xp.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">İz</p>
            <p className="text-lg font-bold">{progress.is_premium ? '⭐' : '🆓'}</p>
          </div>
        </div>
      </div>

      {/* Levels */}
      <div className="space-y-1.5">
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
          <Star className="h-3.5 w-3.5" /> Seviyeler
        </h2>
        {(levels || []).map(lvl => {
          const unlocked = progress.current_level >= lvl.level_number
          const freeReward = formatReward(lvl.free_reward_type, lvl.free_reward_amount)
          const premReward = formatReward(lvl.premium_reward_type, lvl.premium_reward_amount)
          const isCurrentLevel = progress.current_level === lvl.level_number

          return (
            <div
              key={lvl.level_number}
              className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all ${
                !unlocked ? 'opacity-50 bg-card/30 border-border/20'
                : isCurrentLevel ? 'bg-amber-950/30 border-gold/30'
                : 'bg-card/50 border-border/20'
              }`}
            >
              {/* Level number */}
              <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${unlocked ? 'bg-gold/20 text-gold' : 'bg-secondary/50 text-muted-foreground'}`}>
                {lvl.level_number}
              </div>

              {/* Free track */}
              <div className="flex-1 flex items-center gap-1.5">
                <div className={`flex-1 flex flex-col items-center justify-center rounded-lg p-1.5 border ${lvl.free_claimed ? 'bg-green-950/30 border-green-800/30' : unlocked ? 'bg-card border-border/30 cursor-pointer hover:border-gold/30' : 'bg-secondary/20 border-border/10'}`}>
                  {freeReward && (
                    <>
                      <span className="text-sm">{freeReward.icon}</span>
                      <span className={`text-[9px] font-bold ${freeReward.color}`}>{freeReward.fmt}</span>
                    </>
                  )}
                  {unlocked && !lvl.free_claimed && freeReward && (
                    <button
                      onClick={() => claimReward(lvl.level_number, 'free')}
                      disabled={claiming === `${lvl.level_number}_free`}
                      className="mt-0.5 text-[8px] bg-gold/20 hover:bg-gold/30 text-gold px-1.5 py-0.5 rounded transition-colors"
                    >
                      {claiming === `${lvl.level_number}_free` ? '...' : 'Al'}
                    </button>
                  )}
                  {lvl.free_claimed && <CheckCircle2 className="h-3 w-3 text-green-400 mt-0.5" />}
                </div>

                {/* Premium track */}
                <div className={`flex-1 flex flex-col items-center justify-center rounded-lg p-1.5 border ${lvl.premium_claimed ? 'bg-green-950/30 border-green-800/30' : progress.is_premium && unlocked ? 'bg-amber-950/20 border-gold/20 cursor-pointer hover:border-gold/40' : 'bg-secondary/20 border-border/10'}`}>
                  {premReward && (
                    <>
                      <span className="text-sm">{premReward.icon}</span>
                      <span className={`text-[9px] font-bold ${premReward.color}`}>{premReward.fmt}</span>
                    </>
                  )}
                  {progress.is_premium && unlocked && !lvl.premium_claimed && premReward && (
                    <button
                      onClick={() => claimReward(lvl.level_number, 'premium')}
                      disabled={claiming === `${lvl.level_number}_premium`}
                      className="mt-0.5 text-[8px] bg-gold/20 hover:bg-gold/30 text-gold px-1.5 py-0.5 rounded transition-colors"
                    >
                      {claiming === `${lvl.level_number}_premium` ? '...' : 'Al'}
                    </button>
                  )}
                  {lvl.premium_claimed && <CheckCircle2 className="h-3 w-3 text-green-400 mt-0.5" />}
                  {!progress.is_premium && !unlocked && <Lock className="h-3 w-3 text-muted-foreground/40 mt-0.5" />}
                  {!progress.is_premium && unlocked && !lvl.premium_claimed && <Crown className="h-3 w-3 text-gold/40 mt-0.5" />}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* XP sources reminder */}
      <Card className="border-border/30 bg-card/40">
        <CardContent className="p-3 space-y-1">
          <p className="text-xs font-semibold text-muted-foreground">XP Kaynakları</p>
          <div className="grid grid-cols-2 gap-1 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1"><ChevronRight className="h-3 w-3" />Görev Tamamla +50</div>
            <div className="flex items-center gap-1"><ChevronRight className="h-3 w-3" />Günlük Giriş +50</div>
            <div className="flex items-center gap-1"><ChevronRight className="h-3 w-3" />Eşik Sandığı +100</div>
            <div className="flex items-center gap-1"><ChevronRight className="h-3 w-3" />Haftalık Görev +200</div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
