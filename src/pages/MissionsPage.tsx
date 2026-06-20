import { useEffect, useState } from 'react'
import { useGameStore } from '@/stores/gameStore'
import { useGuestStore } from '@/stores/guestStore'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Crosshair, Clock, TriangleAlert as AlertTriangle, Shield, Banknote, Zap, Lock, Flame, CircleCheck as CheckCircle, Swords, BookOpen, Calendar, Star, Activity, BrainCircuit, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { useTimer, formatTime } from '@/hooks/useTimer'
import { RESOURCE_INFO, DARK_JOBS, DAILY_MISSIONS } from '@/lib/game/constants'
import type { Mission, UserMission, UserEnforcer } from '@/types/game'
import { Spinner } from '@/components/ui/spinner'
import * as db from '@/lib/supabase/database'
import { MissionResultModal, type MissionResult } from '@/components/shared/MissionResultModal'

interface LocalMission extends Mission {
  id: string
  ends_at?: string
  status?: 'available' | 'in_progress' | 'completed'
}

interface GuestActiveMission {
  missionId: string
  startsAt: string
  endsAt: string
}

// ─── Category config ──────────────────────────────────────────────────────────

const CAT_ICONS: Record<string, React.FC<{ className?: string }>> = {
  story: BookOpen, daily: Calendar, weekly: Star,
  dark_job: Flame, raid: Swords, event: BrainCircuit,
}

const CAT_COLORS: Record<string, { bg: string; border: string; text: string; activeBg: string }> = {
  dark_job: { bg: 'bg-red-950/30', border: 'border-red-900/40', text: 'text-red-300', activeBg: 'bg-red-950/20' },
  daily:    { bg: 'bg-blue-950/30', border: 'border-blue-900/40', text: 'text-blue-300', activeBg: 'bg-blue-950/20' },
  story:    { bg: 'bg-purple-950/30', border: 'border-purple-900/40', text: 'text-purple-300', activeBg: 'bg-purple-950/20' },
  raid:     { bg: 'bg-orange-950/30', border: 'border-orange-900/40', text: 'text-orange-300', activeBg: 'bg-orange-950/20' },
  event:    { bg: 'bg-amber-950/30', border: 'border-amber-900/40', text: 'text-amber-300', activeBg: 'bg-amber-950/20' },
}

function energyKey(category: string): 'dark_job_energy' | 'raid_energy' | null {
  if (category === 'dark_job' || category === 'story') return 'dark_job_energy'
  if (category === 'raid') return 'raid_energy'
  return null
}

// ─── Police heat bar ──────────────────────────────────────────────────────────

