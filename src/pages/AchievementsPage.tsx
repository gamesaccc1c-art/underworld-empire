import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Trophy, Swords, Building2, Target, Banknote, Users, Zap, Calendar, CircleCheck as CheckCircle2, Gift, Lock, Star } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { useGameStore } from '@/stores/gameStore'
import { useGuestStore } from '@/stores/guestStore'

interface Achievement {
  key: string
  name: string
  description: string
  category: string
  icon: string
  rarity: string
  target_value: number
  reward_type: string | null
  reward_amount: number
  current_value: number
  is_completed: boolean
  completed_at: string | null
  is_claimed: boolean
}

const CATEGORY_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  combat: { label: 'Savas', icon: Swords, color: 'text-red-400' },
  building: { label: 'Insaat', icon: Building2, color: 'text-amber-400' },
  mission: { label: 'Gorev', icon: Target, color: 'text-blue-400' },
  economy: { label: 'Ekonomi', icon: Banknote, color: 'text-green-400' },
  social: { label: 'Sosyal', icon: Users, color: 'text-cyan-400' },
  progression: { label: 'Ilerleme', icon: Zap, color: 'text-gold' },
  retention: { label: 'Sadakat', icon: Calendar, color: 'text-orange-400' },
}

const RARITY_STYLE: Record<string, { bg: string; border: string; text: string; label: string }> = {
  common: { bg: 'bg-secondary/40', border: 'border-border/40', text: 'text-foreground/80', label: 'Yaygın' },
  rare: { bg: 'bg-blue-950/30', border: 'border-blue-800/30', text: 'text-blue-400', label: 'Nadir' },
  epic: { bg: 'bg-purple-950/30', border: 'border-purple-800/30', text: 'text-purple-400', label: 'Epik' },
  legendary: { bg: 'bg-amber-950/30', border: 'border-gold/30', text: 'text-gold', label: 'Efsanevi' },
}

