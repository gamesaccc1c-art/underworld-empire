import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TriangleAlert as AlertTriangle, X, UserPlus, Eye, EyeOff, Loader as Loader2, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { signUp, signIn } from '@/lib/supabase/auth'
import { supabase } from '@/lib/supabase/client'
import { useGameStore } from '@/stores/gameStore'
import { useGuestStore } from '@/stores/guestStore'
import { toast } from 'sonner'

export function GuestBanner() {
  const [dismissed, setDismissed] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)

  if (dismissed) return null

  return (
    <>
      <div className="shrink-0 bg-amber-950/60 border-b border-gold/20 px-3 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle className="h-3.5 w-3.5 text-gold shrink-0" />
          <p className="text-[11px] text-gold/80 truncate">
            Misafir modu — ilerlemeniz kaydedilmiyor
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            className="h-6 text-[10px] px-2 gradient-gold text-primary-foreground"
            onClick={() => setShowUpgrade(true)}
          >
            <UserPlus className="h-3 w-3 mr-1" />
            Hesap Olustur
          </Button>
          <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <GuestUpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </>
  )
}

function GuestUpgradeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const setSession = useGameStore(s => s.setSession)
  const guestPlayer = useGuestStore(s => s.player)
  const exitGuest = useGuestStore(s => s.exitGuest)

  const [mode, setMode] = useState<'register' | 'login'>('register')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState(guestPlayer?.username === 'Misafir Patron' ? '' : guestPlayer?.username || '')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (username.length < 3 || username.length > 20) {
      setError('Kullanici adi 3-20 karakter olmali')
      return
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError('Sadece harf, rakam ve _ kullanin')
      return
    }
    if (password.length < 8) {
      setError('Sifre en az 8 karakter olmali')
      return
    }

    setLoading(true)
    try {
      await signUp(email, password, username)
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        exitGuest()
        setSession(data.session)
        toast.success('Hesap olusturuldu! Ilerlemeniz korunuyor.')
        onClose()
        navigate('/city')
      } else {
        setMode('login')
        setError('')
        toast.success('Hesap olusturuldu! Simdi giris yapin.')
      }
    } catch (err: unknown) {
      const msg = (err as Error).message
      if (msg.includes('already registered')) {
        setError('Bu e-posta zaten kayitli.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await signIn(email, password)
      exitGuest()
      setSession(data.session)
      toast.success('Giris yapildi! Oyuna devam ediyorsunuz.')
      onClose()
      navigate('/city')
    } catch (err: unknown) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="bg-card border-border/50 max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gold font-display text-base">
            <Shield className="h-5 w-5" />
            {mode === 'register' ? 'Hesap Olustur' : 'Giris Yap'}
          </DialogTitle>
        </DialogHeader>

        <div className="bg-amber-950/30 border border-gold/20 rounded-lg p-2.5 mb-1">
          <p className="text-[10px] text-gold/80">
            Hesap olusturarak ilerlemenizi koruyun. Verileriniz sunucuda guvenle saklanir ve her cihazdan erisebilirsiniz.
          </p>
        </div>

        {mode === 'register' ? (
          <form onSubmit={handleRegister} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Kullanici Adi</Label>
              <Input
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="KaranlikPatron"
                maxLength={20}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">E-posta</Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="patron@sehir.com"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Sifre</Label>
              <div className="relative">
                <Input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="En az 8 karakter"
                  minLength={8}
                  required
                />
                <button type="button" tabIndex={-1} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPass(!showPass)}>
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <Button type="submit" className="w-full gradient-gold text-primary-foreground font-bold" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Kayit Ol'}
            </Button>

            <button type="button" className="w-full text-[10px] text-muted-foreground hover:text-foreground text-center" onClick={() => { setMode('login'); setError('') }}>
              Zaten hesabiniz var mi? Giris yapin
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">E-posta</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="patron@sehir.com" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Sifre</Label>
              <div className="relative">
                <Input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Sifreniz" required />
                <button type="button" tabIndex={-1} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPass(!showPass)}>
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <Button type="submit" className="w-full gradient-gold text-primary-foreground font-bold" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Giris Yap'}
            </Button>

            <button type="button" className="w-full text-[10px] text-muted-foreground hover:text-foreground text-center" onClick={() => { setMode('register'); setError('') }}>
              Hesabiniz yok mu? Kayit olun
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
