import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Building2, Crosshair, Map, ShoppingBag, User, Shield, Crown, Bell, Microscope, Sword, Trophy, Flame, Swords, Users, Calendar, Star, ChartBar as BarChart3, Mail, RotateCw } from 'lucide-react'
import { ResourceBar } from '@/components/shared/ResourceBar'
import { useGameStore } from '@/stores/gameStore'
import { useGuestStore } from '@/stores/guestStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
import { GuestBanner } from '@/components/shared/GuestBanner'
import { DailyRewardModal } from '@/components/shared/DailyRewardModal'
import { useProduction } from '@/hooks/useProduction'
import { useLevelUp } from '@/hooks/useLevelUp'
import { useEnergyRegen } from '@/hooks/useEnergyRegen'
import { TutorialOverlay } from '@/components/shared/TutorialOverlay'
import { useAchievementListener } from '@/hooks/useAchievementListener'
import { useRealtimeSync } from '@/hooks/useRealtimeSync'
import { WhatsNewModal } from '@/components/shared/WhatsNewModal'
import { OfflineEarningsModal } from '@/components/shared/OfflineEarningsModal'

const bottomNavItems = [
  { to: '/city', icon: Building2, label: 'Şehir' },
  { to: '/missions', icon: Crosshair, label: 'Görevler' },
  { to: '/map', icon: Map, label: 'Harita' },
  { to: '/shop', icon: ShoppingBag, label: 'Mağaza' },
  { to: '/profile', icon: User, label: 'Profil' },
]

