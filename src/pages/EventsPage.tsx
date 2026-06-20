import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { Clock, Trophy, Gift, Flame } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useGuestStore } from '@/stores/guestStore'

interface GameEvent {
  id: string
  event_type: string
  name: string
  description: string
  icon: string
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
  metadata: Record<string, unknown>
  my_points: number
  my_rank: number | null
}

function timeLeft(endsAt: string | null): string {
  if (!endsAt) return '—'
  const diff = new Date(endsAt).getTime() - Date.now()
  if (diff <= 0) return 'Bitti'
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  if (days > 0) return `${days}g ${hours}s`
  return `${hours}s`
}

function EventCard({ event }: { event: GameEvent }) {
  const tl = timeLeft(event.ends_at)
  const statusColor = event.is_active ? 'bg-green-600' : 'bg-gray-600'
  const statusLabel = event.is_active ? 'AKTİF' : 'YAKINDA'

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Card className={`cursor-pointer transition-all hover:border-foreground/10 ${event.is_active ? 'border-red-900/40 bg-gradient-to-br from-red-950/20 to-card' : 'border-border/30 bg-card/50'}`}>
          <CardContent className="p-3.5 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{event.icon || '🎯'}</span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold">{event.name}</p>
                    <span className={`text-[8px] font-bold text-white px-1.5 py-0.5 rounded ${statusColor}`}>{statusLabel}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock className="h-2.5 w-2.5" />{tl}
                  </p>
                </div>
              </div>
              {event.my_points > 0 && (
                <div className="text-right">
                  <p className="text-xs font-bold text-gold">{event.my_points.toLocaleString()}</p>
                  <p className="text-[9px] text-muted-foreground">puan</p>
                </div>
              )}
            </div>
            {event.my_points > 0 && (
              <Progress value={Math.min(event.my_points / 10, 100)} className="h-1" />
            )}
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="bg-card border-border/50 max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">{event.icon || '🎯'}</span>
            {event.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{event.description}</p>
          <div className="bg-secondary/50 rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold flex items-center gap-1"><Clock className="h-3 w-3" /> Süre</p>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Başlangıç</span>
              <span>{event.starts_at ? new Date(event.starts_at).toLocaleDateString('tr-TR') : '—'}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Bitiş</span>
              <span>{event.ends_at ? new Date(event.ends_at).toLocaleDateString('tr-TR') : '—'}</span>
            </div>
          </div>
          {event.my_points > 0 && (
            <div className="bg-secondary/50 rounded-lg p-3 space-y-1">
              <p className="text-xs font-semibold flex items-center gap-1"><Trophy className="h-3 w-3 text-gold" /> Senin Durumun</p>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Puanlar</span>
                <span className="text-gold font-bold">{event.my_points.toLocaleString()}</span>
              </div>
              {event.my_rank && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Sıralama</span>
                  <span className="text-blue-400 font-bold">#{event.my_rank}</span>
                </div>
              )}
            </div>
          )}
          {Object.keys(event.metadata || {}).length > 0 && (
            <div className="bg-secondary/50 rounded-lg p-3 space-y-1">
              <p className="text-xs font-semibold flex items-center gap-1"><Gift className="h-3 w-3 text-gold" /> Detaylar</p>
              {Object.entries(event.metadata).map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium">{String(v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function EventsPage() {
  const isGuest = useGuestStore(s => s.isGuest)
  const [events, setEvents] = useState<GameEvent[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (isGuest) {
      // Guests see static placeholder events
      setEvents([
        { id: '1', event_type: 'power_race', name: 'Güç Yarışı', description: 'Güç puan topla!', icon: '⚡', is_active: true, starts_at: null, ends_at: new Date(Date.now() + 7 * 86400000).toISOString(), metadata: {}, my_points: 0, my_rank: null },
        { id: '2', event_type: 'black_market_week', name: 'Kara Pazar Haftası', description: 'Özel indirimler!', icon: '🏪', is_active: true, starts_at: null, ends_at: new Date(Date.now() + 5 * 86400000).toISOString(), metadata: {}, my_points: 0, my_rank: null },
      ])
      setLoading(false)
      return
    }
    const { data } = await supabase.rpc('get_active_events')
    if (data?.ok && data.events) setEvents(data.events as GameEvent[])
    setLoading(false)
  }, [isGuest])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="flex items-center justify-center h-full"><Spinner className="h-6 w-6 text-red-400" /></div>

  const active = events.filter(e => e.is_active)
  const upcoming = events.filter(e => !e.is_active)

  return (
    <div className="p-3 space-y-4 pb-6">
      <div className="text-center">
        <h1 className="font-display text-xl font-black tracking-wider text-red-400">ETKİNLİKLER</h1>
        <p className="text-xs text-muted-foreground">{active.length} aktif etkinlik</p>
      </div>

      {active.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-bold flex items-center gap-1">
            <Flame className="h-3.5 w-3.5 text-red-400" /> Aktif Etkinlikler
          </h2>
          {active.map(e => <EventCard key={e.id} event={e} />)}
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-muted-foreground">Yaklaşan Etkinlikler</h2>
          {upcoming.map(e => <EventCard key={e.id} event={e} />)}
        </div>
      )}

      {events.length === 0 && (
        <div className="py-12 text-center space-y-2">
          <p className="text-4xl">🎯</p>
          <p className="text-sm text-muted-foreground">Şu an aktif etkinlik yok.</p>
        </div>
      )}
    </div>
  )
}
