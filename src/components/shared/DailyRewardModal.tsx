import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useGuestStore } from '@/stores/guestStore'
import { useGameStore } from '@/stores/gameStore'
import * as db from '@/lib/supabase/database'
import { toast } from 'sonner'
import { Gift, Flame, Banknote, Gem, CircleCheck as CheckCircle } from 'lucide-react'

const DAILY_REWARDS = [
  { day: 1, cash: 1000, diamonds: 0 },
  { day: 2, cash: 2000, diamonds: 0 },
  { day: 3, cash: 3000, diamonds: 10 },
  { day: 4, cash: 5000, diamonds: 0 },
  { day: 5, cash: 5000, diamonds: 20 },
  { day: 6, cash: 8000, diamonds: 0 },
  { day: 7, cash: 10000, diamonds: 50 },
]

export function DailyRewardModal() {
  const isGuest = useGuestStore(s => s.isGuest)
  const claimedDailyReward = useGuestStore(s => s.claimedDailyReward)
  const claimDailyReward = useGuestStore(s => s.claimDailyReward)
  const dailyLoginStreak = useGuestStore(s => s.dailyLoginStreak)
  const guestAddResources = useGuestStore(s => s.addResources)
  const loadPlayer = useGameStore(s => s.loadPlayer)

  const [open, setOpen] = useState(false)
  const [claimed, setClaimed] = useState(false)
  const [shownThisSession, setShownThisSession] = useState(false)

  const today = new Date().toDateString()
  const canClaim = claimedDailyReward !== today

  useEffect(() => {
    const isLoggedIn = isGuest || useGameStore.getState().session !== null
    if (isLoggedIn && canClaim && !shownThisSession) {
      const timer = setTimeout(() => {
        setOpen(true)
        setShownThisSession(true)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [isGuest, canClaim, shownThisSession])

  const streakDay = Math.min(7, (dailyLoginStreak % 7) + 1)
  const reward = DAILY_REWARDS[streakDay - 1]

  async function handleClaim() {
    if (isGuest) {
      claimDailyReward()
      guestAddResources({ cash: reward.cash, diamonds: reward.diamonds })
      setClaimed(true)
      setTimeout(() => { setOpen(false); setClaimed(false) }, 2000)
      return
    }

    // Auth: server RPC enforces one-per-day with server time
    const result = await db.claimDailyReward()
    if (!result.ok) {
      toast.error(result.error || 'Gunluk odul alinamadi')
      setOpen(false)
      return
    }
    await loadPlayer()
    setClaimed(true)
    toast.success(`+${result.cash?.toLocaleString()} Nakit${result.diamonds ? ` +${result.diamonds} Elmas` : ''} kazandin!`)
    setTimeout(() => { setOpen(false); setClaimed(false) }, 2000)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="bg-card border-gold/20 max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gold">
            <Gift className="h-5 w-5" />
            Gunluk Odulun Hazir!
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Streak calendar */}
          <div className="grid grid-cols-7 gap-1">
            {DAILY_REWARDS.map((r, i) => {
              const dayNum = i + 1
              const isPast = dayNum < streakDay
              const isCurrent = dayNum === streakDay
              return (
                <div
                  key={dayNum}
                  className={`rounded-lg p-1.5 text-center border transition-all ${
                    isCurrent
                      ? 'border-gold/60 bg-amber-950/40 glow-gold'
                      : isPast
                      ? 'border-border/30 bg-secondary/30 opacity-50'
                      : 'border-border/20 bg-secondary/20'
                  }`}
                >
                  <p className="text-[9px] text-muted-foreground">G{dayNum}</p>
                  {r.diamonds > 0 ? (
                    <Gem className={`h-3 w-3 mx-auto mt-0.5 ${isCurrent ? 'text-cyan-400' : 'text-muted-foreground'}`} />
                  ) : (
                    <Banknote className={`h-3 w-3 mx-auto mt-0.5 ${isCurrent ? 'text-gold' : 'text-muted-foreground'}`} />
                  )}
                </div>
              )
            })}
          </div>

          {/* Current reward */}
          <div className="bg-gradient-to-br from-amber-950/40 to-card border border-gold/20 rounded-xl p-4 text-center space-y-2">
            <div className="flex items-center justify-center gap-1">
              <Flame className="h-4 w-4 text-orange-400" />
              <span className="text-xs text-muted-foreground">{streakDay} Gunluk Seri</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-2">
                <Banknote className="h-5 w-5 text-green-400" />
                <span className="text-xl font-bold text-gold">+{reward.cash.toLocaleString()}</span>
                <span className="text-xs text-muted-foreground">Nakit</span>
              </div>
              {reward.diamonds > 0 && (
                <div className="flex items-center justify-center gap-2">
                  <Gem className="h-4 w-4 text-cyan-400" />
                  <span className="text-lg font-bold text-cyan-400">+{reward.diamonds}</span>
                  <span className="text-xs text-muted-foreground">Elmas</span>
                </div>
              )}
            </div>
          </div>

          {claimed ? (
            <div className="text-center py-2">
              <CheckCircle className="h-8 w-8 text-neon mx-auto mb-1" />
              <p className="text-sm font-bold text-neon">Toplandı!</p>
            </div>
          ) : (
            <Button className="w-full gradient-gold text-primary-foreground font-bold py-5" onClick={handleClaim}>
              <Gift className="h-4 w-4 mr-2" />
              Odulu Topla
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
