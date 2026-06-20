import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase/client'
import { useGameStore } from '@/stores/gameStore'
import { useGuestStore } from '@/stores/guestStore'
import { GameLayout } from '@/components/layout/GameLayout'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { LoginPage } from '@/pages/LoginPage'
import { Spinner } from '@/components/ui/spinner'
import { Toaster } from '@/components/ui/sonner'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'

// ─── Eagerly loaded (core nav tabs) ──────────────────────────────────────────
import { CityPage } from '@/pages/CityPage'
import { MissionsPage } from '@/pages/MissionsPage'
import { ProfilePage } from '@/pages/ProfilePage'

// ─── Lazy loaded (secondary pages) ───────────────────────────────────────────
const MapPage           = lazy(() => import('@/pages/MapPage').then(m => ({ default: m.MapPage })))
const FamilyPage        = lazy(() => import('@/pages/FamilyPage').then(m => ({ default: m.FamilyPage })))
const ShopPage          = lazy(() => import('@/pages/ShopPage').then(m => ({ default: m.ShopPage })))
const EnforcersPage     = lazy(() => import('@/pages/EnforcersPage').then(m => ({ default: m.EnforcersPage })))
const ResearchPage      = lazy(() => import('@/pages/ResearchPage').then(m => ({ default: m.ResearchPage })))
const TroopsPage        = lazy(() => import('@/pages/TroopsPage').then(m => ({ default: m.TroopsPage })))
const LeaderboardPage   = lazy(() => import('@/pages/LeaderboardPage').then(m => ({ default: m.LeaderboardPage })))
const EventsPage        = lazy(() => import('@/pages/EventsPage').then(m => ({ default: m.EventsPage })))
const BattlePage        = lazy(() => import('@/pages/BattlePage').then(m => ({ default: m.BattlePage })))
const DailyQuestsPage   = lazy(() => import('@/pages/DailyQuestsPage').then(m => ({ default: m.DailyQuestsPage })))
const WeeklyQuestsPage  = lazy(() => import('@/pages/WeeklyQuestsPage').then(m => ({ default: m.WeeklyQuestsPage })))
const BattlePassPage    = lazy(() => import('@/pages/BattlePassPage').then(m => ({ default: m.BattlePassPage })))
const AchievementsPage  = lazy(() => import('@/pages/AchievementsPage').then(m => ({ default: m.AchievementsPage })))
const SettingsPage      = lazy(() => import('@/pages/SettingsPage').then(m => ({ default: m.SettingsPage })))
const StatisticsPage    = lazy(() => import('@/pages/StatisticsPage').then(m => ({ default: m.StatisticsPage })))
const ReferralPage      = lazy(() => import('@/pages/ReferralPage').then(m => ({ default: m.ReferralPage })))
const MailPage          = lazy(() => import('@/pages/MailPage').then(m => ({ default: m.MailPage })))
const LuckyWheelPage   = lazy(() => import('@/pages/LuckyWheelPage').then(m => ({ default: m.LuckyWheelPage })))

// ─── Admin pages (lazily loaded, rarely visited) ──────────────────────────────
const AdminDashboard    = lazy(() => import('@/pages/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })))
const AdminPlayersPage  = lazy(() => import('@/pages/admin/AdminPlayersPage').then(m => ({ default: m.AdminPlayersPage })))
const AdminEconomyPage  = lazy(() => import('@/pages/admin/AdminEconomyPage').then(m => ({ default: m.AdminEconomyPage })))
const AdminEventsPage   = lazy(() => import('@/pages/admin/AdminEventsPage').then(m => ({ default: m.AdminEventsPage })))
const AdminFamiliesPage = lazy(() => import('@/pages/admin/AdminFamiliesPage').then(m => ({ default: m.AdminFamiliesPage })))
const AdminBattlesPage  = lazy(() => import('@/pages/admin/AdminBattlesPage').then(m => ({ default: m.AdminBattlesPage })))
const AdminSuspiciousPage = lazy(() => import('@/pages/admin/AdminSuspiciousPage').then(m => ({ default: m.AdminSuspiciousPage })))

// ─── Loading fallback ─────────────────────────────────────────────────────────

function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
      <Spinner className="h-7 w-7 text-gold" />
      <p className="text-xs text-muted-foreground font-display tracking-wider">YUKLENIYOR...</p>
    </div>
  )
}

// ─── Auth guard ───────────────────────────────────────────────────────────────

