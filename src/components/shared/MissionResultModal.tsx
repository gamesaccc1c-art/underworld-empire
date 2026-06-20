import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CircleCheck as CheckCircle, Circle as XCircle, Shield, Zap, Star } from 'lucide-react'
import { RESOURCE_INFO } from '@/lib/game/constants'

export interface MissionResult {
  ok: boolean
  success?: boolean
  missionName: string
  rewards?: Record<string, number>
  police_raid?: boolean
  raid_penalty?: number
  enforcer_bonus?: number
}

interface Props {
  result: MissionResult
  onClose: () => void
}

export function MissionResultModal({ result, onClose }: Props) {
  const wasRaided = result.police_raid
  const hasBigReward = result.rewards && Object.values(result.rewards).some(v => v >= 1000)

  const rewardEntries = Object.entries(result.rewards ?? {}).filter(([, v]) => v > 0)

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border/50 max-w-xs text-center p-0 overflow-hidden">
        {/* Header band */}
        <div
          className={`relative h-28 flex items-center justify-center ${
            wasRaided
              ? 'bg-gradient-to-b from-red-900/60 via-red-950/40 to-card'
              : 'bg-gradient-to-b from-green-900/50 via-green-950/30 to-card'
          }`}
        >
          <div
            className={`absolute inset-0 ${
              wasRaided
                ? 'bg-[radial-gradient(ellipse_at_center,oklch(0.5_0.22_25/20%)_0%,transparent_70%)]'
                : 'bg-[radial-gradient(ellipse_at_center,oklch(0.7_0.15_150/15%)_0%,transparent_70%)]'
            }`}
          />
          <div className="relative flex flex-col items-center gap-2">
            <div
              className={`h-16 w-16 rounded-full flex items-center justify-center border-2 shadow-lg ${
                wasRaided
                  ? 'bg-red-950/60 border-red-600/60 shadow-red-900/50'
                  : 'bg-green-950/60 border-green-600/50 shadow-green-900/40'
              }`}
            >
              {wasRaided ? (
                <Shield className="h-8 w-8 text-red-400" />
              ) : (
                <CheckCircle className="h-8 w-8 text-green-400" />
              )}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Title */}
          <div className="space-y-1">
            <h2 className={`font-display text-xl font-black tracking-wide ${wasRaided ? 'text-red-400' : 'text-neon'}`}>
              {wasRaided ? 'POLİS BASKINI!' : 'GÖREV TAMAM!'}
            </h2>
            <p className="text-xs text-muted-foreground">{result.missionName}</p>
          </div>

          {/* Police raid result */}
          {wasRaided && (
            <div className="bg-red-950/30 border border-red-800/40 rounded-xl p-3 space-y-1">
              <div className="flex items-center justify-center gap-1.5 text-red-400">
                <XCircle className="h-4 w-4" />
                <span className="text-sm font-bold">Baskın Cezası</span>
              </div>
              {result.raid_penalty && result.raid_penalty > 0 && (
                <p className="text-xs text-red-300">
                  −{result.raid_penalty.toLocaleString()} Nakit kaybedildi
                </p>
              )}
              <p className="text-[10px] text-muted-foreground">
                Polis ısısını düşürmek için İstihbarat kullan.
              </p>
            </div>
          )}

          {/* Rewards */}
          {rewardEntries.length > 0 && (
            <div className="bg-secondary/40 border border-border/30 rounded-xl p-3 space-y-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide flex items-center justify-center gap-1">
                <Star className="h-3 w-3 text-gold" /> Kazanılanlar
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {rewardEntries.map(([key, val]) => {
                  const info = RESOURCE_INFO[key as keyof typeof RESOURCE_INFO]
                  return (
                    <div key={key} className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">{key === 'xp' ? 'XP' : info?.name || key}</span>
                      <span className={`font-bold ${key === 'xp' ? 'text-blue-400' : info?.color || 'text-neon'}`}>
                        +{val.toLocaleString()}
                      </span>
                    </div>
                  )
                })}
              </div>
              {result.enforcer_bonus && result.enforcer_bonus > 0 ? (
                <p className="text-[10px] text-gold flex items-center justify-center gap-1 pt-1 border-t border-border/20">
                  <Zap className="h-3 w-3" /> +{result.enforcer_bonus}% Enforcer bonusu
                </p>
              ) : null}
            </div>
          )}

          {hasBigReward && !wasRaided && (
            <p className="text-[10px] text-gold font-semibold animate-pulse">
              Büyük vurgun! 💰
            </p>
          )}

          <Button
            className={`w-full font-bold ${wasRaided ? 'bg-secondary/60 border border-border/40 text-foreground hover:bg-secondary' : 'gradient-gold text-primary-foreground'}`}
            variant={wasRaided ? 'outline' : 'default'}
            onClick={onClose}
          >
            {wasRaided ? 'Kapat' : 'Harika!'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
