import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { Calendar, CircleCheck as CheckCircle2, Gift, Flame, Star, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { useGameStore } from '@/stores/gameStore'
import { useGuestStore } from '@/stores/guestStore'
import * as db from '@/lib/supabase/database'

interface QuestDef {
  quest_type: string
  name: string
  description: string
  points: number
  target_value: number
  current_value: number
  is_completed: boolean
}

interface Threshold {
  id: number
  required_points: number
  chest_type: 'bronze' | 'silver' | 'gold'
  is_claimed: boolean
}

interface LoginReward {
  day_number: number
  cash: number
  diamonds: number
  xp: number
  label: string
}

interface LoginStreak {
  current_day: number
  last_claim_date: string | null
  total_claims: number
}

interface DailyData {
  quests: QuestDef[]
  total_points: number
  thresholds: Threshold[]
  login_streak: LoginStreak
  login_rewards: LoginReward[]
}

const CHEST_COLORS = {
  bronze: { bg: 'bg-amber-900/30 border-amber-700/40', text: 'text-amber-400', label: 'Bronz' },
  silver: { bg: 'bg-gray-700/30 border-gray-500/40', text: 'text-gray-300', label: 'Gümüş' },
  gold: { bg: 'bg-yellow-900/30 border-yellow-600/40', text: 'text-yellow-400', label: 'Altın' },
}

export function DailyQuestsPage() {
  const isGuest = useGuestStore(s => s.isGuest)
  const loadPlayer = useGameStore(s => s.loadPlayer)
  const [data, setData] = useState<DailyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [claiming, setClaiming] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (isGuest) { setLoading(false); return }
    try {
      const { data: result } = await supabase.rpc('get_daily_quests')
      if (result?.ok) setData(result as DailyData)
      else setLoadError(true)
    } catch {
      setLoadError(true)
    }
    setLoading(false)
  }, [isGuest])

  useEffect(() => { load() }, [load])

  async function claimLogin() {
    setClaiming('login')
    const { data: result } = await supabase.rpc('claim_daily_login')
    if (result?.ok) {
      toast.success(`Gün ${result.day} ödülü alındı! +${result.cash?.toLocaleString()} Nakit`)
      await Promise.all([load(), loadPlayer()])
    } else {
      toast.error(result?.error || 'Hata')
    }
    setClaiming(null)
  }

  async function claimThreshold(id: number) {
    setClaiming(`t_${id}`)
    const { data: result } = await supabase.rpc('claim_daily_threshold', { p_threshold_id: id })
    if (result?.ok) {
      toast.success('Sandık ödülü alındı!')
      await Promise.all([load(), loadPlayer()])
    } else {
      toast.error(result?.error || 'Hata')
    }
    setClaiming(null)
  }

  if (isGuest) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-full text-center space-y-3">
        <Calendar className="h-12 w-12 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Günlük ödüller için giriş yap.</p>
        <Button size="sm" onClick={() => db.getOrCreatePlayer('', '')}>Giriş Yap</Button>
      </div>
    )
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Spinner className="h-6 w-6 text-gold" /></div>
  }

  if (!data) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[200px] text-center space-y-3">
        <Calendar className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{loadError ? 'Gorevler yuklenemedi' : 'Gorev verisi bulunamadi'}</p>
        <Button size="sm" variant="outline" onClick={() => { setLoading(true); setLoadError(false); load() }}>
          Tekrar Dene
        </Button>
      </div>
    )
  }

  const today = new Date().toISOString().split('T')[0]
  const canClaimLogin = data.login_streak.last_claim_date !== today

  return (
    <div className="p-3 space-y-4 pb-6">
      <div className="text-center">
        <h1 className="font-display text-xl font-black tracking-wider text-gold">GÜNLÜK GÖREVLER</h1>
        <p className="text-xs text-muted-foreground">Her gün tamamla, ödüllerini topla</p>
      </div>

      {/* Login Streak */}
      <Card className="border-gold/20 bg-gradient-to-br from-amber-950/30 to-card">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-gold" />
              <span className="text-sm font-bold">Günlük Giriş Serisi</span>
            </div>
            <span className="text-xs text-muted-foreground">{data.login_streak.total_claims} gün toplam</span>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {(data.login_rewards || []).map(r => {
              const current = data.login_streak.current_day
              const claimed = !canClaimLogin && r.day_number === current
              const past = r.day_number < current
              const isToday = r.day_number === (canClaimLogin ? current : current)
              return (
                <div
                  key={r.day_number}
                  className={`flex flex-col items-center rounded-lg p-1.5 border text-center ${
                    claimed || past
                      ? 'bg-gold/20 border-gold/40'
                      : isToday && canClaimLogin
                      ? 'bg-amber-900/40 border-gold/60 ring-1 ring-gold/40'
                      : 'bg-card/50 border-border/30'
                  }`}
                >
                  <span className="text-[9px] text-muted-foreground">G{r.day_number}</span>
                  {r.diamonds > 0
                    ? <Star className="h-3 w-3 text-blue-400 my-0.5" />
                    : <Gift className="h-3 w-3 text-gold my-0.5" />
                  }
                  {r.diamonds > 0
                    ? <span className="text-[9px] text-blue-300 font-bold">+{r.diamonds}💎</span>
                    : <span className="text-[9px] text-gold/80">{(r.cash / 1000).toFixed(0)}K</span>
                  }
                </div>
              )
            })}
          </div>
          <Button
            onClick={claimLogin}
            disabled={!canClaimLogin || claiming === 'login'}
            className="w-full gradient-gold text-primary-foreground font-bold"
          >
            {claiming === 'login' ? <Spinner className="h-4 w-4" /> : canClaimLogin ? 'Günlük Ödülü Al' : 'Yarın Tekrar Gel'}
          </Button>
          {!canClaimLogin && (
            <p className="text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1">
              <Clock className="h-3 w-3" /> Sonraki ödül yarın sıfırlanır
            </p>
          )}
        </CardContent>
      </Card>

      {/* Quest points progress */}
      <Card className="border-border/40">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">Görev Puanları</span>
            <span className="text-sm font-bold text-gold">{data.total_points} / 100 puan</span>
          </div>
          <Progress value={Math.min(data.total_points, 100)} className="h-3" />
          <div className="grid grid-cols-5 gap-1.5">
            {(data.thresholds || []).map(t => {
              const reachable = data.total_points >= t.required_points
              const c = CHEST_COLORS[t.chest_type]
              return (
                <button
                  key={t.id}
                  onClick={() => !t.is_claimed && reachable && claimThreshold(t.id)}
                  disabled={t.is_claimed || !reachable || claiming === `t_${t.id}`}
                  className={`flex flex-col items-center rounded-xl p-2 border transition-all ${c.bg} ${
                    t.is_claimed ? 'opacity-50' : reachable ? 'ring-1 ring-white/20 cursor-pointer hover:ring-white/40' : 'opacity-40 cursor-not-allowed'
                  }`}
                >
                  <span className="text-lg">📦</span>
                  <span className={`text-[9px] font-bold ${c.text}`}>{c.label}</span>
                  <span className="text-[8px] text-muted-foreground">{t.required_points}p</span>
                  {t.is_claimed && <CheckCircle2 className="h-3 w-3 text-green-400 mt-0.5" />}
                  {claiming === `t_${t.id}` && <Spinner className="h-3 w-3 mt-0.5" />}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Daily quests list */}
      <div className="space-y-2">
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">Günlük Görevler</h2>
        {(data.quests || []).map(q => (
          <Card key={q.quest_type} className={`border-border/30 transition-all ${q.is_completed ? 'bg-green-950/20 border-green-800/30' : 'bg-card/50'}`}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  {q.is_completed
                    ? <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                    : <div className="h-4 w-4 rounded-full border border-border/60 shrink-0" />
                  }
                  <div>
                    <p className="text-xs font-semibold">{q.name}</p>
                    <p className="text-[10px] text-muted-foreground">{q.description}</p>
                  </div>
                </div>
                <span className={`text-sm font-bold tabular-nums ${q.is_completed ? 'text-green-400' : 'text-gold'}`}>+{q.points}p</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{q.current_value} / {q.target_value}</span>
                  {q.is_completed && <span className="text-green-400 font-medium">Tamamlandı</span>}
                </div>
                <Progress value={Math.min((q.current_value / q.target_value) * 100, 100)} className="h-1.5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