function GameGuard({ children }: { children: React.ReactNode }) {
  const session = useGameStore(s => s.session)
  const isGuest = useGuestStore(s => s.isGuest)
  if (!session && !isGuest) return <Navigate to="/login" replace />
  return <>{children}</>
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const { session, setSession, loadAllData } = useGameStore()
  const { isGuest } = useGuestStore()
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setInitializing(false)
    }).catch(() => {
      setInitializing(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [setSession])

  useEffect(() => {
    if (session) loadAllData()
  }, [session, loadAllData])

  if (initializing) {
    return (
      <div className="flex items-center justify-center h-dvh bg-background">
        <div className="text-center space-y-3">
          <Spinner className="h-8 w-8 mx-auto text-gold" />
          <p className="text-xs text-muted-foreground font-display tracking-wider">YUKLENIYOR...</p>
        </div>
      </div>
    )
  }

  const isPlayable = !!session || isGuest

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={isPlayable ? <Navigate to="/city" replace /> : <LoginPage />} />

          <Route element={<GameGuard><GameLayout /></GameGuard>}>
            {/* Eagerly loaded core pages */}
            <Route path="/city"     element={<ErrorBoundary><CityPage /></ErrorBoundary>} />
            <Route path="/missions" element={<ErrorBoundary><MissionsPage /></ErrorBoundary>} />
            <Route path="/profile"  element={<ErrorBoundary><ProfilePage /></ErrorBoundary>} />

            {/* Lazily loaded pages */}
            <Route path="/map"          element={<ErrorBoundary><Suspense fallback={<PageLoader />}><MapPage /></Suspense></ErrorBoundary>} />
            <Route path="/family"       element={<ErrorBoundary><Suspense fallback={<PageLoader />}><FamilyPage /></Suspense></ErrorBoundary>} />
            <Route path="/shop"         element={<ErrorBoundary><Suspense fallback={<PageLoader />}><ShopPage /></Suspense></ErrorBoundary>} />
            <Route path="/vip"          element={<ErrorBoundary><Suspense fallback={<PageLoader />}><ShopPage /></Suspense></ErrorBoundary>} />
            <Route path="/enforcers"    element={<ErrorBoundary><Suspense fallback={<PageLoader />}><EnforcersPage /></Suspense></ErrorBoundary>} />
            <Route path="/research"     element={<ErrorBoundary><Suspense fallback={<PageLoader />}><ResearchPage /></Suspense></ErrorBoundary>} />
            <Route path="/troops"       element={<ErrorBoundary><Suspense fallback={<PageLoader />}><TroopsPage /></Suspense></ErrorBoundary>} />
            <Route path="/battle"       element={<ErrorBoundary><Suspense fallback={<PageLoader />}><BattlePage /></Suspense></ErrorBoundary>} />
            <Route path="/leaderboard"  element={<ErrorBoundary><Suspense fallback={<PageLoader />}><LeaderboardPage /></Suspense></ErrorBoundary>} />
            <Route path="/events"       element={<ErrorBoundary><Suspense fallback={<PageLoader />}><EventsPage /></Suspense></ErrorBoundary>} />
            <Route path="/daily-quests" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><DailyQuestsPage /></Suspense></ErrorBoundary>} />
            <Route path="/weekly-quests" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><WeeklyQuestsPage /></Suspense></ErrorBoundary>} />
            <Route path="/battle-pass"  element={<ErrorBoundary><Suspense fallback={<PageLoader />}><BattlePassPage /></Suspense></ErrorBoundary>} />
            <Route path="/achievements" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><AchievementsPage /></Suspense></ErrorBoundary>} />
            <Route path="/settings"     element={<ErrorBoundary><Suspense fallback={<PageLoader />}><SettingsPage /></Suspense></ErrorBoundary>} />
            <Route path="/statistics"   element={<ErrorBoundary><Suspense fallback={<PageLoader />}><StatisticsPage /></Suspense></ErrorBoundary>} />
            <Route path="/referral"     element={<ErrorBoundary><Suspense fallback={<PageLoader />}><ReferralPage /></Suspense></ErrorBoundary>} />
            <Route path="/mail"         element={<ErrorBoundary><Suspense fallback={<PageLoader />}><MailPage /></Suspense></ErrorBoundary>} />
            <Route path="/wheel"        element={<ErrorBoundary><Suspense fallback={<PageLoader />}><LuckyWheelPage /></Suspense></ErrorBoundary>} />
          </Route>

          <Route element={<AdminLayout />}>
            <Route path="/admin"                element={<Suspense fallback={<PageLoader />}><AdminDashboard /></Suspense>} />
            <Route path="/admin/players"        element={<Suspense fallback={<PageLoader />}><AdminPlayersPage /></Suspense>} />
            <Route path="/admin/economy"        element={<Suspense fallback={<PageLoader />}><AdminEconomyPage /></Suspense>} />
            <Route path="/admin/events"         element={<Suspense fallback={<PageLoader />}><AdminEventsPage /></Suspense>} />
            <Route path="/admin/families"       element={<Suspense fallback={<PageLoader />}><AdminFamiliesPage /></Suspense>} />
            <Route path="/admin/battles"        element={<Suspense fallback={<PageLoader />}><AdminBattlesPage /></Suspense>} />
            <Route path="/admin/suspicious"     element={<Suspense fallback={<PageLoader />}><AdminSuspiciousPage /></Suspense>} />
          </Route>

          <Route path="*" element={<Navigate to={isPlayable ? '/city' : '/login'} replace />} />
        </Routes>
        <Toaster position="top-center" richColors />
      </BrowserRouter>
    </ErrorBoundary>
  )
}
