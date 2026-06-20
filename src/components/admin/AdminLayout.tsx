import { useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAdminStore } from '@/stores/adminStore'
import { useGameStore } from '@/stores/gameStore'
import { Spinner } from '@/components/ui/spinner'
import { LayoutDashboard, Users, ShoppingBag, CalendarDays, Swords, Shield, TriangleAlert as AlertTriangle, LogOut, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

const NAV_ITEMS = [
  { to: '/admin',            label: 'Dashboard',       icon: LayoutDashboard, exact: true },
  { to: '/admin/players',    label: 'Oyuncular',       icon: Users },
  { to: '/admin/economy',    label: 'Ekonomi',         icon: ShoppingBag },
  { to: '/admin/events',     label: 'Etkinlikler',     icon: CalendarDays },
  { to: '/admin/families',   label: 'Aileler',         icon: Shield },
  { to: '/admin/battles',    label: 'Savaş Raporları', icon: Swords },
  { to: '/admin/suspicious', label: 'Şüpheli Aktv.',   icon: AlertTriangle },
]

export function AdminLayout() {
  const { isAdmin, checking, checkAdmin } = useAdminStore()
  const session = useGameStore(s => s.session)
  const navigate = useNavigate()

  useEffect(() => { checkAdmin() }, [checkAdmin])

  if (checking || isAdmin === null) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950">
        <Spinner className="h-8 w-8 text-blue-400" />
      </div>
    )
  }

  if (!session || isAdmin === false) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950 text-white">
        <div className="text-center space-y-3">
          <AlertTriangle className="h-12 w-12 text-red-400 mx-auto" />
          <p className="text-lg font-semibold">Erişim Reddedildi</p>
          <p className="text-sm text-gray-400">Bu sayfaya erişim yetkiniz yok.</p>
          <button
            className="mt-4 px-4 py-2 bg-blue-600 rounded text-sm hover:bg-blue-700 transition-colors"
            onClick={() => navigate('/city')}
          >
            Oyuna Dön
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="px-4 py-5 border-b border-gray-800">
          <p className="text-xs font-bold tracking-widest text-blue-400 uppercase">Admin Panel</p>
          <p className="text-[10px] text-gray-500 mt-0.5">Underworld Empire</p>
        </div>
        <nav className="flex-1 py-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ to, label, icon: Icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors rounded-none ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-300 border-r-2 border-blue-500'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-800 space-y-1">
          <NavLink
            to="/city"
            className="flex items-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded transition-colors"
          >
            <ChevronRight className="h-3 w-3" />
            Oyuna Dön
          </NavLink>
          <button
            onClick={() => supabase.auth.signOut().then(() => navigate('/login'))}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded transition-colors"
          >
            <LogOut className="h-3 w-3" />
            Çıkış Yap
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
