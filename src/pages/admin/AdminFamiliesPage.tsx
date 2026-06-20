import { useEffect, useState, useCallback } from 'react'
import * as adminDb from '@/lib/supabase/adminDatabase'
import type { AdminFamily, AdminFamilyMember } from '@/types/admin'
import { Spinner } from '@/components/ui/spinner'
import { Shield, Users, X } from 'lucide-react'

function FamilyDetailDialog({ familyId, onClose }: { familyId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<{ family: AdminFamily; members: AdminFamilyMember[] } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminDb.getFamily(familyId).then(d => { setDetail(d); setLoading(false) })
  }, [familyId])

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-900 px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="font-semibold text-white">
            {detail?.family ? `[${detail.family.tag}] ${detail.family.name}` : 'Aile Detayı'}
          </h3>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>
        {loading && <div className="py-12 flex justify-center"><Spinner className="h-6 w-6 text-blue-400" /></div>}
        {!loading && detail && (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Güç', value: detail.family.power.toLocaleString() },
                { label: 'Seviye', value: detail.family.level },
                { label: 'Bölge', value: detail.family.territory_count },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-800 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-gray-500">{label}</p>
                  <p className="text-sm font-bold text-white">{value}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
                Üyeler ({detail.members.length})
              </p>
              <div className="space-y-1">
                {detail.members.map(m => (
                  <div key={m.id} className="bg-gray-800/50 rounded p-2.5 flex items-center justify-between text-sm">
                    <div>
                      <p className="text-gray-200 font-medium">{m.username}</p>
                      <p className="text-[10px] text-gray-500">Lv.{m.level} · Rütbe {m.rank}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-yellow-400 text-xs">{m.power.toLocaleString()}</p>
                      <p className="text-[10px] text-gray-500">{m.contribution.toLocaleString()} katkı</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="pt-2 space-y-2">
              <p className="text-xs text-gray-500 font-medium">Placeholder İşlemler</p>
              <div className="flex gap-2">
                <button disabled className="px-3 py-1.5 bg-gray-700 rounded text-xs text-gray-500 cursor-not-allowed">Lider Değiştir</button>
                <button disabled className="px-3 py-1.5 bg-red-900/30 rounded text-xs text-red-700 cursor-not-allowed">Aileyi Kapat</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function AdminFamiliesPage() {
  const [families, setFamilies] = useState<AdminFamily[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50

  const load = useCallback(async () => {
    setLoading(true)
    const r = await adminDb.getFamilies(PAGE_SIZE, page * PAGE_SIZE)
    setFamilies(r.families)
    setTotal(r.total)
    setLoading(false)
  }, [page])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">Aile Yönetimi</h1>
        <p className="text-sm text-gray-400">{total} aile</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-xs text-gray-500">
              <th className="px-4 py-3 text-left font-medium">Aile</th>
              <th className="px-4 py-3 text-left font-medium">Lider</th>
              <th className="px-4 py-3 text-right font-medium">Üyeler</th>
              <th className="px-4 py-3 text-right font-medium">Bölge</th>
              <th className="px-4 py-3 text-right font-medium">Güç</th>
              <th className="px-4 py-3 text-right font-medium">Seviye</th>
              <th className="px-4 py-3 text-right font-medium">Kuruluş</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading && <tr><td colSpan={7} className="py-12 text-center"><Spinner className="h-6 w-6 mx-auto text-blue-400" /></td></tr>}
            {!loading && families.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-gray-500">Aile bulunamadı</td></tr>}
            {!loading && families.map(f => (
              <tr key={f.id} className="hover:bg-gray-800/40 cursor-pointer" onClick={() => setSelectedId(f.id)}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-700 to-amber-900 flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-black text-yellow-300">{f.tag}</span>
                    </div>
                    <p className="text-gray-200 font-medium">{f.name}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-400">{f.leader_name || '—'}</td>
                <td className="px-4 py-3 text-right">
                  <span className="flex items-center justify-end gap-1 text-gray-300">
                    <Users className="h-3 w-3" />{f.member_count}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="flex items-center justify-end gap-1 text-gray-300">
                    <Shield className="h-3 w-3" />{f.territory_count}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-yellow-400 font-medium">{(f.power/1000).toFixed(0)}K</td>
                <td className="px-4 py-3 text-right text-blue-400">Lv.{f.level}</td>
                <td className="px-4 py-3 text-right text-gray-500 text-xs">{new Date(f.created_at).toLocaleDateString('tr-TR')}</td>
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
        <FamilyDetailDialog familyId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  )
}
