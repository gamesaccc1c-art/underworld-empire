import { CalendarDays, Plus, Clock } from 'lucide-react'

export function AdminEventsPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Etkinlik Yönetimi</h1>
          <p className="text-sm text-gray-400">Oyun etkinliklerini oluştur ve yönet</p>
        </div>
        <button className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 rounded text-sm text-white hover:bg-blue-700 transition-colors">
          <Plus className="h-4 w-4" /> Etkinlik Oluştur
        </button>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center space-y-3">
        <CalendarDays className="h-12 w-12 text-gray-600 mx-auto" />
        <p className="text-gray-300 font-medium">Etkinlik Sistemi</p>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          Etkinlik oluşturma, ödül havuzu, sıralama ve premium görev özellikleri yakında eklenecek.
        </p>
        <div className="flex items-center justify-center gap-2 text-xs text-gray-600 mt-4">
          <Clock className="h-3.5 w-3.5" />
          <span>Yakında — v2.0</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: 'Etkinlik Oluştur', desc: 'Başlangıç/bitiş tarihi, ödül havuzu, sıralama tipi, minimum seviye', status: 'Planlanıyor' },
          { title: 'Puan Sistemi', desc: 'Oyunculara otomatik etkinlik puanı ver, sıralama tablosu oluştur', status: 'Planlanıyor' },
          { title: 'Premium Görevler', desc: 'Etkinliğe özel özel görevler ekle, bonus ödüller tanımla', status: 'Planlanıyor' },
        ].map(f => (
          <div key={f.title} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="font-medium text-gray-200 mb-1">{f.title}</p>
            <p className="text-xs text-gray-500 mb-3">{f.desc}</p>
            <span className="text-[10px] bg-gray-800 text-gray-500 px-2 py-0.5 rounded">{f.status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
