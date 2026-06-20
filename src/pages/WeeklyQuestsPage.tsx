import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { CircleCheck as CheckCircle2, Trophy, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { useGameStore } from '@/stores/gameStore'

interface WeeklyQuest {
  quest_type: string
  name: string
  description: string
  target_value: number
  reward_cash: number
  reward_diamonds: number
  reward_xp: number
  current_value: number
  is_completed: boolean
  is_claimed: boolean
}

interface WeeklyData {
  week_start: string
  quests: WeeklyQuest[]
}

export function WeeklyQuestsPage() {
  const isGuest = useGameStore(s => !s.session)
  const loadPlayer = useGameStore(s => s.loadPlayer)
  const [data, setData] = useState<WeeklyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (isGuest) { setLoading(false); return }
    const { data: result } = await supabase.rpc('get_weekly_quests')
    if (result?.ok) setData(result as WeeklyData)
    setLoading(false)
  }, [isGuest])

  useEffect(() => { load() }, [load])

  async function claim(questType: string) {
    setClaiming(questType)
    const { data: result } = await supabase.rpc('claim_weekly_quest', { p_quest_type: questType })
    if (result?.ok) {
      toast.success(`Ödül alındı! +${result.cash?.toLocaleString()} Nakit`)
      await Promise.all([load(), loadPlayer()])
    } else {
      toast.error(result?.error || 'Hata')
    }
    setClaiming(null)
  }

  if (loading) return <div className="flex items-center justify-center h-full"><Spinner className="h-6 w-6 text-gold" /></div>
  if (!data) return null

  const weekStart = data.week_start ? new Date(data.week_start).toLocaleDateString('tr-TR') : ''
  const quests = data.quests || []
  const completedCount = quests.filter(q => q.is_completed).length

  return (
    <div className="p-3 space-y-4 pb-6">
      <div className="text-center">
        <h1 className="font-display text-xl font-black tracking-wider text-blue-400">HAFTALIK GÖREVLER</h1>
        <p className="text-xs text-muted-foreground">{weekStart} haftası · {completedCount}/{quests.length} tamamlandı</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Card className="border-blue-900/30 bg-blue-950/20">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Tamamlanan</p>
            <p className="text-2xl font-bold text-blue-400">{completedCount}</p>
          </CardContent>
        </Card>
        <Card className="border-green-900/30 bg-green-950/20">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Talep Edildi</p>
            <p className="text-2xl font-bold text-green-400">{quests.filter(q => q.is_claimed).length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        {quests.map(q => (
          <Card key={q.quest_type} className={`border-border/30 transition-all ${q.is_claimed ? 'opacity-60' : q.is_completed ? 'border-green-800/40 bg-green-950/10' : 'bg-card/50'}`}>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  {q.is_claimed
                    ? <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
                    : q.is_completed
                    ? <Trophy className="h-4 w-4 text-gold shrink-0 mt-0.5" />
                    : <Lock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  }
                  <div>
                    <p className="text-xs font-semibold">{q.name}</p>
                    <p className="text-[10px] text-muted-foreground">{q.description}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {q.reward_diamonds > 0 && <p className="text-xs font-bold text-blue-400">+{q.reward_diamonds}💎</p>}
                  {q.reward_cash > 0 && <p className="text-[10px] text-gold">{(q.reward_cash / 1000).toFixed(0)}K</p>}
                  {q.reward_xp > 0 && <p className="text-[10px] text-green-400">+{q.reward_xp} XP</p>}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{q.current_value.toLocaleString()} / {q.target_value.toLocaleString()}</span>
                  <span>{Math.min(Math.round((q.current_value / q.target_value) * 100), 100)}%</span>
                </div>
                <Progress value={Math.min((q.current_value / q.target_value) * 100, 100)} className="h-1.5" />
              </div>

              {q.is_completed && !q.is_claimed && (
                <Button
                  size="sm"
                  onClick={() => claim(q.quest_type)}
                  disabled={claiming === q.quest_type}
                  className="w-full gradient-gold text-primary-foreground font-bold text-xs h-7"
                >
                  {claiming === q.quest_type ? <Spinner className="h-3 w-3" /> : 'Ödülü Al'}
                </Button>
              )}
              {q.is_claimed && (
                <p className="text-center text-[10px] text-green-400 flex items-center justify-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Talep Edildi
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
