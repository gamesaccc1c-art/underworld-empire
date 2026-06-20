import type { BuildingDefinitionDB } from '@/types/game'
import { useGameStore } from '@/stores/gameStore'
import { useGuestStore } from '@/stores/guestStore'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RESOURCE_INFO } from '@/lib/game/constants'
import { Castle, Vault, Store, Swords, Users, EyeOff, Wine, Dice5, Car, Shield, Lock, Crown, Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useState } from 'react'
import { toast } from 'sonner'

const iconMap: Record<string, React.FC<{ className?: string }>> = {
  Castle, Vault, Store, Swords, Users, EyeOff, Wine, Dice5, Car, Shield, Lock, Crown,
}

export function NewBuildingCard({ definition, hqLevel }: {
  definition: BuildingDefinitionDB
  hqLevel: number
}) {
  const isGuest = useGuestStore(s => s.isGuest)
  const guestPlayer = useGuestStore(s => s.player)
  const guestAddBuilding = useGuestStore(s => s.addBuilding)
  const guestSpend = useGuestStore(s => s.spendResources)
  const { buildNew, player: authPlayer } = useGameStore()

  const player = isGuest ? guestPlayer : authPlayer
  const [open, setOpen] = useState(false)
  const [isBuilding, setIsBuilding] = useState(false)

  const Icon = iconMap[definition.icon] || Castle
  const isHqRequired = definition.type !== 'headquarters' && hqLevel < definition.required_hq_level
  const baseCosts: Record<string, number> = {}
  if (definition.base_cash > 0)         baseCosts.cash         = definition.base_cash
  if (definition.base_influence > 0)    baseCosts.influence    = definition.base_influence
  if (definition.base_loyalty > 0)      baseCosts.loyalty      = definition.base_loyalty
  if (definition.base_weapon_power > 0) baseCosts.weapon_power = definition.base_weapon_power
  if (definition.base_black_money > 0)  baseCosts.black_money  = definition.base_black_money
  if (definition.base_intel > 0)        baseCosts.intel        = definition.base_intel

  const canAfford = player && Object.entries(baseCosts).every(
    ([res, amount]) => (player[res as keyof typeof player] as number) >= amount
  )

  async function handleBuild() {
    if (isHqRequired) return
    setIsBuilding(true)
    if (isGuest) {
      const guestCosts: Parameters<typeof guestSpend>[0] = {}
      for (const [res, amount] of Object.entries(baseCosts)) {
        (guestCosts as Record<string, number>)[res] = amount
      }
      if (guestSpend(guestCosts)) {
        guestAddBuilding(definition.type)
        toast.success(`${definition.name} kuruldu!`)
        setOpen(false)
      } else {
        toast.error('Yeterli kaynak yok')
      }
    } else {
      await buildNew(definition.type)
      setOpen(false)
    }
    setIsBuilding(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Card className="bg-card/30 border-dashed border-border/30 hover:border-gold/25 hover:bg-card/60 transition-all cursor-pointer group active:scale-95">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-start justify-between">
              <Icon className="h-6 w-6 text-muted-foreground/50 group-hover:text-gold/70 transition-colors" />
              <Plus className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-gold/60" />
            </div>
            <div>
              <p className="text-xs font-medium truncate text-muted-foreground/70 group-hover:text-foreground/80">{definition.name}</p>
              {definition.required_hq_level > 0 ? (
                <p className={`text-[10px] ${hqLevel >= definition.required_hq_level ? 'text-muted-foreground/50' : 'text-destructive/70'}`}>
                  KRG Lv.{definition.required_hq_level}
                </p>
              ) : (
                <p className="text-[10px] text-muted-foreground/50">Kur</p>
              )}
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>

      <DialogContent className="bg-card border-border/50 max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-gold" /> {definition.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{definition.description}</p>

          {definition.production_type && (
            <Badge variant="outline" className="border-neon/30 text-neon">
              +{definition.production_rate} {RESOURCE_INFO[definition.production_type as keyof typeof RESOURCE_INFO]?.name}/saat (Lv.1)
            </Badge>
          )}

          {definition.required_hq_level > 0 && (
            <div className="flex items-center justify-between text-[11px] bg-secondary/30 rounded-lg px-2.5 py-1.5">
              <span className="text-muted-foreground">Karargah Gereksinimi</span>
              <span className={hqLevel >= definition.required_hq_level ? 'text-neon' : 'text-destructive font-semibold'}>
                Lv.{definition.required_hq_level} {hqLevel < definition.required_hq_level ? `(Mevcut: ${hqLevel})` : '✓'}
              </span>
            </div>
          )}

          <div className="bg-secondary/50 rounded-lg p-2.5 space-y-1.5">
            <p className="text-xs font-semibold">İnşaat Maliyeti</p>
            {Object.keys(baseCosts).length === 0 ? (
              <p className="text-xs text-neon">Ücretsiz!</p>
            ) : Object.entries(baseCosts).map(([res, amount]) => (
              <div key={res} className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">{RESOURCE_INFO[res as keyof typeof RESOURCE_INFO]?.name}</span>
                <span className={player && (player[res as keyof typeof player] as number) >= amount ? 'text-neon font-medium' : 'text-destructive font-medium'}>
                  {amount.toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          {isHqRequired ? (
            <p className="text-xs text-destructive text-center">
              Karargah Lv.{definition.required_hq_level} gerekli (Mevcut: {hqLevel})
            </p>
          ) : (
            <Button
              className="w-full gradient-gold text-primary-foreground font-bold"
              disabled={!canAfford || isBuilding}
              onClick={handleBuild}
            >
              <Plus className="h-4 w-4 mr-1" /> İnşaatı Başlat
            </Button>
          )}
          {!canAfford && !isHqRequired && (
            <p className="text-[10px] text-destructive text-center">Yeterli kaynak yok</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
