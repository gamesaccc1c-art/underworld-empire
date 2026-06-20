import { useGameStore } from '@/stores/gameStore'
import { useGuestStore } from '@/stores/guestStore'
import { signOut } from '@/lib/supabase/auth'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { User, Crown, Zap, Shield, Star, Swords, LogOut, Crosshair, Banknote, Heart, Eye, CircleDollarSign, Gem, UserPlus, Flame, Gift, Trophy, Settings, ChartBar as BarChart3 } from 'lucide-react'
import { toast } from 'sonner'
import * as db from '@/lib/supabase/database'
import { getXpForLevel } from '@/lib/game/constants'
import { NavLink } from 'react-router-dom'

export function ProfilePage() {
  const { player: authPlayer, setSession, loadPlayer } = useGameStore()
  const { player: guestPlayer, isGuest, claimDailyReward, claimedDailyReward, dailyLoginStreak, addResources: guestAdd } = useGuestStore()
  const navigate = useNavigate()

  const player = isGuest ? guestPlayer : authPlayer

  async function handleLogout() {
    if (!isGuest) {
      await signOut()
      setSession(null)
    } else {
      useGuestStore.getState().exitGuest()
    }
    navigate('/login')
  }

  if (!player) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="h-6 w-6 border-2 border-gold/60 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const xpNeeded = getXpForLevel(player.level + 1)
  const xpProgress = Math.min(100, (player.xp / xpNeeded) * 100)
  const today = new Date().toDateString()
  const canClaim = claimedDailyReward !== today

  async function handleClaimDailyReward() {
    if (isGuest) {
      claimDailyReward()
      guestAdd({ cash: 1000 * (dailyLoginStreak + 1) })
      toast.success(`+${(1000 * (dailyLoginStreak + 1)).toLocaleString()} Nakit kazandin!`)
    } else {
      try {
        const result = await db.claimDailyReward()
        if (!result.ok) {
          toast.error(result.error || 'Gunluk odul alinamadi')
          return
        }
        await loadPlayer()
        toast.success(`+${result.cash?.toLocaleString()} Nakit kazandin!`)
      } catch {
        toast.error('Baglanti hatasi, tekrar deneyin')
      }
    }
  }

  const resources = [
    { key: 'diamonds', label: 'Elmas', icon: Gem, color: 'text-cyan-400' },
    { key: 'cash', label: 'Nakit', icon: Banknote, color: 'text-green-400' },
    { key: 'influence', label: 'Etki', icon: Crown, color: 'text-purple-400' },
    { key: 'loyalty', label: 'Sadakat', icon: Heart, color: 'text-red-400' },
    { key: 'weapon_power', label: 'Silah Gucu', icon: Swords, color: 'text-orange-400' },
    { key: 'black_money', label: 'Kara Para', icon: CircleDollarSign, color: 'text-gold' },
    { key: 'intel', label: 'Istihbarat', icon: Eye, color: 'text-blue-400' },
  ] as const

  return (
    <div className="p-3 space-y-3 pb-6">
      {/* Hero card */}
      <Card className="border-gold/20 bg-gradient-to-br from-amber-950/20 to-card">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-600 to-amber-900 flex items-center justify-center border-2 border-gold/40">
                <User className="h-7 w-7 text-gold" />
              </div>
              <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground text-xs font-black rounded-full h-6 w-6 flex items-center justify-center border-2 border-background font-display">
                {player.level}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold truncate">{player.username}</h2>
              <p className="text-xs text-muted-foreground">{player.title}</p>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {isGuest && (
                  <Badge variant="outline" className="text-[9px] border-amber-600/40 text-amber-400 px-1.5">Misafir</Badge>
                )}
                {player.vip_level > 0 && (
                  <Badge className="gradient-gold text-primary-foreground text-[9px] px-1.5">
                    <Crown className="h-2.5 w-2.5 mr-0.5" />VIP {player.vip_level}
                  </Badge>
                )}
                <Badge variant="outline" className="text-[9px] px-1.5">
                  <Zap className="h-2.5 w-2.5 mr-0.5" />{player.power.toLocaleString()} Guc
                </Badge>
              </div>
            </div>
          </div>

          {/* XP bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">Seviye {player.level}</span>
              <span className="text-gold font-mono">{player.xp.toLocaleString()} / {xpNeeded.toLocaleString()} XP</span>
            </div>
            <Progress value={xpProgress} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Guest CTA */}
      {isGuest && (
        <Card className="border-amber-600/30 bg-gradient-to-r from-amber-950/30 to-card">
          <CardContent className="p-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-gold">Ilerlemeyi kaydet!</p>
              <p className="text-[10px] text-muted-foreground">Ucretsiz hesap ac, verilerini koru</p>
            </div>
            <Button size="sm" className="gradient-gold text-primary-foreground shrink-0" onClick={() => navigate('/login')}>
              <UserPlus className="h-3.5 w-3.5 mr-1" />Kayit Ol
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Daily reward */}
      <Card className={`border-border/40 ${canClaim ? 'border-neon/20 bg-green-950/10' : ''}`}>
        <CardContent className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-neon" />
            <div>
              <p className="text-xs font-semibold">Gunluk Odulun</p>
              <div className="flex items-center gap-1">
                <Flame className="h-3 w-3 text-orange-400" />
                <p className="text-[10px] text-muted-foreground">{dailyLoginStreak} gunluk seri</p>
              </div>
            </div>
          </div>
          {canClaim ? (
            <Button size="sm" className="h-7 text-xs bg-neon/20 border border-neon/30 text-neon hover:bg-neon/30" onClick={handleClaimDailyReward}>
              Topla!
            </Button>
          ) : (
            <Badge variant="outline" className="text-[10px] border-border/30 text-muted-foreground">Toplandı</Badge>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <Card className="border-border/40 bg-card/70">
        <CardContent className="p-3 space-y-2">
          <h3 className="text-xs font-semibold flex items-center gap-1"><Star className="h-3.5 w-3.5 text-gold" />Istatistikler</h3>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-secondary/40 rounded-lg p-2 text-center">
              <p className="text-base font-black text-gold font-display">{player.reputation}</p>
              <p className="text-[10px] text-muted-foreground">Itibar</p>
            </div>
            <div className="bg-secondary/40 rounded-lg p-2 text-center">
              <p className="text-base font-black font-display">{player.power.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">Guc</p>
            </div>
            <div className="bg-secondary/40 rounded-lg p-2 text-center">
              <p className={`text-base font-black font-display ${player.police_heat > 50 ? 'text-destructive' : player.police_heat > 20 ? 'text-gold' : 'text-neon'}`}>
                {player.police_heat}%
              </p>
              <p className="text-[10px] text-muted-foreground">Polis Riski</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Power breakdown */}
      <Card className="border-border/40 bg-card/70">
        <CardContent className="p-3 space-y-2">
          <h3 className="text-xs font-semibold flex items-center gap-1"><Zap className="h-3.5 w-3.5 text-gold" />Guc Dagilimi</h3>
          <PowerBreakdown player={player} />
        </CardContent>
      </Card>

      {/* Resources */}
      <Card className="border-border/40 bg-card/70">
        <CardContent className="p-3 space-y-1">
          <h3 className="text-xs font-semibold mb-2">Kaynaklar</h3>
          {resources.map(r => (
            <div key={r.key} className="flex items-center justify-between py-1 border-b border-border/20 last:border-0">
              <div className="flex items-center gap-2">
                <r.icon className={`h-4 w-4 ${r.color}`} />
                <span className="text-xs text-muted-foreground">{r.label}</span>
              </div>
              <span className={`text-sm font-bold ${r.color} tabular-nums`}>
                {(player[r.key as keyof typeof player] as number).toLocaleString()}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Energy */}
      <Card className="border-border/40 bg-card/70">
        <CardContent className="p-3 space-y-2">
          <h3 className="text-xs font-semibold">Enerji</h3>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { icon: Crosshair, val: player.raid_energy, max: 10, label: 'Baskin', color: 'text-red-400' },
              { icon: Shield, val: player.dark_job_energy, max: 5, label: 'Karanlik Is', color: 'text-purple-400' },
              { icon: Eye, val: player.spy_energy, max: 3, label: 'Casus', color: 'text-blue-400' },
            ].map(({ icon: Icon, val, max, label, color }) => (
              <div key={label} className="bg-secondary/40 rounded-lg p-2">
                <Icon className={`h-4 w-4 ${color} mx-auto`} />
                <p className={`text-sm font-bold ${color}`}>{val}/{max}</p>
                <p className="text-[9px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="space-y-2">
        <NavLink to="/achievements">
          <Button variant="outline" className="w-full justify-start h-10 text-xs border-border/40 hover:bg-accent/20">
            <Trophy className="h-4 w-4 mr-2 text-gold" /> Basarimlar
          </Button>
        </NavLink>
        <NavLink to="/statistics">
          <Button variant="outline" className="w-full justify-start h-10 text-xs border-border/40 hover:bg-accent/20">
            <BarChart3 className="h-4 w-4 mr-2 text-cyan-400" /> Istatistikler
          </Button>
        </NavLink>
        <NavLink to="/referral">
          <Button variant="outline" className="w-full justify-start h-10 text-xs border-border/40 hover:bg-accent/20">
            <UserPlus className="h-4 w-4 mr-2 text-green-400" /> Davet Et
          </Button>
        </NavLink>
        <NavLink to="/enforcers">
          <Button variant="outline" className="w-full justify-start h-10 text-xs border-border/40 hover:bg-accent/20">
            <Swords className="h-4 w-4 mr-2 text-purple-400" /> Enforcerlarim
          </Button>
        </NavLink>
        <NavLink to="/research">
          <Button variant="outline" className="w-full justify-start h-10 text-xs border-border/40 hover:bg-accent/20">
            <Star className="h-4 w-4 mr-2 text-purple-400" /> Arastirma Agaci
          </Button>
        </NavLink>
        <NavLink to="/troops">
          <Button variant="outline" className="w-full justify-start h-10 text-xs border-border/40 hover:bg-accent/20">
            <Zap className="h-4 w-4 mr-2 text-orange-400" /> Birliklerim
          </Button>
        </NavLink>
        <NavLink to="/settings">
          <Button variant="outline" className="w-full justify-start h-10 text-xs border-border/40 hover:bg-accent/20">
            <Settings className="h-4 w-4 mr-2" /> Ayarlar
          </Button>
        </NavLink>
        <Button
          variant="outline"
          className="w-full justify-start h-10 text-xs border-destructive/20 text-destructive hover:bg-destructive/10"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          {isGuest ? 'Misafir Modundan Cik' : 'Cikis Yap'}
        </Button>
      </div>
    </div>
  )
}

function PowerBreakdown({ player }: { player: { power: number; level: number; cash: number; influence: number } }) {
  const levelPower = player.level * 50
  const wealthPower = Math.floor(player.cash / 10000) * 5
  const influencePower = player.influence * 2
  const otherPower = Math.max(0, player.power - levelPower - wealthPower - influencePower)

  const items = [
    { label: 'Seviye', value: levelPower, color: 'bg-gold' },
    { label: 'Servet', value: wealthPower, color: 'bg-green-500' },
    { label: 'Etki', value: influencePower, color: 'bg-blue-500' },
    { label: 'Diger (Bina/Birlik/Arastirma)', value: otherPower, color: 'bg-orange-500' },
  ]

  const total = items.reduce((a, b) => a + b.value, 0) || 1

  return (
    <div className="space-y-1.5">
      <div className="h-3 bg-secondary/50 rounded-full overflow-hidden flex">
        {items.filter(i => i.value > 0).map(item => (
          <div
            key={item.label}
            className={`h-full ${item.color} transition-all`}
            style={{ width: `${(item.value / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        {items.filter(i => i.value > 0).map(item => (
          <div key={item.label} className="flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${item.color}`} />
              <span className="text-muted-foreground">{item.label}</span>
            </div>
            <span className="font-bold tabular-nums">{item.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
