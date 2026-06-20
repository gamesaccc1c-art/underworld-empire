import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Star, Zap, TrendingUp } from 'lucide-react'

interface Props {
  level: number
  onClose: () => void
}

export function LevelUpModal({ level, onClose }: Props) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-gold/30 max-w-xs text-center p-0 overflow-hidden">
        {/* Animated top gradient */}
        <div className="relative h-28 bg-gradient-to-b from-amber-900/60 via-amber-950/40 to-card flex items-center justify-center">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.78_0.15_75/20%)_0%,transparent_70%)]" />
          <div className="relative flex flex-col items-center gap-1">
            <div className="relative">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-amber-500/30 to-amber-900/60 border-2 border-gold/60 flex items-center justify-center shadow-[0_0_30px_oklch(0.78_0.15_75/40%)]">
                <span className="font-display text-3xl font-black text-gold leading-none">{level}</span>
              </div>
              <div className="absolute -top-1 -right-1 h-6 w-6 bg-gold rounded-full flex items-center justify-center border-2 border-card">
                <Star className="h-3.5 w-3.5 text-primary-foreground fill-current" />
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="space-y-1">
            <h2 className="font-display text-2xl font-black text-gold tracking-wide">
              SEVİYE {level}!
            </h2>
            <p className="text-xs text-muted-foreground">
              Tebrikler! Yeni bir seviyeye ulaştınız.
            </p>
          </div>

          {/* Bonus summary */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-secondary/40 border border-border/30 rounded-xl p-2.5 flex flex-col items-center gap-1">
              <Zap className="h-4 w-4 text-gold" />
              <span className="text-[10px] text-muted-foreground">Güç Artışı</span>
              <span className="text-sm font-black text-gold">+{level * 20}</span>
            </div>
            <div className="bg-secondary/40 border border-border/30 rounded-xl p-2.5 flex flex-col items-center gap-1">
              <TrendingUp className="h-4 w-4 text-neon" />
              <span className="text-[10px] text-muted-foreground">Yeni Seviye</span>
              <span className="text-sm font-black text-neon">{level}</span>
            </div>
          </div>

          <Button className="w-full gradient-gold text-primary-foreground font-bold" onClick={onClose}>
            Devam Et
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
