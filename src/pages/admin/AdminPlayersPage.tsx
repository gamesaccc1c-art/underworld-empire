import { useEffect, useState, useCallback } from 'react'
import * as adminDb from '@/lib/supabase/adminDatabase'
import type { AdminPlayer } from '@/types/admin'
import { Spinner } from '@/components/ui/spinner'
import { Search, Ban, CircleCheck as CheckCircle, FileSliders as Sliders, ChevronRight, X } from 'lucide-react'
import { toast } from 'sonner'

const RESOURCES = ['cash','diamonds','influence','loyalty','weapon_power','black_money','intel','xp','power']

function ResourceAdjustDialog({ player, onClose, onDone }: {
  player: AdminPlayer
  onClose: () => void
  onDone: () => void
}) {
  const [resource, setResource] = useState('cash')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit() {
    const n = parseInt(amount)
    if (!n || !reason.trim()) { toast.error('Miktar ve sebep gerekli'); return }
    setLoading(true)
    const r = await adminDb.adjustResources(player.id, resource, n, reason)
    setLoading(false)
    if (r.ok) { toast.success('Kaynak düzenlendi'); onDone(); onClose() }
    else toast.error(r.error || 'Hata')
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">Kaynak Düzenle — {player.username}</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-gray-400" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Kaynak</label>
            <select
              value={resource}
              onChange={e => setResource(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
            >
              {RESOURCES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Miktar (negatif = azalt)</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="örn. 5000 veya -1000"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Sebep</label>
            <input
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Düzenleme sebebi"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-gray-800 rounded text-sm text-gray-300 hover:bg-gray-700 transition-colors">İptal</button>
          <button onClick={submit} disabled={loading} className="flex-1 px-4 py-2 bg-blue-600 rounded text-sm text-white hover:bg-blue-700 transition-colors disabled:opacity-50">
            {loading ? <Spinner className="h-4 w-4 mx-auto" /> : 'Uygula'}
          </button>
        </div>
      </div>
    </div>
  )
}

function PlayerDetailPanel({ playerId, onClose, onRefresh }: {
  playerId: string
  onClose: () => void
  onRefresh: () => void
}) {
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof adminDb.getPlayer>>>(null)
  const [loading, setLoading] = useState(true)
  const [adjusting, setAdjusting] = useState(false)
  const [banning, setBanning] = useState(false)
  const [banReason, setBanReason] = useState('')

  useEffect(() => {
    adminDb.getPlayer(playerId).then(d => { setDetail(d); setLoading(false) })
  }, [playerId])

  async function handleBan() {
    if (!detail?.player) return
    if (detail.player.is_banned) {
      const r = await adminDb.unbanPlayer(playerId)
      if (r.ok) { toast.success('Ban kaldırıldı'); onRefresh(); onClose() }
      else toast.error(r.error)
    } else {
      setBanning(true)
    }
  }

  async function confirmBan() {
    if (!banReason.trim()) { toast.error('Sebep gerekli'); return }
    const r = await adminDb.banPlayer(playerId, banReason)
    if (r.ok) { toast.success('Oyuncu banlandı'); onRefresh(); onClose() }
    else toast.error(r.error)
  }

  if (loading) return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <Spinner className="h-8 w-8 text-blue-400" />
    </div>
  )

  const p = detail?.player
  if (!p) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end md:items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-t-2xl md:rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-900 px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white">{p.username}</h3>
            <p className="text-xs text-gray-400">{p.email}</p>
          </div>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>

        <div className="p-5 space-y-5">
          {p.is_banned && (
            <div className="bg-red-950/30 border border-red-800 rounded-lg p-3 text-sm text-red-300">
              Banlı: {p.ban_reason || 'Sebep belirtilmedi'}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Seviye', value: p.level },
              { label: 'Güç', value: p.power.toLocaleString() },
              { label: 'VIP', value: p.vip_level },
              { label: 'Polis Isısı', value: `${p.police_heat}%` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-800 rounded-lg p-3">
                <p className="text-[10px] text-gray-500 mb-0.5">{label}</p>
                <p className="text-sm font-bold text-white">{value}</p>
              </div>
            ))}
          </div>

          <div>
            <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">Kaynaklar</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { k: 'cash', v: p.cash, color: 'text-yellow-400' },
                { k: 'diamonds', v: p.diamonds, color: 'text-purple-400' },
                { k: 'influence', v: p.influence, color: 'text-blue-400' },
                { k: 'loyalty', v: p.loyalty, color: 'text-green-400' },
                { k: 'weapon_power', v: p.weapon_power, color: 'text-red-400' },
                { k: 'black_money', v: p.black_money, color: 'text-gray-300' },
                { k: 'intel', v: p.intel, color: 'text-cyan-400' },
                { k: 'xp', v: p.xp, color: 'text-orange-400' },
              ].map(({ k, v, color }) => (
                <div key={k} className="bg-gray-800/50 rounded p-2">
                  <p className="text-[10px] text-gray-500">{k}</p>
                  <p className={`text-sm font-semibold ${color}`}>{v.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>

          {(detail?.buildings as { id: string; building_name?: string; level: number }[])?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">Binalar ({(detail?.buildings as unknown[])?.length})</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                {(detail?.buildings as { id: string; building_name?: string; level: number }[]).map((b) => (
                  <div key={b.id} className="bg-gray-800/50 rounded p-2 text-xs">
                    <p className="text-gray-300 truncate">{b.building_name || b.id}</p>
                    <p className="text-gray-500">Lv.{b.level}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(detail?.recent_battles as { id: string; result: string; battle_type: string; opponent?: string; created_at: string }[])?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">Son Savaşlar</p>
              <div className="space-y-1.5">
                {(detail?.recent_battles as { id: string; result: string; battle_type: string; opponent?: string; created_at: string }[]).map((b) => (
                  <div key={b.id} className="bg-gray-800/50 rounded p-2 flex items-center justify-between text-xs">
                    <span className="text-gray-300">{b.battle_type} vs {b.opponent || '?'}</span>
                    <span className={b.result === 'attacker_win' ? 'text-green-400' : 'text-red-400'}>
                      {b.result === 'attacker_win' ? 'Kazandı' : 'Kaybetti'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setAdjusting(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 rounded text-sm text-white hover:bg-blue-700 transition-colors"
            >
              <Sliders className="h-3.5 w-3.5" /> Kaynak Düzenle
            </button>
            <button
              onClick={handleBan}
              className={`flex items-center gap-1.5 px-4 py-2 rounded text-sm transition-colors ${
                p.is_banned
                  ? 'bg-green-700 hover:bg-green-600 text-white'
                  : 'bg-red-700 hover:bg-red-600 text-white'
              }`}
            >
              {p.is_banned ? <><CheckCircle className="h-3.5 w-3.5" /> Ban Kaldır</> : <><Ban className="h-3.5 w-3.5" /> Banla</>}
            </button>
          </div>

          {banning && (
            <div className="border border-red-800 rounded-lg p-3 space-y-2 bg-red-950/20">
              <p className="text-sm text-red-300">Ban sebebi girin:</p>
              <input
                value={banReason}
                onChange={e => setBanReason(e.target.value)}
                placeholder="Kural ihlali, hile vb."
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
              />
              <div className="flex gap-2">
                <button onClick={() => setBanning(false)} className="px-3 py-1.5 bg-gray-800 rounded text-xs text-gray-300">İptal</button>
                <button onClick={confirmBan} className="px-3 py-1.5 bg-red-600 rounded text-xs text-white">Onayla</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {adjusting && p && (
        <ResourceAdjustDialog
          player={p}
          onClose={() => setAdjusting(false)}
          onDone={onRefresh}
        />
      )}
    </div>
  )
}

export function AdminPlayersPage() {
  const [players, setPlayers] = useState<AdminPlayer[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50

  const load = useCallback(async () => {
    setLoading(true)
    const r = await adminDb.getPlayers(search || undefined, PAGE_SIZE, page * PAGE_SIZE)
    setPlayers(r.players)
    setTotal(r.total)
    setLoading(false)
  }, [search, page])

  useEffect(() => { setPage(0) }, [search])
  useEffect(() => { load() }, [load])

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Oyuncu Yönetimi</h1>
          <p className="text-sm text-gray-400">{total} oyuncu</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Kullanıcı adı veya e-posta ara..."
          className="w-full pl-9 pr-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-xs text-gray-500">
              <th className="px-4 py-3 text-left font-medium">Oyuncu</th>
              <th className="px-4 py-3 text-left font-medium">Seviye / Güç</th>
              <th className="px-4 py-3 text-left font-medium">VIP</th>
              <th className="px-4 py-3 text-left font-medium">Durum</th>
              <th className="px-4 py-3 text-left font-medium">Kayıt</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading && (
              <tr><td colSpan={6} className="py-12 text-center"><Spinner className="h-6 w-6 mx-auto text-blue-400" /></td></tr>
            )}
            {!loading && players.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-gray-500">Oyuncu bulunamadı</td></tr>
            )}
            {!loading && players.map(p => (
              <tr key={p.id} className="hover:bg-gray-800/40 cursor-pointer" onClick={() => setSelectedId(p.id)}>
                <td className="px-4 py-3">
                  <p className={`font-medium ${p.is_banned ? 'text-red-400 line-through' : 'text-gray-200'}`}>{p.username}</p>
                  <p className="text-[10px] text-gray-500 truncate max-w-[200px]">{p.email}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-gray-300">Lv.{p.level}</p>
                  <p className="text-[10px] text-yellow-400">{p.power.toLocaleString()} güç</p>
                </td>
                <td className="px-4 py-3 text-gray-400">{p.vip_level > 0 ? `VIP${p.vip_level}` : '—'}</td>
                <td className="px-4 py-3">
                  {p.is_banned
                    ? <span className="text-[10px] bg-red-900/50 text-red-300 border border-red-700 px-1.5 py-0.5 rounded">Banlı</span>
                    : p.role === 'admin'
                      ? <span className="text-[10px] bg-blue-900/50 text-blue-300 border border-blue-700 px-1.5 py-0.5 rounded">Admin</span>
                      : <span className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">Normal</span>
                  }
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{new Date(p.created_at).toLocaleDateString('tr-TR')}</td>
                <td className="px-4 py-3">
                  <ChevronRight className="h-4 w-4 text-gray-600" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>{page * PAGE_SIZE + 1}–{Math.min((page+1)*PAGE_SIZE, total)} / {total}</span>
          <div className="flex gap-2">
            <button disabled={page === 0} onClick={() => setPage(p => p-1)} className="px-3 py-1.5 bg-gray-800 rounded disabled:opacity-40">← Önceki</button>
            <button disabled={(page+1)*PAGE_SIZE >= total} onClick={() => setPage(p => p+1)} className="px-3 py-1.5 bg-gray-800 rounded disabled:opacity-40">Sonraki →</button>
          </div>
        </div>
      )}

      {selectedId && (
        <PlayerDetailPanel
          playerId={selectedId}
          onClose={() => setSelectedId(null)}
          onRefresh={load}
        />
      )}
    </div>
  )
}
