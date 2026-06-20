import { useEffect, useState, useCallback } from 'react'
import * as adminDb from '@/lib/supabase/adminDatabase'
import type { AdminSuspicious } from '@/types/admin'
import { Spinner } from '@/components/ui/spinner'
import { ChevronDown } from 'lucide-react'

function SeverityBadge({ severity }: { severity: string }) {
  const cls = severity === 'high' ? 'bg-red-900/50 text-red-300 border-red-700' :
              severity === 'medium' ? 'bg-yellow-900/50 text-yellow-300 border-yellow-700' :
              'bg-gray-800 text-gray-400 border-gray-700'
  return <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${cls}`}>{severity}</span>
}

function PayloadViewer({ payload }: { payload: Record<string, unknown> }) {
  const [open, setOpen] = useState(false)
  const entries = Object.entries(payload).filter(([k]) => k !== 'severity' && k !== 'description')
  if (entries.length === 0) return null
  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-400 mt-1"
      >
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        Detay
      </button>
      {open && (
        <div className="mt-1 bg-gray-900 rounded p-2 text-[10px] font-mono text-gray-400 space-y-0.5">
          {entries.map(([k, v]) => (
            <div key={k}><span className="text-gray-500">{k}:</span> {String(v)}</div>
          ))}
        </div>
      )}
    </div>
  )
}

const SEVERITIES = ['all', 'high', 'medium', 'low']

export function AdminSuspiciousPage() {
  const [items, setItems] = useState<AdminSuspicious[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [severity, setSeverity] = useState('all')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 100

  const load = useCallback(async () => {
    setLoading(true)
    const r = await adminDb.getSuspicious(
      severity === 'all' ? undefined : severity,
      PAGE_SIZE,
      page * PAGE_SIZE,
    )
    setItems(r.items)
    setTotal(r.total)
    setLoading(false)
  }, [severity, page])

  useEffect(() => { setPage(0) }, [severity])
  useEffect(() => { load() }, [load])

  const counts = { high: 0, medium: 0, low: 0 }
  items.forEach(i => { if (i.severity in counts) counts[i.severity as keyof typeof counts]++ })

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">Şüpheli Aktivite</h1>
        <p className="text-sm text-gray-400">{total} kayıt</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Yüksek', key: 'high', color: 'text-red-400', bg: 'bg-red-900/20 border-red-800' },
          { label: 'Orta', key: 'medium', color: 'text-yellow-400', bg: 'bg-yellow-900/20 border-yellow-800' },
          { label: 'Düşük', key: 'low', color: 'text-gray-400', bg: 'bg-gray-900 border-gray-700' },
        ].map(({ label, key, color, bg }) => (
          <div key={key} className={`border rounded-xl p-4 ${bg}`}>
            <p className="text-xs text-gray-500">{label} Risk</p>
            <p className={`text-2xl font-bold ${color}`}>{counts[key as keyof typeof counts]}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        {SEVERITIES.map(s => (
          <button
            key={s}
            onClick={() => setSeverity(s)}
            className={`px-3 py-1.5 rounded text-xs transition-colors capitalize ${
              severity === s ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {s === 'all' ? 'Tümü' : s}
          </button>
        ))}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-xs text-gray-500">
              <th className="px-4 py-3 text-left font-medium">Severity</th>
              <th className="px-4 py-3 text-left font-medium">Tip</th>
              <th className="px-4 py-3 text-left font-medium">Oyuncu</th>
              <th className="px-4 py-3 text-left font-medium">Açıklama</th>
              <th className="px-4 py-3 text-right font-medium">Tarih</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading && <tr><td colSpan={5} className="py-12 text-center"><Spinner className="h-6 w-6 mx-auto text-blue-400" /></td></tr>}
            {!loading && items.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-gray-500">Kayıt bulunamadı</td></tr>}
            {!loading && items.map(item => (
              <tr key={item.id} className="hover:bg-gray-800/30 align-top">
                <td className="px-4 py-3"><SeverityBadge severity={item.severity} /></td>
                <td className="px-4 py-3 text-gray-300 font-mono text-xs">{item.activity_type}</td>
                <td className="px-4 py-3">
                  <p className="text-gray-200 text-sm">{item.username || '—'}</p>
                  <p className="text-[10px] text-gray-600 truncate max-w-[120px]">{item.email || item.user_id?.slice(0,12)}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-gray-400 text-xs">{item.description}</p>
                  <PayloadViewer payload={item.payload} />
                </td>
                <td className="px-4 py-3 text-right text-gray-500 text-xs whitespace-nowrap">
                  {new Date(item.created_at).toLocaleString('tr-TR')}
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
    </div>
  )
}