function PoliceHeatBar({ heat, intel, onReduceHeat }: {
  heat: number; intel: number; onReduceHeat: () => void
}) {
  const danger = heat >= 90
  const high = heat >= 70
  const gradientColor = danger
    ? 'linear-gradient(90deg, oklch(0.55 0.22 25), oklch(0.45 0.25 10))'
    : high
    ? 'linear-gradient(90deg, oklch(0.65 0.18 50), oklch(0.78 0.15 75))'
    : 'linear-gradient(90deg, oklch(0.7 0.15 150), oklch(0.8 0.12 160))'

  return (
    <div className={`rounded-xl p-3 space-y-2.5 border ${danger ? 'border-red-800/60 bg-red-950/30' : high ? 'border-orange-800/50 bg-orange-950/20' : 'border-border/30 bg-card/50'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Shield className={`h-3.5 w-3.5 ${danger ? 'text-red-400 animate-pulse' : high ? 'text-orange-400' : 'text-muted-foreground'}`} />
          <span className="text-xs font-bold">Polis Isisi</span>
          {danger && (
            <Badge className="text-[9px] px-1.5 h-4 bg-red-500/20 text-red-400 border-red-500/40 animate-pulse">TEHLIKE</Badge>
          )}
          {high && !danger && (
            <Badge className="text-[9px] px-1.5 h-4 bg-orange-500/20 text-orange-400 border-orange-500/30">YUKSEK</Badge>
          )}
        </div>
        <span className={`text-sm font-black font-mono ${danger ? 'text-red-400' : high ? 'text-orange-400' : 'text-muted-foreground'}`}>{heat}%</span>
      </div>

      <div className="space-y-1">
        <div className="relative h-2.5 bg-secondary/60 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${heat}%`, background: gradientColor }}
          />
          {/* Danger zone marker at 70% */}
          <div className="absolute top-0 h-full w-px bg-orange-500/60" style={{ left: '70%' }} />
          <div className="absolute top-0 h-full w-px bg-red-500/60" style={{ left: '90%' }} />
        </div>
        <div className="flex justify-between text-[9px] text-muted-foreground/50 px-0.5">
          <span>0</span>
          <span className="text-orange-500/60">70</span>
          <span className="text-red-500/60">90</span>
          <span>100</span>
        </div>
      </div>

      {high && (
        <div className="space-y-2">
          <p className={`text-[10px] ${danger ? 'text-red-400' : 'text-orange-400'}`}>
            {danger
              ? 'Tehlike! Gorev odul alma sirasinda baskın riski %30. Istihbarat harca!'
              : 'Polis takibinde sindir. Istihbarat kullanarak isiyi dusur.'}
          </p>
          <Button
            size="sm"
            variant="outline"
            className={`w-full h-7 text-[10px] font-semibold ${danger ? 'border-red-800/50 text-red-400 hover:bg-red-950/40' : 'border-orange-800/50 text-orange-400 hover:bg-orange-950/30'}`}
            onClick={onReduceHeat}
            disabled={intel < 100}
          >
            <Eye className="h-3 w-3 mr-1.5" />
            100 Istihbarat Harca (−5 Isi) · Mevcut: {intel}
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Energy dots bar ──────────────────────────────────────────────────────────

function EnergyBar({ label, current, max, regenMins, color }: {
  label: string; current: number; max: number; regenMins: number; color?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-18 shrink-0">{label}</span>
      <div className="flex gap-0.5 flex-1">
        {Array.from({ length: max }).map((_, i) => (
          <div
            key={i}
            className={`h-2.5 flex-1 rounded-sm transition-all ${i < current ? (color || 'bg-neon') : 'bg-secondary/60'}`}
          />
        ))}
      </div>
      <span className="text-[10px] font-bold tabular-nums text-foreground/80">{current}/{max}</span>
      <span className="text-[9px] text-muted-foreground/50 w-8 text-right">{regenMins}dk</span>
    </div>
  )
}

// ─── Active mission timer ─────────────────────────────────────────────────────

function ActiveMissionTimer({ mission, endsAt, onClaim, loading }: {
  mission: LocalMission; endsAt: string; onClaim: () => void; loading?: boolean
}) {
  const { remaining, isActive, formatted } = useTimer(endsAt)
  const totalDuration = mission.duration || 1
  const progress = isActive ? Math.max(0, 100 - (remaining / totalDuration) * 100) : 100

  if (isActive) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-orange-400 flex items-center gap-1 font-semibold">
            <Clock className="h-3 w-3 animate-pulse" /> Devam ediyor
          </span>
          <span className="font-mono font-bold text-foreground/90">{formatted}</span>
        </div>
        <div className="relative h-1.5 bg-secondary/60 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, oklch(0.78 0.15 75), oklch(0.85 0.18 85))',
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <Button
      size="sm"
      className="w-full h-8 text-xs gradient-gold text-primary-foreground font-bold"
      onClick={onClaim}
      disabled={loading}
    >
      <CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Odulu Topla!
    </Button>
  )
}

// ─── Guest mission hook ───────────────────────────────────────────────────────

function useGuestMissions() {
  const [activeMissions, setActiveMissions] = useState<GuestActiveMission[]>(() => {
    try { return JSON.parse(localStorage.getItem('uw-missions') || '[]') } catch { return [] }
  })

  const saveMissions = (missions: GuestActiveMission[]) => {
    localStorage.setItem('uw-missions', JSON.stringify(missions))
    setActiveMissions(missions)
  }

  const startGuestMission = (missionId: string, duration: number) => {
    if (activeMissions.some(m => m.missionId === missionId)) return
    const now = new Date()
    const endsAt = new Date(now.getTime() + duration * 1000)
    saveMissions([...activeMissions, { missionId, startsAt: now.toISOString(), endsAt: endsAt.toISOString() }])
  }

  const completeGuestMission = (missionId: string) => {
    saveMissions(activeMissions.filter(m => m.missionId !== missionId))
  }

  return { activeMissions, startGuestMission, completeGuestMission }
}

// ─── Mission card ─────────────────────────────────────────────────────────────

function MissionCard({
  mission, activeMission, onStart, onClaim, playerLevel, myEnforcers, canStart,
}: {
  mission: LocalMission
  activeMission?: GuestActiveMission
  onStart: (mission: LocalMission, enforcerId?: string) => void
  onClaim: (mission: LocalMission) => void
  playerLevel: number
  myEnforcers: UserEnforcer[]
  canStart: boolean
}) {
  const [open, setOpen] = useState(false)
  const [selectedEnforcer, setSelectedEnforcer] = useState<string>('')
  const isLocked = playerLevel < mission.required_level
  const isActive = !!activeMission
  const CatIcon = CAT_ICONS[mission.category] || Crosshair
  const cat = CAT_COLORS[mission.category] || CAT_COLORS.dark_job
  const successChance = Math.max(5, 100 - mission.risk)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Card className={`cursor-pointer transition-all active:scale-[0.98] border
          ${isLocked ? 'opacity-50 border-border/30 bg-card/40' : isActive
            ? `${cat.border} ${cat.activeBg} hover:brightness-110`
            : `border-border/30 bg-card/70 hover:${cat.border} hover:bg-card`
          }`}
        >
          <CardContent className="p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0 flex-1">
                <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${isActive ? cat.bg : 'bg-secondary/50'}`}>
                  <CatIcon className={`h-3.5 w-3.5 ${isActive ? cat.text : 'text-muted-foreground'}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">{mission.name}</p>
                  <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{mission.description}</p>
                </div>
              </div>
              {isLocked
                ? <Lock className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-0.5" />
                : isActive
                ? <Activity className={`h-4 w-4 ${cat.text} shrink-0 animate-pulse mt-0.5`} />
                : mission.risk > 60
                ? <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                : null}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {mission.duration > 0 && (
                <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                  <Clock className="h-2.5 w-2.5" />{formatTime(mission.duration)}
                </span>
              )}
              {mission.risk > 0 && (
                <span className={`text-[9px] flex items-center gap-0.5 font-semibold ${mission.risk > 60 ? 'text-red-400' : mission.risk > 30 ? 'text-orange-400' : 'text-neon'}`}>
                  <AlertTriangle className="h-2.5 w-2.5" />%{mission.risk} risk
                </span>
              )}
              {mission.police_heat_gain > 0 && (
                <span className="text-[9px] text-red-400/80 flex items-center gap-0.5">
                  <Shield className="h-2.5 w-2.5" />+{mission.police_heat_gain} isi
                </span>
              )}
            </div>

            {isActive && (
              <ActiveMissionTimer
                mission={mission}
                endsAt={activeMission!.endsAt}
                onClaim={() => { onClaim(mission); setOpen(false) }}
              />
            )}
          </CardContent>
        </Card>
      </DialogTrigger>

      <DialogContent className="bg-card border-border/50 max-w-sm">
        <DialogHeader>
          <div className={`rounded-xl p-3 mb-1 ${cat.bg} border ${cat.border}`}>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-black/20 flex items-center justify-center">
                <CatIcon className={`h-5 w-5 ${cat.text}`} />
              </div>
              <div>
                <DialogTitle className="text-sm">{mission.name}</DialogTitle>
                <p className="text-[10px] text-muted-foreground">{mission.description}</p>
              </div>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-3">
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2">
            {mission.duration > 0 && (
              <div className="bg-secondary/50 rounded-lg p-2 text-center">
                <Clock className="h-3.5 w-3.5 text-muted-foreground mx-auto mb-0.5" />
                <p className="text-xs font-bold">{formatTime(mission.duration)}</p>
                <p className="text-[9px] text-muted-foreground">Sure</p>
              </div>
            )}
            <div className={`rounded-lg p-2 text-center ${successChance < 50 ? 'bg-red-950/20' : 'bg-secondary/50'}`}>
              <Zap className={`h-3.5 w-3.5 mx-auto mb-0.5 ${successChance < 50 ? 'text-red-400' : 'text-neon'}`} />
              <p className={`text-xs font-bold ${successChance < 50 ? 'text-red-400' : 'text-neon'}`}>%{successChance}</p>
              <p className="text-[9px] text-muted-foreground">Basari</p>
            </div>
            {mission.risk > 0 && (
              <div className={`rounded-lg p-2 text-center ${mission.risk > 50 ? 'bg-red-950/10' : 'bg-secondary/50'}`}>
                <AlertTriangle className={`h-3.5 w-3.5 mx-auto mb-0.5 ${mission.risk > 50 ? 'text-red-400' : 'text-orange-400'}`} />
                <p className={`text-xs font-bold ${mission.risk > 50 ? 'text-red-400' : 'text-orange-400'}`}>%{mission.risk}</p>
                <p className="text-[9px] text-muted-foreground">Risk</p>
              </div>
            )}
            {mission.police_heat_gain > 0 && (
              <div className="bg-red-950/10 rounded-lg p-2 text-center">
                <Shield className="h-3.5 w-3.5 text-red-400 mx-auto mb-0.5" />
                <p className="text-xs font-bold text-red-400">+{mission.police_heat_gain}</p>
                <p className="text-[9px] text-muted-foreground">Polis Isisi</p>
              </div>
            )}
          </div>

          {/* Risk bar */}
          {mission.risk > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-[9px]">
                <span className="text-neon font-semibold">%{successChance} basari</span>
                <span className={`${mission.risk > 50 ? 'text-red-400' : 'text-orange-400'} font-semibold`}>%{mission.risk} risk</span>
              </div>
              <div className="h-2 bg-secondary/60 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${successChance}%`,
                    background: successChance > 70
                      ? 'linear-gradient(90deg, oklch(0.7 0.15 150), oklch(0.8 0.12 160))'
                      : successChance > 40
                      ? 'linear-gradient(90deg, oklch(0.65 0.18 50), oklch(0.78 0.15 75))'
                      : 'linear-gradient(90deg, oklch(0.55 0.22 25), oklch(0.45 0.25 10))',
                  }}
                />
              </div>
            </div>
          )}

          {mission.required_level > 1 && (
            <div className="flex items-center justify-between text-[11px] bg-secondary/30 rounded-lg px-2.5 py-1.5">
              <span className="text-muted-foreground">Seviye Gereksinimi</span>
              <span className={playerLevel >= mission.required_level ? 'text-neon font-bold' : 'text-destructive font-bold'}>
                Lv.{mission.required_level}
              </span>
            </div>
          )}

          {/* Rewards */}
          <div className="bg-secondary/40 rounded-xl p-2.5 space-y-1.5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Banknote className="h-3 w-3 text-gold" /> Oduller
            </p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              {Object.entries(mission.rewards as Record<string, number>).filter(([, v]) => v > 0).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">{key === 'xp' ? 'XP' : RESOURCE_INFO[key as keyof typeof RESOURCE_INFO]?.name || key}</span>
                  <span className="text-neon font-bold">+{val.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {myEnforcers.length > 0 && !isActive && !isLocked && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold">Enforcer Ata (Opsiyonel)</p>
              <Select value={selectedEnforcer} onValueChange={setSelectedEnforcer}>
                <SelectTrigger className="h-8 text-xs bg-secondary/50">
                  <SelectValue placeholder="Enforcer sec (bonus icin)" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border/50">
                  <SelectItem value="" className="text-xs text-muted-foreground">Enforcer atama</SelectItem>
                  {myEnforcers.filter(ue => ue.level >= 1).map(ue => (
                    <SelectItem key={ue.id} value={ue.id} className="text-xs">
                      {ue.enforcer?.name || 'Enforcer'} · +{ue.enforcer?.crime_success_bonus || 0}% bonus
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isLocked ? (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2 text-center">
              <Lock className="h-4 w-4 text-destructive mx-auto mb-1" />
              <p className="text-xs text-destructive font-semibold">Seviye {mission.required_level} gerekli</p>
            </div>
          ) : isActive ? (
            <ActiveMissionTimer
              mission={mission}
              endsAt={activeMission!.endsAt}
              onClaim={() => { onClaim(mission); setOpen(false) }}
            />
          ) : (
            <Button
              className={`w-full font-bold ${canStart ? 'gradient-gold text-primary-foreground' : 'opacity-50'}`}
              disabled={!canStart}
              onClick={() => {
                onStart(mission, selectedEnforcer || undefined)
                setOpen(false)
              }}
            >
              <Zap className="h-4 w-4 mr-1.5" /> Gorevi Basalt
            </Button>
          )}
          {!canStart && !isActive && !isLocked && (
            <p className="text-[10px] text-destructive text-center">Enerji yetersiz — yenilenmesini bekleyin</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Auth mission card ────────────────────────────────────────────────────────

function AuthMissionCard({ userMission }: { userMission: UserMission }) {
  const claimMissionReward = useGameStore(s => s.claimMissionReward)
  const [open, setOpen] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [missionResult, setMissionResult] = useState<MissionResult | null>(null)
  const mission = userMission.mission as Mission | undefined
  if (!mission) return null

  const endsAt = userMission.ends_at || ''
  const isDone = userMission.status === 'completed'
  const CatIcon = CAT_ICONS[mission.category] || Crosshair
  const cat = CAT_COLORS[mission.category] || CAT_COLORS.dark_job

  async function handleClaim() {
    setClaiming(true)
    const result = await claimMissionReward(userMission.id)
    setClaiming(false)
    setOpen(false)
    if (result && typeof result === 'object') {
      setMissionResult({
        ok: result.ok,
        missionName: mission!.name,
        rewards: result.rewards,
        police_raid: result.police_raid,
        raid_penalty: result.raid_penalty,
        enforcer_bonus: result.enforcer_bonus,
      })
    }
  }

  return (
    <>
      {missionResult && (
        <MissionResultModal result={missionResult} onClose={() => setMissionResult(null)} />
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Card className={`cursor-pointer hover:brightness-110 transition-all border
            ${isDone
              ? 'border-neon/20 bg-neon/5'
              : `${cat.border} ${cat.activeBg}`}
          `}>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${isDone ? 'bg-neon/10' : cat.bg}`}>
                    {isDone
                      ? <CheckCircle className="h-3.5 w-3.5 text-neon" />
                      : <CatIcon className={`h-3.5 w-3.5 ${cat.text}`} />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">{mission.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{mission.description}</p>
                  </div>
                </div>
                {!isDone && <Activity className={`h-4 w-4 ${cat.text} shrink-0 animate-pulse mt-0.5`} />}
              </div>
              {!isDone && endsAt && (
                <ActiveMissionTimer
                  mission={{ ...mission, id: userMission.id } as LocalMission}
                  endsAt={endsAt}
                  onClaim={handleClaim}
                  loading={claiming}
                />
              )}
              {isDone && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] text-neon font-semibold flex items-center gap-1">
                    <CheckCircle className="h-2.5 w-2.5" /> Tamamlandi
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </DialogTrigger>

        <DialogContent className="bg-card border-border/50 max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CatIcon className={`h-5 w-5 ${cat.text}`} /> {mission.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{mission.description}</p>
            <div className="bg-secondary/40 rounded-xl p-2.5 space-y-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Banknote className="h-3 w-3 text-gold" /> Oduller
              </p>
              {Object.entries(mission.rewards as Record<string, number>).filter(([, v]) => v > 0).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">{key === 'xp' ? 'XP' : RESOURCE_INFO[key as keyof typeof RESOURCE_INFO]?.name || key}</span>
                  <span className="text-neon font-bold">+{val.toLocaleString()}</span>
                </div>
              ))}
            </div>
            {isDone ? (
              <p className="text-xs text-neon text-center flex items-center justify-center gap-1 font-semibold">
                <CheckCircle className="h-3.5 w-3.5" /> Tamamlandi
              </p>
            ) : endsAt ? (
              <ActiveMissionTimer
                mission={{ ...mission, id: userMission.id } as LocalMission}
                endsAt={endsAt}
                onClaim={handleClaim}
                loading={claiming}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Tab content ──────────────────────────────────────────────────────────────

function MissionTabContent({
  category, isGuest, guestMissions, activeMissions, playerLevel,
  onGuestStart, onGuestClaim, onAuthStart, myEnforcers, player,
}: {
  category: string
  isGuest: boolean
  guestMissions: LocalMission[]
  activeMissions: GuestActiveMission[]
  playerLevel: number
  onGuestStart: (m: LocalMission, enforcerId?: string) => void
  onGuestClaim: (m: LocalMission) => void
  onAuthStart: (m: LocalMission, enforcerId?: string) => void
  myEnforcers: UserEnforcer[]
  player: { dark_job_energy?: number; raid_energy?: number } | null
}) {
  const { missions: userMissions, availableMissions } = useGameStore()
  const eKey = energyKey(category)
  const canStart = !eKey || ((player as Record<string, number> | null)?.[eKey] ?? 1) > 0

  if (isGuest) {
    const filtered = guestMissions.filter(m => m.category === category)
    if (filtered.length === 0) return (
      <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
        <Crosshair className="h-8 w-8 opacity-30" />
        <p className="text-xs">Bu kategoride gorev yok.</p>
      </div>
    )
    return (
      <div className="space-y-2">
        {filtered.map(m => (
          <MissionCard
            key={m.id}
            mission={m}
            activeMission={activeMissions.find(a => a.missionId === m.id)}
            onStart={onGuestStart}
            onClaim={onGuestClaim}
            playerLevel={playerLevel}
            myEnforcers={myEnforcers}
            canStart={canStart}
          />
        ))}
      </div>
    )
  }

  const activeForCategory = userMissions.filter(
    um => (um.mission as Mission | undefined)?.category === category && um.status === 'in_progress'
  )
  const completedForCategory = userMissions.filter(
    um => (um.mission as Mission | undefined)?.category === category && um.status === 'completed'
  )
  const activeMissionIds = new Set(userMissions.map(um => um.mission_id))
  const available = availableMissions.filter(
    m => m.category === category && !activeMissionIds.has(m.id)
  )

  const isEmpty = activeForCategory.length === 0 && available.length === 0 && completedForCategory.length === 0

  return (
    <div className="space-y-2">
      {activeForCategory.map(um => <AuthMissionCard key={um.id} userMission={um} />)}
      {available.map(m => (
        <MissionCard
          key={m.id}
          mission={m as LocalMission}
          onStart={onAuthStart}
          onClaim={() => {}}
          playerLevel={playerLevel}
          myEnforcers={myEnforcers}
          canStart={canStart}
        />
      ))}
      {completedForCategory.slice(0, 3).map(um => <AuthMissionCard key={um.id} userMission={um} />)}
      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
          <Crosshair className="h-8 w-8 opacity-30" />
          <p className="text-xs">Bu kategoride gorev yok.</p>
        </div>
      )}
    </div>
  )
}

// ─── Guest missions data ──────────────────────────────────────────────────────

let _counter = 1
const GUEST_MISSIONS: LocalMission[] = [
  ...DARK_JOBS.map(m => ({ ...m, id: 'dj-' + (_counter++) })),
  ...DAILY_MISSIONS.map(m => ({ ...m, id: 'dm-' + (_counter++) })),
]

// ─── Main page ────────────────────────────────────────────────────────────────

export function MissionsPage() {
  const isGuest = useGuestStore(s => s.isGuest)
  const guestPlayer = useGuestStore(s => s.player)
  const guestAddResources = useGuestStore(s => s.addResources)
  const guestAddPoliceHeat = useGuestStore(s => s.addPoliceHeat)
  const { missions: userMissions, loadMissions, loading, player: authPlayer, enforcers } = useGameStore()
  const { activeMissions, startGuestMission, completeGuestMission } = useGuestMissions()

  const player = isGuest ? guestPlayer : authPlayer
  const myEnforcers = isGuest ? [] : enforcers

  useEffect(() => {
    if (!isGuest) loadMissions()
  }, [isGuest, loadMissions])

  async function handleReduceHeat() {
    if (isGuest) {
      if ((guestPlayer?.intel ?? 0) < 100) { toast.error('Yeterli istihbarat yok'); return }
      guestAddResources({ intel: -100 })
      guestAddPoliceHeat(-5)
      toast.success('Polis isisi −5 dusuruldu!')
      return
    }
    const result = await db.reducePoliceHeatWithIntel(100)
    if (!result.ok) { toast.error(result.error || 'Basarisiz'); return }
    await useGameStore.getState().loadPlayer()
    toast.success(`Polis isisi −${result.heat_reduction} dusuruldu!`)
  }

  function handleGuestStart(mission: LocalMission) {
    startGuestMission(mission.id, mission.duration || 60)
    toast.info(`${mission.name} basladi!`, {
      description: mission.duration > 0 ? `${Math.floor(mission.duration / 60)}dk sonra tamamlanir.` : 'Aninda tamamlanabilir.',
    })
  }

  function handleGuestClaim(mission: LocalMission) {
    const rewards = mission.rewards as Record<string, number>
    const res: Record<string, number> = {}
    for (const [k, v] of Object.entries(rewards)) {
      if (k !== 'xp') res[k] = v
    }
    guestAddResources({ ...res, xp: rewards.xp || 0 })
    guestAddPoliceHeat(mission.police_heat_gain)
    completeGuestMission(mission.id)
    const rewardText = Object.entries(rewards).filter(([, v]) => v > 0)
      .map(([k, v]) => `+${v} ${k === 'xp' ? 'XP' : k}`).join(', ')
    toast.success(`${mission.name} tamamlandi!`, { description: rewardText })
  }

  function handleAuthStart(mission: LocalMission, enforcerId?: string) {
    useGameStore.getState().startMission(mission.id, enforcerId || undefined)
  }

  const activeCount = isGuest
    ? activeMissions.length
    : userMissions.filter(m => m.status === 'in_progress').length

  const policeHeat = player?.police_heat ?? 0
  const intel = player?.intel ?? 0

  const tabs = [
    { key: 'dark_job', label: 'Karanlik', shortLabel: 'Karanlik', icon: Flame },
    { key: 'daily', label: 'Gunluk', shortLabel: 'Gunluk', icon: Calendar },
    { key: 'story', label: 'Hikaye', shortLabel: 'Hikaye', icon: BookOpen },
    { key: 'raid', label: 'Baskin', shortLabel: 'Baskin', icon: Swords },
  ]

  if (!isGuest && loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Spinner className="h-8 w-8 text-gold" />
        <p className="text-xs text-muted-foreground font-display tracking-wider">GOREVLER YUKLENIYOR...</p>
      </div>
    )
  }

  return (
    <div className="p-3 space-y-4 pb-6">
      {/* Header */}
      <div className="relative rounded-2xl overflow-hidden border border-border/30 bg-gradient-to-br from-slate-900 via-card to-red-950/20">
        <div className="absolute inset-0 bg-gradient-to-br from-red-950/20 via-transparent to-orange-950/10 pointer-events-none" />
        <div className="relative px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-black tracking-wider text-red-300 drop-shadow-[0_0_15px_rgba(239,68,68,0.3)]">
              KARANLIK ISLER
            </h1>
            {activeCount > 0 ? (
              <p className="text-[10px] text-orange-400 mt-0.5 font-semibold">{activeCount} aktif gorev devam ediyor</p>
            ) : (
              <p className="text-[10px] text-muted-foreground mt-0.5">Gorev sec ve basla</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xl font-black text-red-400 font-display">{activeCount}</p>
            <p className="text-[10px] text-muted-foreground">Aktif</p>
          </div>
        </div>
      </div>

      {/* Energy bars */}
      <div className="bg-card/60 border border-border/30 rounded-xl p-3 space-y-2">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Enerji</p>
        <EnergyBar
          label="Karanlik Is"
          current={player?.dark_job_energy ?? 0}
          max={player?.max_dark_job_energy ?? 5}
          regenMins={30}
          color="bg-red-500"
        />
        <EnergyBar
          label="Baskin"
          current={player?.raid_energy ?? 0}
          max={player?.max_raid_energy ?? 10}
          regenMins={60}
          color="bg-orange-500"
        />
        <EnergyBar
          label="Istihbarat"
          current={player?.spy_energy ?? 0}
          max={player?.max_spy_energy ?? 3}
          regenMins={45}
          color="bg-blue-500"
        />
      </div>

      {/* Police heat */}
      {policeHeat > 0 && (
        <PoliceHeatBar heat={policeHeat} intel={intel} onReduceHeat={handleReduceHeat} />
      )}

      {/* Tabs */}
      <Tabs defaultValue="dark_job">
        <TabsList className="grid w-full grid-cols-4 h-9">
          {tabs.map(({ key, shortLabel, icon: Icon }) => {
            const count = isGuest
              ? activeMissions.filter(a => GUEST_MISSIONS.find(m => m.id === a.missionId)?.category === key).length
              : userMissions.filter(um => (um.mission as Mission | undefined)?.category === key && um.status === 'in_progress').length
            const cat = CAT_COLORS[key]
            return (
              <TabsTrigger
                key={key}
                value={key}
                className={`relative text-[10px] px-1 data-[state=active]:${cat?.text || 'text-gold'}`}
              >
                <Icon className="h-3 w-3 mr-0.5 shrink-0" />
                <span className="truncate">{shortLabel}</span>
                {count > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-orange-500 text-[8px] font-bold text-white flex items-center justify-center">
                    {count}
                  </span>
                )}
              </TabsTrigger>
            )
          })}
        </TabsList>

        {tabs.map(({ key }) => (
          <TabsContent key={key} value={key} className="mt-3">
            <MissionTabContent
              category={key}
              isGuest={isGuest}
              guestMissions={GUEST_MISSIONS}
              activeMissions={activeMissions}
              playerLevel={player?.level || 1}
              onGuestStart={handleGuestStart}
              onGuestClaim={handleGuestClaim}
              onAuthStart={handleAuthStart}
              myEnforcers={myEnforcers}
              player={player}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