export function AchievementsPage() {
  const isGuest = useGuestStore(s => s.isGuest)
  const loadPlayer = useGameStore(s => s.loadPlayer)
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState('all')

  const load = useCallback(async () => {
    if (isGuest) { setLoading(false); return }
    try {
      const { data } = await supabase.rpc('get_achievements')
      if (data?.ok) setAchievements(data.achievements || [])
    } catch {}
    setLoading(false)
  }, [isGuest])

  useEffect(() => { load() }, [load])

  async function claimReward(key: string) {
    setClaiming(key)
    try {
      const { data } = await supabase.rpc('claim_achievement_reward', { p_achievement_key: key })
      if (data?.ok) {
        toast.success(`Odul alindi! +${data.reward_amount} ${data.reward_type === 'diamonds' ? 'Elmas' : data.reward_type === 'cash' ? 'Nakit' : 'XP'}`)
        await Promise.all([load(), loadPlayer()])
      } else {
        toast.error(data?.error || 'Hata')
      }
    } catch {
      toast.error('Baglanti hatasi')
    }
    setClaiming(null)
  }

  if (isGuest) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[300px] text-center space-y-3">
        <Trophy className="h-12 w-12 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Basarimlar icin hesap olusturun.</p>
      </div>
    )
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-[300px]"><Spinner className="h-6 w-6 text-gold" /></div>
  }

  const completed = achievements.filter(a => a.is_completed).length
  const unclaimed = achievements.filter(a => a.is_completed && !a.is_claimed).length
  const categories = Object.keys(CATEGORY_META)
  const filtered = activeCategory === 'all' ? achievements : achievements.filter(a => a.category === activeCategory)

  return (
    <div className="p-3 space-y-4 pb-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="font-display text-xl font-black tracking-wider text-gold">BASARIMLAR</h1>
        <p className="text-xs text-muted-foreground">Hedeflere ulas, oduller kazan</p>
      </div>

      {/* Progress summary */}
      <Card className="border-gold/20 bg-gradient-to-br from-amber-950/20 to-card">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-gold" />
              <span className="text-sm font-bold">{completed} / {achievements.length}</span>
            </div>
            {unclaimed > 0 && (
              <Badge className="bg-neon/20 text-neon border-neon/30 text-[10px]">
                <Gift className="h-3 w-3 mr-0.5" />{unclaimed} odul bekliyor
              </Badge>
            )}
          </div>
          <Progress value={achievements.length > 0 ? (completed / achievements.length) * 100 : 0} className="h-2.5" />
          <div className="grid grid-cols-4 gap-1.5 text-center">
            {Object.entries(RARITY_STYLE).map(([rarity, style]) => {
              const count = achievements.filter(a => a.rarity === rarity && a.is_completed).length
              const total = achievements.filter(a => a.rarity === rarity).length
              return (
                <div key={rarity} className={`rounded-lg p-1.5 ${style.bg} border ${style.border}`}>
                  <p className={`text-sm font-bold ${style.text}`}>{count}/{total}</p>
                  <p className="text-[9px] text-muted-foreground">{style.label}</p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Category tabs */}
      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList className="w-full overflow-x-auto flex justify-start gap-0.5 h-auto flex-wrap">
          <TabsTrigger value="all" className="text-[10px] h-7 px-2.5">Tumu</TabsTrigger>
          {categories.map(cat => {
            const meta = CATEGORY_META[cat]
            const Icon = meta.icon
            return (
              <TabsTrigger key={cat} value={cat} className="text-[10px] h-7 px-2.5 gap-1">
                <Icon className={`h-3 w-3 ${meta.color}`} />
                {meta.label}
              </TabsTrigger>
            )
          })}
        </TabsList>

        <TabsContent value={activeCategory} className="mt-3 space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Bu kategoride basarim yok</div>
          ) : (
            filtered.map(ach => <AchievementCard key={ach.key} achievement={ach} claiming={claiming} onClaim={claimReward} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function AchievementCard({ achievement: ach, claiming, onClaim }: { achievement: Achievement; claiming: string | null; onClaim: (key: string) => void }) {
  const rarity = RARITY_STYLE[ach.rarity] || RARITY_STYLE.common
  const progress = ach.target_value > 0 ? Math.min(100, (ach.current_value / ach.target_value) * 100) : 0
  const canClaim = ach.is_completed && !ach.is_claimed

  return (
    <Card className={`border ${rarity.border} ${ach.is_completed ? rarity.bg : 'bg-card/40'} transition-all ${canClaim ? 'ring-1 ring-neon/30' : ''}`}>
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${ach.is_completed ? rarity.bg : 'bg-secondary/50'} border ${rarity.border}`}>
            {ach.is_completed ? (
              <Star className={`h-5 w-5 ${rarity.text} fill-current`} />
            ) : (
              <Lock className="h-4 w-4 text-muted-foreground/40" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className={`text-xs font-bold ${ach.is_completed ? rarity.text : 'text-foreground'}`}>{ach.name}</p>
                <p className="text-[10px] text-muted-foreground">{ach.description}</p>
              </div>
              <Badge variant="outline" className={`text-[8px] px-1.5 shrink-0 ${rarity.border} ${rarity.text}`}>
                {rarity.label}
              </Badge>
            </div>

            {/* Progress */}
            {!ach.is_completed && (
              <div className="space-y-0.5">
                <div className="flex justify-between text-[9px] text-muted-foreground">
                  <span>{ach.current_value.toLocaleString()} / {ach.target_value.toLocaleString()}</span>
                  <span>{Math.floor(progress)}%</span>
                </div>
                <Progress value={progress} className="h-1.5" />
              </div>
            )}

            {/* Reward & claim */}
            <div className="flex items-center justify-between">
              {ach.reward_type && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Gift className="h-3 w-3" />
                  <span>+{ach.reward_amount} {ach.reward_type === 'diamonds' ? 'Elmas' : ach.reward_type === 'cash' ? 'Nakit' : 'XP'}</span>
                </div>
              )}
              {canClaim && (
                <Button
                  size="sm"
                  className="h-6 text-[10px] bg-neon/20 border border-neon/30 text-neon hover:bg-neon/30"
                  onClick={() => onClaim(ach.key)}
                  disabled={claiming === ach.key}
                >
                  {claiming === ach.key ? <Spinner className="h-3 w-3" /> : <><CheckCircle2 className="h-3 w-3 mr-0.5" />Odul Al</>}
                </Button>
              )}
              {ach.is_claimed && (
                <span className="text-[10px] text-green-400 flex items-center gap-0.5">
                  <CheckCircle2 className="h-3 w-3" /> Alindi
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
