import { useGameStore } from '@/stores/gameStore'
import { useGuestStore } from '@/stores/guestStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { Banknote, Crown, Heart, Swords, CircleDollarSign, Eye, Gem, Zap, Bell } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const resources = [
  { key: 'cash', label: 'Nakit', icon: Banknote, color: 'text-green-400' },
  { key: 'black_money', label: 'Kara Para', icon: CircleDollarSign, color: 'text-gold' },
  { key: 'influence', label: 'Etki', icon: Crown, color: 'text-amber-400' },
  { key: 'loyalty', label: 'Sadakat', icon: Heart, color: 'text-red-400' },
  { key: 'weapon_power', label: 'Silah', icon: Swords, color: 'text-orange-400' },
  { key: 'intel', label: 'İstihbarat', icon: Eye, color: 'text-blue-400' },
] as const

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}K`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function ResourceBar() {
  const isGuest = useGuestStore(s => s.isGuest)
  const guestPlayer = useGuestStore(s => s.player)
  const authPlayer = useGameStore(s => s.player)
  const player = isGuest ? guestPlayer : authPlayer
  const { notifications, unreadCount, load: loadNotifs, markRead } = useNotificationStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isGuest) loadNotifs()
  }, [isGuest, loadNotifs])

  if (!player) return null

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
        {/* Diamonds — always prominent */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-950/60 border border-cyan-700/40 shrink-0 cursor-default">
              <Gem className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
              <span className="text-[11px] font-bold text-cyan-400 tabular-nums">{fmt(player.diamonds)}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Elmas (Premium) — {player.diamonds.toLocaleString()}</TooltipContent>
        </Tooltip>

        <div className="w-px h-5 bg-border/40 shrink-0" />

        {resources.map(r => {
          const val = player[r.key] as number
          const isLow = val < 500
          return (
            <Tooltip key={r.key}>
              <TooltipTrigger asChild>
                <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded shrink-0 cursor-default transition-colors ${isLow ? 'bg-red-950/40' : ''}`}>
                  <r.icon className={`h-3 w-3 shrink-0 ${isLow ? 'text-red-400' : r.color}`} />
                  <span className={`text-[10px] font-semibold tabular-nums ${isLow ? 'text-red-400' : r.color}`}>
                    {fmt(val)}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">{r.label}: {val.toLocaleString()}</TooltipContent>
            </Tooltip>
          )
        })}

        <div className="w-px h-5 bg-border/40 shrink-0" />

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-0.5 px-1.5 py-0.5 shrink-0 cursor-default">
              <Zap className="h-3 w-3 text-yellow-400 shrink-0" />
              <span className="text-[10px] font-semibold text-yellow-400 tabular-nums">{fmt(player.power)}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Güç Puanı: {player.power.toLocaleString()}</TooltipContent>
        </Tooltip>

        {!isGuest && (
          <Popover>
            <PopoverTrigger asChild>
              <button className="relative px-1.5 py-0.5 shrink-0">
                <Bell className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-3.5 min-w-3.5 rounded-full bg-destructive text-[8px] text-destructive-foreground font-bold flex items-center justify-center px-0.5">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-0 bg-card border-border/50">
              <div className="p-2.5 border-b border-border/30">
                <p className="text-xs font-semibold">Bildirimler</p>
              </div>
              <div className="max-h-60 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground text-center py-6">Bildirim yok</p>
                ) : (
                  notifications.slice(0, 8).map(n => (
                    <button
                      key={n.id}
                      className={`w-full text-left px-2.5 py-2 border-b border-border/20 hover:bg-accent/10 transition-colors ${!n.is_read ? 'bg-gold/5' : ''}`}
                      onClick={() => { markRead(n.id); if (n.type === 'mail') navigate('/mail') }}
                    >
                      <p className={`text-[11px] truncate ${!n.is_read ? 'font-semibold' : ''}`}>{n.title}</p>
                      {n.body && <p className="text-[9px] text-muted-foreground truncate">{n.body}</p>}
                    </button>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </TooltipProvider>
  )
}
