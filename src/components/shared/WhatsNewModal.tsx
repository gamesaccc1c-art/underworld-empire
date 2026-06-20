import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sparkles, Gift, Swords, Users, Trophy, Mail, UserPlus } from 'lucide-react'

interface ChangelogEntry {
  version: string
  date: string
  items: { icon: React.ElementType; text: string; type: 'new' | 'fix' | 'improve' }[]
}

const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.3.0',
    date: '20 Haziran 2025',
    items: [
      { icon: Mail, text: 'Oyuncu mesajlasma sistemi eklendi', type: 'new' },
      { icon: UserPlus, text: 'Davet kodu sistemi ve oduller', type: 'new' },
      { icon: Trophy, text: 'Istatistikler sayfasi ve savas gecmisi', type: 'new' },
      { icon: Sparkles, text: 'Yeni oyuncu egitim rehberi', type: 'new' },
      { icon: Swords, text: 'Basarim ilerlemesi otomatik takip', type: 'improve' },
      { icon: Users, text: 'Misafir hesap donusum modali', type: 'improve' },
    ],
  },
  {
    version: '1.2.0',
    date: '19 Haziran 2025',
    items: [
      { icon: Trophy, text: 'Basarim sistemi eklendi', type: 'new' },
      { icon: Swords, text: 'Battle Pass ve haftalik gorevler', type: 'new' },
      { icon: Users, text: 'Aile/klan sistemi gelistirildi', type: 'improve' },
      { icon: Gift, text: 'Gunluk odul sistemi ve seri bonuslari', type: 'new' },
    ],
  },
  {
    version: '1.1.0',
    date: '18 Haziran 2025',
    items: [
      { icon: Swords, text: 'PvP savas sistemi', type: 'new' },
      { icon: Users, text: 'Aile/klan olusturma', type: 'new' },
      { icon: Gift, text: 'Magaza ve VIP sistemi', type: 'new' },
    ],
  },
]

const STORAGE_KEY = 'uw-changelog-seen'
const CURRENT_VERSION = CHANGELOG[0]?.version || '1.0.0'

export function WhatsNewModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY)
    if (seen !== CURRENT_VERSION) {
      const timer = setTimeout(() => setOpen(true), 2000)
      return () => clearTimeout(timer)
    }
  }, [])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, CURRENT_VERSION)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) dismiss() }}>
      <DialogContent className="bg-card border-border/50 max-w-sm max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gold font-display text-base">
            <Sparkles className="h-5 w-5" /> Yenilikler
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {CHANGELOG.map(entry => (
            <div key={entry.version} className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge className="bg-gold/20 text-gold border-gold/30 text-[10px]">v{entry.version}</Badge>
                <span className="text-[10px] text-muted-foreground">{entry.date}</span>
              </div>
              <div className="space-y-1.5 pl-1">
                {entry.items.map((item, i) => {
                  const Icon = item.icon
                  return (
                    <div key={i} className="flex items-start gap-2">
                      <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${
                        item.type === 'new' ? 'text-green-400' : item.type === 'fix' ? 'text-blue-400' : 'text-gold'
                      }`} />
                      <p className="text-[11px] text-foreground/80 leading-relaxed">{item.text}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <Button className="w-full gradient-gold text-primary-foreground text-xs mt-2" onClick={dismiss}>
          Anladim!
        </Button>
      </DialogContent>
    </Dialog>
  )
}

export function openWhatsNew() {
  localStorage.removeItem(STORAGE_KEY)
}