export function GameLayout() {
  const session = useGameStore(s => s.session)
  const authPlayer = useGameStore(s => s.player)
  const authMissions = useGameStore(s => s.missions)
  const guestPlayer = useGuestStore(s => s.player)
  const isGuest = useGuestStore(s => s.isGuest)

  const player = isGuest ? guestPlayer : authPlayer
  const location = useLocation()
  const navigate = useNavigate()
  const [notifOpen, setNotifOpen] = useState(false)
  const { notifications, unreadCount, unreadMailCount, load: loadNotifs, markRead, markAllRead, loadMailCount } = useNotificationStore()

  useProduction()
  const { modal: levelUpModal } = useLevelUp()
  useEnergyRegen()
  useAchievementListener()
  useRealtimeSync()

  useEffect(() => {
    if (session) {
      loadNotifs()
      loadMailCount()
    }
  }, [session, loadNotifs, loadMailCount])

  return (
    <div className="flex flex-col h-dvh bg-background overflow-hidden">
      {/* Top bar */}
      <header className="shrink-0 border-b border-border/40 bg-card/90 backdrop-blur-md">
        <div className="flex items-center justify-between px-2.5 py-2">
          {/* Profile avatar */}
          <NavLink to="/profile" className="flex items-center gap-2 shrink-0 min-w-0">
            <div className="relative">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-amber-600 to-amber-900 flex items-center justify-center border-2 border-gold/40 shrink-0">
                <User className="h-4 w-4 text-gold" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center leading-none">
                {player?.level || 1}
              </div>
            </div>
            <div className="hidden sm:block min-w-0">
              <p className="text-xs font-semibold truncate max-w-[90px]">{player?.username || '...'}</p>
              <p className="text-[10px] text-muted-foreground truncate max-w-[90px]">{player?.title}</p>
            </div>
          </NavLink>

          {/* Resource bar */}
          <div className="flex-1 mx-1.5 min-w-0 overflow-hidden">
            <ResourceBar />
          </div>

          {/* Right buttons */}
          <div className="flex items-center gap-0.5 shrink-0">
            {player && player.vip_level > 0 && (
              <NavLink to="/vip">
                <Badge variant="outline" className="border-gold/40 text-gold text-[9px] px-1 py-0 h-5">
                  <Crown className="h-2.5 w-2.5 mr-0.5" />VIP{player.vip_level}
                </Badge>
              </NavLink>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 relative" onClick={() => { setNotifOpen(o => !o); if (!notifOpen && unreadCount > 0) loadNotifs() }}>
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && <span className="absolute top-1 right-1 h-2 w-2 bg-destructive rounded-full" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-gold/70 hover:text-gold" onClick={() => navigate('/vip')}>
              <Crown className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Police heat bar — visible only when > 20% */}
        {player && player.police_heat > 20 && (
          <div className="px-3 pb-1.5 flex items-center gap-2">
            <Shield className="h-3 w-3 text-destructive shrink-0" />
            <div className="flex-1 h-1.5 bg-secondary/60 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${player.police_heat}%`,
                  background: player.police_heat > 70
                    ? 'linear-gradient(90deg, oklch(0.55 0.22 25), oklch(0.45 0.25 10))'
                    : 'linear-gradient(90deg, oklch(0.65 0.18 50), oklch(0.78 0.15 75))'
                }}
              />
            </div>
            <span className={`text-[10px] font-bold tabular-nums w-7 text-right ${player.police_heat > 70 ? 'text-destructive animate-pulse' : 'text-gold'}`}>
              {player.police_heat}%
            </span>
          </div>
        )}
      </header>

      {/* Floating side quicklinks — only show on city/main pages, not detail pages */}
      {['/city', '/missions', '/map', '/shop', '/profile', '/family'].some(p => location.pathname === p) && (
        <div className="fixed right-1.5 top-[72px] z-30 flex flex-col gap-1">
          {[
            { to: '/events', bg: 'gradient-crimson border-red-800/40', icon: Flame, color: 'text-red-200', badge: 0 },
            { to: '/enforcers', bg: 'bg-amber-900/80 border-amber-700/40', icon: Swords, color: 'text-amber-300', badge: 0 },
            { to: '/family', bg: 'bg-yellow-900/80 border-yellow-700/40', icon: Users, color: 'text-yellow-300', badge: 0 },
            { to: '/research', bg: 'bg-purple-900/80 border-purple-700/40', icon: Microscope, color: 'text-purple-300', badge: 0 },
            { to: '/troops', bg: 'bg-orange-900/80 border-orange-700/40', icon: Sword, color: 'text-orange-300', badge: 0 },
            { to: '/leaderboard', bg: 'bg-blue-900/80 border-blue-700/40', icon: Trophy, color: 'text-blue-300', badge: 0 },
            { to: '/daily-quests', bg: 'bg-green-900/80 border-green-700/40', icon: Calendar, color: 'text-green-300', badge: 0 },
            { to: '/battle-pass', bg: 'bg-amber-900/80 border-amber-600/40', icon: Star, color: 'text-yellow-300', badge: 0 },
            { to: '/battle', bg: 'bg-red-900/80 border-red-700/40', icon: Crosshair, color: 'text-red-300', badge: 0 },
            { to: '/statistics', bg: 'bg-cyan-900/80 border-cyan-700/40', icon: BarChart3, color: 'text-cyan-300', badge: 0 },
            { to: '/mail', bg: 'bg-emerald-900/80 border-emerald-700/40', icon: Mail, color: 'text-emerald-300', badge: unreadMailCount },
            { to: '/wheel', bg: 'bg-amber-900/80 border-amber-700/40', icon: RotateCw, color: 'text-amber-300', badge: 0 },
          ].map(({ to, bg, icon: Icon, color, badge }) => (
            <NavLink key={to} to={to}>
              <div className={`${bg} rounded-lg p-1 border shadow-md cursor-pointer opacity-80 hover:opacity-100 transition-opacity relative`}>
                <Icon className={`h-3.5 w-3.5 ${color}`} />
                {badge > 0 && (
                  <span className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-destructive text-white text-[8px] font-bold rounded-full flex items-center justify-center leading-none">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </div>
            </NavLink>
          ))}
        </div>
      )}

      {notifOpen && (
        <div className="fixed right-2 top-14 z-50 w-72 bg-card border border-border rounded-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="px-3 py-2.5 border-b border-border/50 flex items-center justify-between">
            <h4 className="text-sm font-semibold">Bildirimler {unreadCount > 0 && <span className="ml-1 text-[10px] bg-destructive text-white rounded-full px-1.5">{unreadCount}</span>}</h4>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-[10px] text-muted-foreground hover:text-foreground">Tümünü oku</button>
            )}
          </div>
          <div className="divide-y divide-border/30 max-h-64 overflow-y-auto">
            {notifications.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">Bildirim yok</div>
            )}
            {notifications.map(n => (
              <div
                key={n.id}
                onClick={() => { if (!n.is_read) markRead(n.id); setNotifOpen(false) }}
                className={`flex items-start gap-2.5 px-3 py-2.5 hover:bg-accent/20 cursor-pointer ${n.is_read ? 'opacity-60' : ''}`}
              >
                <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${n.is_read ? 'bg-muted' : 'bg-gold'}`} />
                <div>
                  <p className="text-xs font-medium">{n.title}</p>
                  {n.body && <p className="text-[10px] text-muted-foreground">{n.body}</p>}
                  <p className="text-[9px] text-muted-foreground/60 mt-0.5">{new Date(n.created_at).toLocaleString('tr-TR')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Guest banner */}
      {isGuest && !session && <GuestBanner />}

      {/* Daily reward modal */}
      <DailyRewardModal />

      {/* Tutorial for new players */}
      <TutorialOverlay />

      {/* What's new modal */}
      <WhatsNewModal />

      {/* Offline earnings */}
      <OfflineEarningsModal />

      {/* Level-up celebration */}
      {levelUpModal}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto overscroll-contain">
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav className="shrink-0 border-t border-border/40 bg-card/95 backdrop-blur-md">
        <div className="flex items-center justify-around px-1 py-1.5">
          {bottomNavItems.map(item => {
            const isCurrent = location.pathname.startsWith(item.to)
            const isShop = item.to === '/shop'
            const isMissions = item.to === '/missions'

            // Count ready-to-claim missions for the badge
            const claimableMissions = isMissions && !isGuest
              ? authMissions.filter(m => {
                  if (m.status !== 'in_progress') return false
                  if (!m.ends_at) return false
                  return new Date(m.ends_at) <= new Date()
                }).length
              : 0

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all relative ${
                  isCurrent
                    ? 'text-gold bg-gold/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/20'
                }`}
              >
                {isCurrent && (
                  <span className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-gold" />
                )}
                <item.icon className={`h-5 w-5 transition-all ${isCurrent ? 'drop-shadow-[0_0_8px_oklch(0.78_0.15_75/60%)]' : ''}`} />
                <span className="text-[10px] font-semibold">{item.label}</span>
                {isShop && !isCurrent && (
                  <span className="absolute top-1 right-2 h-1.5 w-1.5 bg-destructive rounded-full" />
                )}
                {isMissions && claimableMissions > 0 && !isCurrent && (
                  <span className="absolute -top-0.5 right-1 h-4 min-w-4 px-0.5 bg-red-500 text-[9px] font-bold text-white rounded-full flex items-center justify-center">
                    {claimableMissions}
                  </span>
                )}
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
