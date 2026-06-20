import { useEffect, useState, useCallback } from 'react'
import * as adminDb from '@/lib/supabase/adminDatabase'
import type { AdminBattle } from '@/types/admin'
import { Spinner } from '@/components/ui/spinner'
import { Search } from 'lucide-react'

function ResultBadge({ result }: { result: string }) {
  if (result === 'attacker_win') return <span className="text-[10px] bg-green-900/40 text-green-300 border border-green-700 px-1.5 py-0.5 rounded">Saldırgan Kazandı</span>
  if (result === 'defender_win') return <span className="text-[10px] bg-red-900/40 text-red-300 border border-red-700 px-1.5 py-0.5 rounded">Savunucu Kazandı</span>
  return <span className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">{result}</span>
}

export function AdminBattlesPage() {
  const [battles, setBattles] = useState<AdminBattle[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [playerFilter, setPlayerFilter] = useState('')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50

  const load = useCallback(async () => {
    setLoading(true)
    const r = await adminDb.getBattles(undefined, PAGE_SIZE, page * PAGE_SIZE)
    setBattles(r.battles)
    setTotal(r.total)
    setLoading(false)
  }, [page])

  useEffect(() => { setPage(0) }, [playerFilter])
  useEffect(() => { load() }, [load])

  const filtered = playerFilter.trim()
    ? battles.filter(b =>
        b.attacker_name?.toLowerCase().includes(playerFilter.toLowerCase()) ||
        b.defender_name?.toLowerCase().includes(playerFilter.toLowerCase())
      )
    : battles

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">Savaş Raporları</h1>
        <p className="text-sm text-gray-400">{total} toplam savaş</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <input
          value={playerFilter}
          onChange={e => setPlayerFilter(e.target.value)}
          placeholder="Oyuncu adına göre filtrele..."
          className="w-full pl-9 pr-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-xs text-gray-500">
              <th className="px-4 py-3 text-left font-medium">Saldırgan</th>
              <th className="px-4 py-3 text-left font-medium">Savunucu</th>
              <th className="px-4 py-3 text-left font-medium">Tür</th>
              <th className="px-4 py-3 text-left font-medium">Sonuç</th>
              <th className="px-4 py-3 text-right font-medium">ATK Güç</th>
              <th className="px-4 py-3 text-right font-medium">DEF Güç</th>
              <th className="px-4 py-3 text-right font-medium">Tarih</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading && <tr><td colSpan={7} className="py-12 text-center"><Spinner className="h-6 w-6 mx-auto text-blue-400" /></td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-gray-500">Savaş bulunamadı</td></tr>}
            {!loading && filtered.map(b => (
              <tr key={b.id} className="hover:bg-gray-800/30">
                <td className="px-4 py-3 text-gray-200">{b.attacker_name || '?'}</td>
                <td className="px-4 py-3 text-gray-200">{b.defender_name || '?'}</td>
                <td className="px-4 py-3 text-gray-400 capitalize">{b.battle_type}</td>
                <td className="px-4 py-3"><ResultBadge result={b.result} /></td>
                <td className="px-4 py-3 text-right text-red-400">{b.attacker_power.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-blue-400">{b.defender_power.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-gray-500 text-xs">{new Date(b.created_at).toLocaleString('tr-TR')}</td>
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
    </div>
  )
}
