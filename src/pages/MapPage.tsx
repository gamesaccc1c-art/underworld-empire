import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RESOURCE_INFO } from '@/lib/game/constants'
import { MapPin, Shield, Lock, Swords, Crown, Zap, Coins, Users, Clock, Trophy, RefreshCw } from 'lucide-react'
import { useGuestStore } from '@/stores/guestStore'
import { useGameStore } from '@/stores/gameStore'
import { toast } from 'sonner'
import * as db from '@/lib/supabase/database'
import type { Territory, TerritoryWar, Family } from '@/types/game'

const districtNames: Record<string, string> = {
  harbor: 'Liman Bolgesi',
  industrial: 'Sanayi Bolgesi',
  nightlife: 'Eglence Bolgesi',
  finance: 'Finans Bolgesi',
  old_quarter: 'Eski Mahalle',
  underground: 'Yeralti',
  downtown: 'Sehir Merkezi',
}

const districtColors: Record<string, string> = {
  harbor: 'from-blue-950/50 to-blue-900/20 border-blue-800/40',
  industrial: 'from-orange-950/50 to-orange-900/20 border-orange-800/40',
  nightlife: 'from-pink-950/50 to-pink-900/20 border-pink-800/40',
  finance: 'from-emerald-950/50 to-emerald-900/20 border-emerald-800/40',
  old_quarter: 'from-stone-950/50 to-stone-900/20 border-stone-600/40',
  underground: 'from-violet-950/50 to-violet-900/20 border-violet-800/40',
  downtown: 'from-cyan-950/50 to-cyan-900/20 border-cyan-800/40',
}

const districtIcon: Record<string, React.ElementType> = {
  harbor: Shield,
  industrial: Swords,
  nightlife: Zap,
  finance: Coins,
  old_quarter: Users,
  underground: Lock,
  downtown: Crown,
}

