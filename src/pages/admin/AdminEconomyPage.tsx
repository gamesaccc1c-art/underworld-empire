import { useEffect, useState } from 'react'
import * as adminDb from '@/lib/supabase/adminDatabase'
import type { AdminProduct } from '@/types/admin'
import { Spinner } from '@/components/ui/spinner'
import { CreditCard as Edit2, X, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'

function ProductEditDialog({ product, onClose, onDone }: {
  product: AdminProduct
  onClose: () => void
  onDone: () => void
}) {
  const [name, setName] = useState(product.name)
  const [price, setPrice] = useState(String(product.price))
  const [isActive, setIsActive] = useState(product.is_active)
  const [contents, setContents] = useState(JSON.stringify(product.contents, null, 2))
  const [loading, setLoading] = useState(false)
  const [contentsError, setContentsError] = useState('')

  async function save() {
    let parsedContents: Record<string, number> | undefined
    try {
      parsedContents = JSON.parse(contents)
    } catch {
      setContentsError('Geçersiz JSON')
      return
    }
    setContentsError('')
    setLoading(true)
    const r = await adminDb.updateProduct(product.id, {
      name,
      price: parseInt(price) || product.price,
      is_active: isActive,
      contents: parsedContents,
    })
    setLoading(false)
    if (r.ok) { toast.success('Ürün güncellendi'); onDone(); onClose() }
    else toast.error(r.error || 'Hata')
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">Ürün Düzenle</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-gray-400" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Ürün Adı</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Fiyat ({product.currency})</label>
            <input type="number" value={price} onChange={e => setPrice(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">İçerik (JSON)</label>
            <textarea
              value={contents}
              onChange={e => setContents(e.target.value)}
              rows={6}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-xs font-mono text-white"
            />
            {contentsError && <p className="text-red-400 text-xs mt-1">{contentsError}</p>}
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <div
              onClick={() => setIsActive(v => !v)}
              className={`w-10 h-5 rounded-full transition-colors ${isActive ? 'bg-green-600' : 'bg-gray-700'} relative`}
            >
              <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-sm text-gray-300">{isActive ? 'Aktif' : 'Pasif'}</span>
          </label>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-gray-800 rounded text-sm text-gray-300 hover:bg-gray-700 transition-colors">İptal</button>
          <button onClick={save} disabled={loading} className="flex-1 px-4 py-2 bg-blue-600 rounded text-sm text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {loading ? <Spinner className="h-4 w-4 mx-auto" /> : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ContentPreview({ contents }: { contents: Record<string, number> }) {
  return (
    <div className="flex flex-wrap gap-1">
      {Object.entries(contents).filter(([, v]) => v > 0).map(([k, v]) => (
        <span key={k} className="text-[10px] bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">
          {v.toLocaleString()} {k}
        </span>
      ))}
    </div>
  )
}

export function AdminEconomyPage() {
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [chests, setChests] = useState<Record<string, unknown>[]>([])
  const [vipDefs, setVipDefs] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [editProduct, setEditProduct] = useState<AdminProduct | null>(null)
  const [expandedVip, setExpandedVip] = useState(false)
  const [expandedChests, setExpandedChests] = useState(false)

  async function load() {
    setLoading(true)
    const [p, c, v] = await Promise.all([
      adminDb.getProducts(),
      adminDb.getChests(),
      adminDb.getVipDefs(),
    ])
    setProducts(p)
    setChests(c as Record<string, unknown>[])
    setVipDefs(v as Record<string, unknown>[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function toggleActive(product: AdminProduct) {
    const r = await adminDb.updateProduct(product.id, { is_active: !product.is_active })
    if (r.ok) { toast.success(`Ürün ${product.is_active ? 'pasife alındı' : 'aktif edildi'}`); load() }
    else toast.error(r.error)
  }

  if (loading) return <div className="flex items-center justify-center h-full"><Spinner className="h-8 w-8 text-blue-400" /></div>

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Ekonomi Yönetimi</h1>
        <p className="text-sm text-gray-400">Mağaza ürünleri, sandık oranları, VIP bonusları</p>
      </div>

      {/* Shop Products */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">Mağaza Ürünleri ({products.length})</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-xs text-gray-500">
              <th className="px-4 py-2 text-left font-medium">Ürün</th>
              <th className="px-4 py-2 text-left font-medium">SKU</th>
              <th className="px-4 py-2 text-left font-medium">İçerik</th>
              <th className="px-4 py-2 text-right font-medium">Fiyat</th>
              <th className="px-4 py-2 text-right font-medium">Satış</th>
              <th className="px-4 py-2 text-right font-medium">Durum</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {products.map(p => (
              <tr key={p.id} className="hover:bg-gray-800/30">
                <td className="px-4 py-3">
                  <p className="text-gray-200 font-medium">{p.name}</p>
                  {p.badge && <span className="text-[10px] text-yellow-400">{p.badge}</span>}
                </td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.sku}</td>
                <td className="px-4 py-3"><ContentPreview contents={p.contents} /></td>
                <td className="px-4 py-3 text-right text-green-400 font-medium">
                  {p.price.toLocaleString()} {p.currency}
                </td>
                <td className="px-4 py-3 text-right text-gray-400">{p.purchase_count}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => toggleActive(p)} className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                    p.is_active
                      ? 'bg-green-900/40 text-green-300 border-green-700 hover:bg-green-900/60'
                      : 'bg-gray-800 text-gray-500 border-gray-700 hover:bg-gray-700'
                  }`}>
                    {p.is_active ? <><Check className="h-3 w-3 inline mr-1" />Aktif</> : 'Pasif'}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => setEditProduct(p)} className="p-1.5 hover:bg-gray-700 rounded transition-colors">
                    <Edit2 className="h-3.5 w-3.5 text-gray-400" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Chest Definitions */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <button
          onClick={() => setExpandedChests(v => !v)}
          className="w-full px-4 py-3 border-b border-gray-800 flex items-center justify-between hover:bg-gray-800/30"
        >
          <h2 className="text-sm font-semibold text-white">Sandık Oranları ({chests.length})</h2>
          {expandedChests ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
        </button>
        {expandedChests && (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {chests.map((c) => (
              <div key={String(c.id)} className="bg-gray-800 rounded-lg p-3 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-white capitalize">{String(c.chest_type || '')} Sandık</p>
                  <p className="text-purple-400">{String(c.diamond_cost || 0)} 💎</p>
                </div>
                <div className="space-y-0.5">
                  {Object.entries((c.drop_rates as Record<string, number>) || {}).map(([rarity, rate]) => (
                    <div key={rarity} className="flex justify-between text-gray-400">
                      <span className="capitalize">{rarity}</span>
                      <span>{rate}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* VIP Definitions */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <button
          onClick={() => setExpandedVip(v => !v)}
          className="w-full px-4 py-3 border-b border-gray-800 flex items-center justify-between hover:bg-gray-800/30"
        >
          <h2 className="text-sm font-semibold text-white">VIP Seviye Bonusları ({vipDefs.length})</h2>
          {expandedVip ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
        </button>
        {expandedVip && (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500">
                <th className="px-4 py-2 text-left">VIP Seviye</th>
                <th className="px-4 py-2 text-left">Gerekli Puan</th>
                <th className="px-4 py-2 text-left">Günlük Elmas</th>
                <th className="px-4 py-2 text-left">Özellikler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {vipDefs.map((v) => (
                <tr key={String(v.id)} className="hover:bg-gray-800/30">
                  <td className="px-4 py-2.5 text-yellow-400 font-bold">VIP {String(v.vip_level || 0)}</td>
                  <td className="px-4 py-2.5 text-gray-300">{Number(v.points_required || 0).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-purple-400">{String(v.daily_diamonds || 0)} 💎</td>
                  <td className="px-4 py-2.5 text-gray-400 text-[10px]">
                    {v.perks ? JSON.stringify(v.perks).slice(0, 80) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editProduct && (
        <ProductEditDialog
          product={editProduct}
          onClose={() => setEditProduct(null)}
          onDone={load}
        />
      )}
    </div>
  )
}
