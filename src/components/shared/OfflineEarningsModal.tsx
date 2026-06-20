import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Clock, Sparkles, Loader as Loader2 } from 'lucide-react'
import { useGameStore } from '@/stores/gameStore'
import { useGuestStore } from '@/stores/guestStore'
import { RESOURCE_INFO } from '@/lib/game/constants'
import * as db from '@/lib/supabase/database'

const STORAGE_KEY = 'uw-last-visit'
const MIN_AWAY_MINUTES = 10

export function OfflineEarningsModal() {
  const [awayMinutes, setAwayMinutes] = useState(0)
  const [show, setShow] = useState(false)
  const [collecting, setCollecting] = useState(false)
  const [totals, setTotals] = useState<Record<string, number> | null>(null)
  const isGuest = useGuestStore(s => s.isGuest)
  const player = useGameStore(s => s.player)
  const loadPlayer = useGameStore(s => s.loadPlayer)
  const loadBuildings = useGameStore(s => s.loadBuildings)

  useEffect(() => {
    const lastVisit = localStorage.getItem(STORAGE_KEY)
    localStorage.setItem(STORAGE_KEY, String(Date.now()))

    if (!lastVisit) return
    if (isGuest || !player) return

    const awayMs = Date.now() - Number(lastVisit)
    const mins = Math.floor(awayMs / 60000)

    if (mins >= MIN_AWAY_MINUTES) {
      setAwayMinutes(mins)
      setShow(true)
      autoCollect()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGuest, player?.id])

  async function autoCollect() {
    setCollecting(true)
    try {
      const result = await db.collectAllProduction()
      if (result.ok && result.collected > 0) {
        setTotals(result.totals)
        await Promise.all([loadPlayer(), loadBuildings()])
      } else {
        setTotals({})
      }
    } catch {
      setTotals({})
    }
    setCollecting(false)
  }

  if (!show) return null

  const hours = Math.floor(awayMinutes / 60)
  const mins = awayMinutes % 60
  const timeStr = hours > 0 ? `${hours} saat ${mins > 0 ? `${mins} dk` : ''}` : `${mins} dakika`

  const earnedEntries = Object.entries(totals ?? {}).filter(([, v]) => v > 0)
  const hasEarnings = earnedEntries.length > 0

  return (
    <Dialog open={true} onOpenChange={() => setShow(false)}>
      <DialogContent className="bg-card border-border/50 max-w-xs p-0 overflow-hidden">
        {/* Header */}
        <div className="relative h-20 bg-gradient-to-b from-amber-900/50 via-amber-950/30 to-card flex items-center justify-center">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.78_0.15_75/15%)_0%,transparent_70%)]" />
          <div className="relative flex flex-col items-center gap-1">
            <Sparkles className="h-8 w-8 text-gold" />
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          <DialogHeader>
            <DialogTitle className="text-center font-display text-base text-gold tracking-wide">
              Tekrar Hosgeldin!
            </DialogTitle>
          </DialogHeader>

          <p className="text-xs text-muted-foreground text-center">
            <span className="text-gold font-bold">{timeStr}</span> uzaktaydiniz.
          </p>

          {/* Earnings card */}
          <div className="bg-gradient-to-br from-amber-950/30 to-card border border-gold/20 rounded-xl p-4 space-y-3">
            {collecting ? (
              <div className="flex flex-col items-center gap-2 py-2">
                <Loader2 className="h-6 w-6 text-gold animate-spin" />
                <p className="text-xs text-muted-foreground">Uretim toplanıyor...</p>
              </div>
            ) : hasEarnings ? (
              <>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide text-center">
                  Toplanan Uretim
                </p>
                <div className="space-y-1.5">
                  {earnedEntries.map(([key, val]) => {
                    const info = RESOURCE_INFO[key as keyof typeof RESOURCE_INFO]
                    return (
                      <div key={key} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{info?.name || key}</span>
                        <span className={`font-bold tabular-nums ${info?.color || 'text-neon'}`}>
                          +{val.toLocaleString()}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="text-center space-y-1">
                <Clock className="h-6 w-6 text-muted-foreground/50 mx-auto" />
                <p className="text-xs text-muted-foreground">Bekleyen uretim bulunamadi.</p>
                <p className="text-[10px] text-muted-foreground/60">Uretim binalari kurun!</p>
              </div>
            )}
          </div>

          <Button
            className="w-full gradient-gold text-primary-foreground text-xs font-bold"
            onClick={() => setShow(false)}
            disabled={collecting}
          >
            {collecting ? 'Toplanıyor...' : hasEarnings ? 'Harika! Devam Et' : 'Devam Et'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
