import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Mail, Send, Inbox, Trash2, ChevronLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useGuestStore } from '@/stores/guestStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { toast } from 'sonner'

interface MailItem {
  id: string
  subject: string
  body: string
  mail_type: string
  is_read: boolean
  metadata: Record<string, unknown>
  created_at: string
  sender_name: string | null
  sender_level: number | null
}

export function MailPage() {
  const isGuest = useGuestStore(s => s.isGuest)
  const resetMailCount = useNotificationStore(s => s.resetMailCount)
  const [mails, setMails] = useState<MailItem[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<MailItem | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)

  const load = useCallback(async () => {
    if (isGuest) { setLoading(false); return }
    const { data } = await supabase.rpc('get_inbox', { p_limit: 30, p_offset: 0 })
    if (data?.ok) {
      setMails(data.mails as MailItem[])
      setUnread(data.unread)
      resetMailCount()
    }
    setLoading(false)
  }, [isGuest])

  useEffect(() => { load() }, [load])

  async function markRead(mail: MailItem) {
    if (!mail.is_read) {
      await supabase.rpc('mark_mail_read', { p_mail_id: mail.id })
      setMails(prev => prev.map(m => m.id === mail.id ? { ...m, is_read: true } : m))
      setUnread(prev => Math.max(0, prev - 1))
    }
    setSelected(mail)
  }

  async function deleteMail(id: string) {
    await supabase.rpc('delete_mail', { p_mail_id: id })
    setMails(prev => prev.filter(m => m.id !== id))
    if (selected?.id === id) setSelected(null)
    toast.success('Mesaj silindi')
  }

  if (isGuest) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[300px] text-center space-y-3">
        <Mail className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Mesajlasma icin hesap olusturun.</p>
      </div>
    )
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-[300px]"><Spinner className="h-6 w-6 text-gold" /></div>
  }

  if (selected) {
    return (
      <div className="p-3 space-y-3 pb-6">
        <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setSelected(null)}>
          <ChevronLeft className="h-3.5 w-3.5" /> Geri
        </Button>

        <Card className="border-border/40">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-sm font-bold">{selected.subject || '(Konusuz)'}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[9px]">
                    {selected.mail_type === 'system' ? 'Sistem' : selected.sender_name || 'Bilinmeyen'}
                  </Badge>
                  <span className="text-[9px] text-muted-foreground">
                    {new Date(selected.created_at).toLocaleString('tr-TR')}
                  </span>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/70" onClick={() => deleteMail(selected.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="bg-secondary/30 rounded-lg p-3">
              <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{selected.body}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-3 space-y-4 pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-black tracking-wider text-gold">MESAJLAR</h1>
          <p className="text-xs text-muted-foreground">{unread > 0 ? `${unread} okunmamis mesaj` : 'Tum mesajlar okundu'}</p>
        </div>
        <Button size="sm" className="gradient-gold text-primary-foreground text-xs" onClick={() => setComposeOpen(true)}>
          <Send className="h-3.5 w-3.5 mr-1" /> Yaz
        </Button>
      </div>

      {mails.length === 0 ? (
        <div className="py-12 text-center space-y-2">
          <Inbox className="h-10 w-10 text-muted-foreground/20 mx-auto" />
          <p className="text-sm text-muted-foreground">Gelen kutunuz bos</p>
          <p className="text-[10px] text-muted-foreground">Diger oyunculara mesaj gonderin veya sistem bildirimlerini bekleyin.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {mails.map(mail => (
            <Card
              key={mail.id}
              className={`cursor-pointer transition-all hover:border-foreground/10 ${!mail.is_read ? 'border-gold/30 bg-gold/5' : 'border-border/30 bg-card/50'}`}
              onClick={() => markRead(mail)}
            >
              <CardContent className="p-3">
                <div className="flex items-start gap-2.5">
                  <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${mail.is_read ? 'bg-muted' : 'bg-gold'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs truncate ${!mail.is_read ? 'font-bold' : 'font-medium'}`}>
                        {mail.subject || '(Konusuz)'}
                      </p>
                      <span className="text-[9px] text-muted-foreground shrink-0">
                        {formatTime(mail.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <MailTypeBadge type={mail.mail_type} />
                      <span className="text-[10px] text-muted-foreground truncate">
                        {mail.mail_type === 'system' ? 'Sistem' : mail.sender_name || 'Bilinmeyen'}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">{mail.body}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ComposeModal open={composeOpen} onClose={() => setComposeOpen(false)} onSent={load} />
    </div>
  )
}

function MailTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    system: 'bg-blue-900/40 text-blue-400 border-blue-700/40',
    player: 'bg-green-900/40 text-green-400 border-green-700/40',
    family: 'bg-yellow-900/40 text-yellow-400 border-yellow-700/40',
    battle_report: 'bg-red-900/40 text-red-400 border-red-700/40',
    reward: 'bg-amber-900/40 text-amber-400 border-amber-700/40',
  }
  const labels: Record<string, string> = {
    system: 'Sistem',
    player: 'Oyuncu',
    family: 'Aile',
    battle_report: 'Savas',
    reward: 'Odul',
  }
  return (
    <Badge className={`text-[8px] px-1 py-0 h-3.5 ${styles[type] || styles.player}`}>
      {labels[type] || type}
    </Badge>
  )
}

function ComposeModal({ open, onClose, onSent }: { open: boolean; onClose: () => void; onSent: () => void }) {
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!to.trim() || !body.trim()) { toast.error('Alici ve mesaj gerekli'); return }
    setSending(true)
    const { data } = await supabase.rpc('send_mail', {
      p_receiver_username: to.trim(),
      p_subject: subject.trim(),
      p_body: body.trim(),
    })
    if (data?.ok) {
      toast.success('Mesaj gonderildi!')
      setTo('')
      setSubject('')
      setBody('')
      onClose()
      onSent()
    } else {
      toast.error(data?.error || 'Gonderilemedi')
    }
    setSending(false)
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="bg-card border-border/50 max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Send className="h-4 w-4 text-gold" /> Mesaj Gonder
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSend} className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Alici (kullanici adi)</Label>
            <Input value={to} onChange={e => setTo(e.target.value)} placeholder="KaranlikPatron" maxLength={20} required />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Konu</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Opsiyonel" maxLength={100} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Mesaj</Label>
            <Textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Mesajinizi yazin..." maxLength={1000} rows={4} required />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-muted-foreground">{body.length}/1000</span>
            <Button type="submit" size="sm" className="gradient-gold text-primary-foreground" disabled={sending}>
              {sending ? <Spinner className="h-3.5 w-3.5" /> : <><Send className="h-3.5 w-3.5 mr-1" />Gonder</>}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 3600000) return `${Math.floor(diff / 60000)}dk`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}sa`
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}
