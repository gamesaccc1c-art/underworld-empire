import { useEffect, useState } from 'react'
import * as adminDb from '@/lib/supabase/adminDatabase'
import type { DashboardStats } from '@/types/admin'
import { Spinner } from '@/components/ui/spinner'
import { Users, ShoppingBag, Gem, TrendingUp, TriangleAlert as AlertTriangle, Swords, Trophy, Shield } from 'lucide-react'

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: string | number; color: string
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <p className={`text-2xl font-bold ${color}`}>{typeof value === 'number' ? value.toLocaleString() : value}</p>
    </div>
  )
}

function SeverityBadge({ severity }: { severity: string }) {
  const cls = severity === 'high' ? 'bg-red-900/50 text-red-300 border-red-700' :
              severity === 'medium' ? 'bg-yellow-900/50 text-yellow-300 border-yellow-700' :
              'bg-gray-800 text-gray-400 border-gray-700'
  return <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${cls}`}>{severity}</span>
}

function ResultBadge({ result }: { result: string }) {
  const cls = result === 'attacker_win' ? 'text-green-400' : result === 'defender_win' ? 'text-red-400' : 'text-gray-400'
  return <span className={`text-xs font-medium ${cls}`}>{result === 'attacker_win' ? 'Saldırgan Kazandı' : result === 'defender_win' ? 'Savunucu Kazandı' : result}</span>
}

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminDb.getDashboardStats().then(s => {
      setStats(s)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner className="h-8 w-8 text-blue-400" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="p-8 text-center text-gray-400">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
        <p>İstatistikler yüklenemedi</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-gray-400">Oyun genelinde genel bakış</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}     label="Toplam Oyuncu"  value={stats.total_players}      color="text-blue-400" />
        <StatCard icon={ShoppingBag} label="Toplam Satın Alma" value={stats.total_purchases} color="text-green-400" />
        <StatCard icon={Gem}       label="Elmas Harcandı" value={stats.total_diamond_spent} color="text-purple-400" />
        <StatCard icon={TrendingUp} label="Aktif Bugün"   value="—"                         color="text-yellow-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Players */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-400" />
            <h2 className="text-sm font-semibold">En Güçlü Oyuncular</h2>
          </div>
          <div className="divide-y divide-gray-800">
            {stats.top_players.slice(0, 8).map((p, i) => (
              <div key={p.id} className="px-4 py-2.5 flex items-center gap-3">
                <span className="text-xs text-gray-500 w-5">#{i+1}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${p.is_banned ? 'text-red-400 line-through' : 'text-gray-200'}`}>{p.username}</p>
                  <p className="text-[10px] text-gray-500">Lv.{p.level} · VIP{p.vip_level}</p>
                </div>
                <span className="text-xs text-yellow-400 font-bold">{p.power.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Families */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-400" />
            <h2 className="text-sm font-semibold">En Güçlü Aileler</h2>
          </div>
          <div className="divide-y divide-gray-800">
            {stats.top_families.slice(0, 8).map((f, i) => (
              <div key={f.id} className="px-4 py-2.5 flex items-center gap-3">
                <span className="text-xs text-gray-500 w-5">#{i+1}</span>
                <div className="h-7 w-7 rounded bg-gradient-to-br from-amber-700 to-amber-900 flex items-center justify-center shrink-0">
                  <span className="text-[9px] font-black text-yellow-300">{f.tag}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-gray-200">{f.name}</p>
                  <p className="text-[10px] text-gray-500">{f.member_count} üye · {f.territory_count} bölge</p>
                </div>
                <span className="text-xs text-blue-400 font-bold">{(f.power/1000).toFixed(0)}K</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Battles */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
            <Swords className="h-4 w-4 text-red-400" />
            <h2 className="text-sm font-semibold">Son Savaşlar</h2>
          </div>
          <div className="divide-y divide-gray-800">
            {stats.recent_battles.length === 0 && (
              <p className="px-4 py-4 text-sm text-gray-500">Henüz savaş yok</p>
            )}
            {stats.recent_battles.map(b => (
              <div key={b.id} className="px-4 py-2.5 text-xs space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">{b.attacker_name || '?'} <span className="text-gray-600">vs</span> {b.defender_name || '?'}</span>
                  <ResultBadge result={b.result} />
                </div>
                <p className="text-gray-500">{new Date(b.created_at).toLocaleString('tr-TR')}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Suspicious */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-400" />
            <h2 className="text-sm font-semibold">Son Şüpheli Aktiviteler</h2>
          </div>
          <div className="divide-y divide-gray-800">
            {stats.recent_suspicious.length === 0 && (
              <p className="px-4 py-4 text-sm text-gray-500">Şüpheli aktivite yok</p>
            )}
            {stats.recent_suspicious.slice(0, 8).map(s => (
              <div key={s.id} className="px-4 py-2.5 flex items-start gap-2.5">
                <SeverityBadge severity={s.severity} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-300 truncate">{s.activity_type}</p>
                  <p className="text-[10px] text-gray-500">{s.username || s.user_id?.slice(0,8)}</p>
                </div>
                <p className="text-[10px] text-gray-600 shrink-0">{new Date(s.created_at).toLocaleDateString('tr-TR')}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Purchases */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-green-400" />
          <h2 className="text-sm font-semibold">Son Satın Almalar</h2>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500">
              <th className="px-4 py-2 text-left font-medium">Oyuncu</th>
              <th className="px-4 py-2 text-left font-medium">Ürün</th>
              <th className="px-4 py-2 text-right font-medium">Tutar</th>
              <th className="px-4 py-2 text-right font-medium">Tarih</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {stats.recent_purchases.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-4 text-center text-gray-500">Satın alma yok</td></tr>
            )}
            {stats.recent_purchases.map(p => (
              <tr key={p.id} className="hover:bg-gray-800/50">
                <td className="px-4 py-2.5 text-gray-300">{p.username || '—'}</td>
                <td className="px-4 py-2.5 text-gray-400">{p.product_name || p.sku || '—'}</td>
                <td className="px-4 py-2.5 text-right text-green-400 font-medium">
                  {(p.amount || 0).toLocaleString()} {p.currency}
                </td>
                <td className="px-4 py-2.5 text-right text-gray-500">
                  {new Date(p.created_at).toLocaleDateString('tr-TR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