export function MapPage() {
  const isGuest = useGuestStore(s => s.isGuest)
  const guestPlayer = useGuestStore(s => s.player)
  const authPlayer = useGameStore(s => s.player)
  const player = isGuest ? guestPlayer : authPlayer

  const [territories, setTerritories] = useState<Territory[]>([])
  const [wars, setWars] = useState<TerritoryWar[]>([])
  const [families, setFamilies] = useState<Family[]>([])
  const [selectedTerritory, setSelectedTerritory] = useState<Territory | null>(null)
  const [selectedWar, setSelectedWar] = useState<TerritoryWar | null>(null)
  const [troopType, setTroopType] = useState('street_thugs')
  const [troopAmount, setTroopAmount] = useState('10')
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(!isGuest)
  const [loadError, setLoadError] = useState(false)

  const loadData = useCallback(async () => {
    if (isGuest) return
    try {
      setLoadError(false)
      const [t, w, f] = await Promise.all([
        db.getTerritories(),
        db.getTerritoryWars(),
        db.getFamilies(),
      ])
      setTerritories(t)
      setWars(w)
      setFamilies(f)
    } catch {
      setLoadError(true)
      toast.error('Harita verileri yuklenemedi')
    } finally {
      setInitialLoading(false)
    }
  }, [isGuest])

  useEffect(() => { loadData() }, [loadData])

  const familyMap = new Map(families.map(f => [f.id, f]))
  const playerLevel = player?.level || 1
  const playerFamilyId = player?.family_id || null

  const controlled = territories.filter(t => t.owner_family_id && t.owner_family_id === playerFamilyId).length
  const contested = wars.filter(w => w.status === 'active').length
  const free = territories.filter(t => !t.owner_family_id).length

  async function handleStartWar(territoryId: string) {
    setLoading(true)
    const result = await db.startTerritoryWar(territoryId)
    setLoading(false)
    if (!result.ok) { toast.error(result.error); return }
    toast.success('Bolge savasi baslatildi!')
    setSelectedTerritory(null)
    await loadData()
  }

  async function handleContribute() {
    if (!selectedWar) return
    const amount = parseInt(troopAmount)
    if (!amount || amount <= 0) { toast.error('Gecersiz miktar'); return }
    setLoading(true)
    const result = await db.contributeToWar(selectedWar.id, troopType, amount)
    setLoading(false)
    if (!result.ok) { toast.error(result.error); return }
    toast.success(`+${result.points_added} puan eklendi!`)
    setSelectedWar(null)
    await loadData()
  }

  async function handleClaimReward() {
    setLoading(true)
    const result = await db.claimTerritoryReward()
    setLoading(false)
    if (!result.ok) { toast.error(result.error); return }
    const rewards = result.rewards || {}
    const text = Object.entries(rewards).map(([k, v]) => `+${v} ${k}`).join(', ')
    toast.success(`Bolge geliri toplandı! ${text}`)
    await useGameStore.getState().loadPlayer()
  }

  function getActiveWar(territoryId: string) {
    return wars.find(w => w.territory_id === territoryId && w.status === 'active')
  }

  function getTimeLeft(endsAt: string) {
    const diff = new Date(endsAt).getTime() - Date.now()
    if (diff <= 0) return 'Bitti'
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    return `${h}s ${m}d`
  }

  return (
    <div className="p-3 space-y-4 pb-6">
      <div className="text-center">
        <h1 className="font-display text-xl font-black tracking-wider text-gold">SEHIR HARITASI</h1>
        <p className="text-xs text-muted-foreground">Bolgeleri ele gecir, vergi topla</p>
      </div>

      {initialLoading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="h-6 w-6 border-2 border-gold/60 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center justify-center min-h-[200px] gap-3">
          <p className="text-sm text-muted-foreground">Veriler yuklenemedi</p>
          <Button size="sm" variant="outline" onClick={loadData}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Tekrar Dene
          </Button>
        </div>
      ) : (
      <>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-neon/10 border border-neon/20 rounded-xl p-2.5 text-center">
          <p className="text-lg font-black text-neon font-display">{controlled}</p>
          <p className="text-[10px] text-muted-foreground">Kontrolde</p>
        </div>
        <div className="bg-red-950/30 border border-red-900/30 rounded-xl p-2.5 text-center">
          <p className="text-lg font-black text-red-400 font-display">{contested}</p>
          <p className="text-[10px] text-muted-foreground">Aktif Savas</p>
        </div>
        <div className="bg-secondary/40 border border-border/40 rounded-xl p-2.5 text-center">
          <p className="text-lg font-black font-display">{free}</p>
          <p className="text-[10px] text-muted-foreground">Sahipsiz</p>
        </div>
      </div>

      {/* Claim territory reward */}
      {controlled > 0 && (
        <Button className="w-full h-8 text-xs gradient-gold text-primary-foreground" onClick={handleClaimReward} disabled={loading}>
          <Trophy className="h-3.5 w-3.5 mr-1" /> Bolge Gelirini Topla
        </Button>
      )}

      {/* Active Wars */}
      {wars.filter(w => w.status === 'active').length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-red-400 flex items-center gap-1"><Swords className="h-3.5 w-3.5" /> Aktif Savaslar</p>
          {wars.filter(w => w.status === 'active').map(war => {
            const canContribute = playerFamilyId === war.attacker_family_id || playerFamilyId === war.defender_family_id
            return (
              <Card key={war.id} className="border-red-900/30 bg-red-950/10">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-red-400">[{war.attacker_tag}] {war.attacker_name}</span>
                    <Swords className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-semibold text-blue-400">{war.defender_name ? `[${war.defender_tag}] ${war.defender_name}` : 'Sahipsiz'}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center">{war.territory_name}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-red-400 font-bold">{war.attacker_points}</span>
                    <Progress value={war.attacker_points + war.defender_points > 0 ? (war.attacker_points / (war.attacker_points + war.defender_points)) * 100 : 50} className="h-1.5 flex-1" />
                    <span className="text-[10px] text-blue-400 font-bold">{war.defender_points}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[9px] border-red-700/40 text-red-400">
                      <Clock className="h-2.5 w-2.5 mr-0.5" /> {getTimeLeft(war.ends_at)}
                    </Badge>
                    {canContribute && (
                      <Button size="sm" className="h-6 text-[10px] bg-red-900/40 border border-red-700/40 text-red-300"
                        onClick={() => setSelectedWar(war)}>
                        Birlik Gonder
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Territory Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {territories.map(territory => {
          const isLocked = playerLevel < territory.level
          const color = districtColors[territory.district_type] || districtColors.old_quarter
          const resInfo = RESOURCE_INFO[territory.resource_bonus as keyof typeof RESOURCE_INFO]
          const Icon = districtIcon[territory.district_type] || MapPin
          const ownerFamily = territory.owner_family_id ? familyMap.get(territory.owner_family_id) : null
          const activeWar = getActiveWar(territory.id)
          const isOurs = territory.owner_family_id === playerFamilyId && playerFamilyId !== null

          return (
            <Card
              key={territory.id}
              className={`bg-gradient-to-br ${color} cursor-pointer hover:brightness-110 transition-all ${isLocked ? 'opacity-50' : ''} relative overflow-hidden ${isOurs ? 'ring-1 ring-gold/40' : ''}`}
              onClick={() => !isLocked && setSelectedTerritory(territory)}
            >
              {activeWar && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-red-500 animate-pulse" />
              )}
              {isOurs && (
                <div className="absolute top-0 right-0 w-0 h-0 border-l-[20px] border-l-transparent border-t-[20px] border-t-gold/60" />
              )}
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-black/20 flex items-center justify-center">
                      <Icon className="h-4 w-4 text-foreground/80" />
                    </div>
                    <div>
                      <p className="text-xs font-bold">{territory.name}</p>
                      <p className="text-[10px] text-muted-foreground">{districtNames[territory.district_type]}</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 flex-wrap">
                  <Badge variant="outline" className="text-[9px] px-1">Lv.{territory.level}+</Badge>
                  {resInfo && (
                    <Badge variant="outline" className={`text-[9px] px-1 ${resInfo.color}`}>{resInfo.name}</Badge>
                  )}
                  <Badge variant="outline" className="text-[9px] px-1">
                    <Coins className="h-2 w-2 mr-0.5" />{territory.daily_income}/gun
                  </Badge>
                </div>
                {ownerFamily ? (
                  <p className="text-[9px] text-gold">[{ownerFamily.tag}] {ownerFamily.name}</p>
                ) : (
                  <p className="text-[9px] text-neon">Sahipsiz</p>
                )}
                {isLocked && <Lock className="h-3.5 w-3.5 text-muted-foreground absolute top-2 right-2" />}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {!playerFamilyId && (
        <div className="bg-card/50 border border-border/30 rounded-lg p-3">
          <p className="text-[10px] text-muted-foreground text-center">
            <Crown className="h-3 w-3 inline mr-1 text-gold" />
            Bolge kontrolu icin bir aileye katil.
          </p>
        </div>
      )}
      </>
      )}

      {/* Territory Detail Dialog */}
      <Dialog open={!!selectedTerritory} onOpenChange={(o) => !o && setSelectedTerritory(null)}>
        <DialogContent className="bg-card border-border/50 max-w-sm">
          {selectedTerritory && (() => {
            const Icon = districtIcon[selectedTerritory.district_type] || MapPin
            const resInfo = RESOURCE_INFO[selectedTerritory.resource_bonus as keyof typeof RESOURCE_INFO]
            const ownerFamily = selectedTerritory.owner_family_id ? familyMap.get(selectedTerritory.owner_family_id) : null
            const isOurs = selectedTerritory.owner_family_id === playerFamilyId && playerFamilyId !== null
            const activeWar = getActiveWar(selectedTerritory.id)
            const hasShield = selectedTerritory.shield_until && new Date(selectedTerritory.shield_until) > new Date()
            const canAttack = playerFamilyId && !isOurs && !activeWar && !hasShield

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Icon className="h-5 w-5" /> {selectedTerritory.name}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-secondary/50 rounded-lg p-2 text-center">
                      <p className="text-muted-foreground text-[10px]">Seviye</p>
                      <p className="font-bold">{selectedTerritory.level}</p>
                    </div>
                    <div className="bg-secondary/50 rounded-lg p-2 text-center">
                      <p className="text-muted-foreground text-[10px]">Savunma</p>
                      <p className="font-bold">{selectedTerritory.defense_bonus}</p>
                    </div>
                    <div className="bg-secondary/50 rounded-lg p-2 text-center">
                      <p className="text-muted-foreground text-[10px]">Gelir</p>
                      <p className={`font-bold ${resInfo?.color || ''}`}>{selectedTerritory.daily_income}/gun</p>
                    </div>
                  </div>

                  {ownerFamily ? (
                    <div className="bg-amber-950/20 border border-amber-900/30 rounded-lg p-2.5">
                      <p className="text-xs font-semibold flex items-center gap-1"><Crown className="h-3.5 w-3.5 text-gold" /> [{ownerFamily.tag}] {ownerFamily.name}</p>
                      {isOurs && <p className="text-[10px] text-gold mt-1">Bu bolge sizin kontrolunuzde!</p>}
                    </div>
                  ) : (
                    <div className="bg-neon/10 border border-neon/20 rounded-lg p-2.5">
                      <p className="text-xs font-semibold text-neon">Sahipsiz Bolge</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Aile ile birlikte bu bolgeyi ele gecirin!</p>
                    </div>
                  )}

                  {hasShield && (
                    <Badge variant="outline" className="w-full justify-center text-[10px]">
                      <Shield className="h-3 w-3 mr-1" /> Kalkan aktif
                    </Badge>
                  )}

                  {activeWar && (
                    <Badge variant="outline" className="w-full justify-center text-[10px] border-red-700/40 text-red-400">
                      <Swords className="h-3 w-3 mr-1" /> Savas devam ediyor
                    </Badge>
                  )}

                  {canAttack && (
                    <Button className="w-full h-8 text-xs bg-red-900/40 border border-red-700/40 text-red-300 hover:bg-red-900/60"
                      onClick={() => handleStartWar(selectedTerritory.id)} disabled={loading}>
                      <Swords className="h-3.5 w-3.5 mr-1" /> Bolge Savasi Baslat
                    </Button>
                  )}

                  {!playerFamilyId && (
                    <p className="text-[10px] text-muted-foreground text-center">Saldiri icin bir aileye katilmaniz gerekir</p>
                  )}
                </div>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Contribute to War Dialog */}
      <Dialog open={!!selectedWar} onOpenChange={(o) => !o && setSelectedWar(null)}>
        <DialogContent className="bg-card border-border/50 max-w-sm">
          {selectedWar && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Swords className="h-5 w-5 text-red-400" /> Birlik Gonder
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">{selectedWar.territory_name} savasi icin birlik gonderin.</p>
                <div className="space-y-1.5">
                  <Label className="text-xs">Birlik Tipi</Label>
                  <select
                    className="w-full h-8 text-xs bg-secondary/50 border border-border/50 rounded-lg px-2"
                    value={troopType}
                    onChange={e => setTroopType(e.target.value)}
                  >
                    <option value="street_thugs">Sokak Serserileri (5 puan)</option>
                    <option value="hitmen">Tetikçiler (20 puan)</option>
                    <option value="bodyguards">Korumalar (15 puan)</option>
                    <option value="bikers">Motorculer (25 puan)</option>
                    <option value="vehicle_crew">Araçli Tim (50 puan)</option>
                    <option value="heavy_crew">Agir Tim (100 puan)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Miktar</Label>
                  <Input
                    type="number" min="1"
                    value={troopAmount}
                    onChange={e => setTroopAmount(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <Button className="w-full h-8 text-xs bg-red-900/50 border border-red-700/40 text-red-300 hover:bg-red-900/70"
                  onClick={handleContribute} disabled={loading}>
                  <Swords className="h-3.5 w-3.5 mr-1" /> Gonder
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
