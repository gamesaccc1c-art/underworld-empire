import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signIn, signUp, resetPassword } from '@/lib/supabase/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Shield, Crosshair, Crown, Skull, Play, Zap, ChevronRight, Eye, EyeOff, CircleCheck as CheckCircle2, CircleAlert as AlertCircle } from 'lucide-react'
import { useGameStore } from '@/stores/gameStore'
import { useGuestStore } from '@/stores/guestStore'
import { Separator } from '@/components/ui/separator'

export function LoginPage() {
  const navigate = useNavigate()
  const setSession = useGameStore(s => s.setSession)
  const initGuest = useGuestStore(s => s.initGuest)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showAuth, setShowAuth] = useState(false)
  const [activeTab, setActiveTab] = useState('login')

  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('')
  const [regUsername, setRegUsername] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showRegPassword, setShowRegPassword] = useState(false)

  function handleGuest() {
    initGuest()
    navigate('/city')
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const data = await signIn(loginEmail, loginPassword)
      setSession(data.session)
      navigate('/city')
    } catch (err: unknown) {
      const msg = (err as Error).message
      if (msg.includes('Invalid login')) {
        setError('E-posta veya sifre hatali.')
      } else if (msg.includes('Email not confirmed')) {
        setError('E-posta henuz dogrulanmadi.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotPassword() {
    if (!loginEmail) {
      setError('Sifre sifirlamak icin e-posta adresinizi girin.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await resetPassword(loginEmail)
      setSuccess('Sifre sifirlama baglantisi gonderildi! E-postanizi kontrol edin.')
    } catch (err: unknown) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (regUsername.length < 3) {
      setError('Kullanici adi en az 3 karakter olmali.')
      return
    }
    if (regUsername.length > 20) {
      setError('Kullanici adi en fazla 20 karakter olmali.')
      return
    }
    if (!/^[a-zA-Z0-9_]+$/.test(regUsername)) {
      setError('Kullanici adi sadece harf, rakam ve _ icermeli.')
      return
    }
    if (regPassword.length < 8) {
      setError('Sifre en az 8 karakter olmali.')
      return
    }
    if (regPassword !== regPasswordConfirm) {
      setError('Sifreler eslesmiyor.')
      return
    }

    setLoading(true)
    try {
      const signUpData = await signUp(regEmail, regPassword, regUsername)
      if (signUpData.session) {
        setSession(signUpData.session)
        navigate('/city')
      } else {
        setLoginEmail(regEmail)
        setRegEmail('')
        setRegPassword('')
        setRegPasswordConfirm('')
        setRegUsername('')
        setSuccess('Hesap basariyla olusturuldu! Simdi giris yapabilirsiniz.')
        setActiveTab('login')
      }
    } catch (err: unknown) {
      const msg = (err as Error).message
      if (msg.includes('already registered')) {
        setError('Bu e-posta adresi zaten kayitli. Giris yapin.')
      } else if (msg.includes('weak_password')) {
        setError('Daha guclu bir sifre secin.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  const passwordStrength = getPasswordStrength(regPassword)

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Atmospheric background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[oklch(0.10_0.02_260)] via-background to-[oklch(0.08_0.01_260)]" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gold/3 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-crimson/5 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-72 h-72 bg-slate-900/10 rounded-full blur-[80px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md space-y-5">
        {/* Logo section */}
        <div className="text-center space-y-4 py-2">
          <div className="relative inline-block">
            <div className="absolute inset-0 blur-2xl bg-gold/20 rounded-full" />
            <Skull className="relative h-14 w-14 text-gold mx-auto drop-shadow-[0_0_15px_oklch(0.78_0.15_75)]" />
          </div>
          <div className="space-y-1">
            <h1 className="font-display text-3xl sm:text-4xl font-black tracking-wider text-gold drop-shadow-[0_0_30px_oklch(0.78_0.15_75/25%)]">
              UNDERWORLD
            </h1>
            <h2 className="font-display text-xl sm:text-2xl font-bold tracking-[0.3em] text-foreground/80">
              EMPIRE
            </h2>
            <p className="text-xs tracking-[0.5em] text-muted-foreground uppercase">
              Karanlik Sehir
            </p>
          </div>
          <div className="flex items-center justify-center gap-5 pt-1">
            {[
              { icon: Shield, label: 'Strateji', color: 'text-blue-400' },
              { icon: Crosshair, label: 'Savas', color: 'text-red-400' },
              { icon: Crown, label: 'Hakimiyet', color: 'text-gold' },
            ].map(({ icon: Icon, label, color }) => (
              <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon className={`h-3.5 w-3.5 ${color}`} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {!showAuth ? (
          /* Main action screen */
          <div className="space-y-3">
            {/* Guest play - PRIMARY CTA */}
            <button
              onClick={handleGuest}
              className="w-full relative group overflow-hidden rounded-xl border border-gold/40 bg-gradient-to-br from-amber-950/60 to-amber-900/20 p-0.5 transition-all hover:border-gold/70 hover:glow-gold"
            >
              <div className="rounded-[10px] bg-gradient-to-br from-amber-900/30 to-transparent px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-gold/20 flex items-center justify-center">
                    <Play className="h-5 w-5 text-gold fill-gold" />
                  </div>
                  <div className="text-left">
                    <p className="font-display text-base font-bold text-gold">HEMEN OYNA</p>
                    <p className="text-xs text-muted-foreground">Kayit gerekmez, aninda basla</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gold/60 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            {/* Auth option */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full opacity-30" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-background px-3 text-muted-foreground">veya</span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full border-border/50 text-muted-foreground hover:text-foreground"
              onClick={() => setShowAuth(true)}
            >
              <Crown className="h-4 w-4 mr-2 text-gold/60" />
              Hesap ile Giris Yap / Kayit Ol
            </Button>

            {/* Feature highlights */}
            <div className="grid grid-cols-3 gap-2 pt-2">
              {[
                { icon: Zap, label: '12 Bina', sub: 'Insaat sistemi' },
                { icon: Crosshair, label: '10+ Gorev', sub: 'Karanlik isler' },
                { icon: Shield, label: '8 Enforcer', sub: 'Ozel karakterler' },
              ].map(({ icon: Icon, label, sub }) => (
                <div key={label} className="bg-card/40 border border-border/30 rounded-lg p-2.5 text-center">
                  <Icon className="h-4 w-4 text-gold/60 mx-auto mb-1" />
                  <p className="text-xs font-semibold">{label}</p>
                  <p className="text-[9px] text-muted-foreground">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Auth forms */
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardContent className="pt-4 pb-4 px-4">
              <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setError(''); setSuccess('') }} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="login">Giris Yap</TabsTrigger>
                  <TabsTrigger value="register">Kayit Ol</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="login-email" className="text-xs">E-posta</Label>
                      <Input
                        id="login-email"
                        type="email"
                        value={loginEmail}
                        onChange={e => setLoginEmail(e.target.value)}
                        placeholder="patron@sehir.com"
                        autoComplete="email"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="login-password" className="text-xs">Sifre</Label>
                      <div className="relative">
                        <Input
                          id="login-password"
                          type={showPassword ? 'text' : 'password'}
                          value={loginPassword}
                          onChange={e => setLoginPassword(e.target.value)}
                          placeholder="Sifrenizi girin"
                          autoComplete="current-password"
                          required
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    {error && activeTab === 'login' && (
                      <div className="flex items-start gap-2 p-2 bg-destructive/10 border border-destructive/20 rounded-lg">
                        <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                        <p className="text-xs text-destructive">{error}</p>
                      </div>
                    )}
                    {success && activeTab === 'login' && (
                      <div className="flex items-start gap-2 p-2 bg-green-950/30 border border-green-800/30 rounded-lg">
                        <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-green-400">{success}</p>
                      </div>
                    )}
                    <Button type="submit" className="w-full gradient-gold text-primary-foreground font-bold" disabled={loading}>
                      {loading ? 'Giris yapiliyor...' : 'Giris Yap'}
                    </Button>
                    <button
                      type="button"
                      className="w-full text-center text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                      onClick={handleForgotPassword}
                      disabled={loading}
                    >
                      Sifremi unuttum
                    </button>
                  </form>
                </TabsContent>

                <TabsContent value="register">
                  <form onSubmit={handleRegister} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="reg-username" className="text-xs">Kullanici Adi</Label>
                      <Input
                        id="reg-username"
                        value={regUsername}
                        onChange={e => setRegUsername(e.target.value)}
                        placeholder="KaranlikPatron"
                        autoComplete="username"
                        maxLength={20}
                        required
                      />
                      {regUsername.length > 0 && regUsername.length < 3 && (
                        <p className="text-[10px] text-muted-foreground">En az 3 karakter</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="reg-email" className="text-xs">E-posta</Label>
                      <Input
                        id="reg-email"
                        type="email"
                        value={regEmail}
                        onChange={e => setRegEmail(e.target.value)}
                        placeholder="patron@sehir.com"
                        autoComplete="email"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="reg-password" className="text-xs">Sifre</Label>
                      <div className="relative">
                        <Input
                          id="reg-password"
                          type={showRegPassword ? 'text' : 'password'}
                          value={regPassword}
                          onChange={e => setRegPassword(e.target.value)}
                          placeholder="En az 8 karakter"
                          autoComplete="new-password"
                          minLength={8}
                          required
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowRegPassword(!showRegPassword)}
                        >
                          {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {regPassword.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 flex gap-0.5">
                            {[1, 2, 3, 4].map(level => (
                              <div
                                key={level}
                                className={`h-1 flex-1 rounded-full transition-colors ${
                                  passwordStrength >= level
                                    ? passwordStrength <= 1 ? 'bg-red-500'
                                    : passwordStrength === 2 ? 'bg-orange-400'
                                    : passwordStrength === 3 ? 'bg-yellow-400'
                                    : 'bg-green-400'
                                    : 'bg-secondary/50'
                                }`}
                              />
                            ))}
                          </div>
                          <span className={`text-[9px] ${
                            passwordStrength <= 1 ? 'text-red-400'
                            : passwordStrength === 2 ? 'text-orange-400'
                            : passwordStrength === 3 ? 'text-yellow-400'
                            : 'text-green-400'
                          }`}>
                            {passwordStrength <= 1 ? 'Zayif' : passwordStrength === 2 ? 'Orta' : passwordStrength === 3 ? 'Iyi' : 'Guclu'}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="reg-password-confirm" className="text-xs">Sifre Tekrar</Label>
                      <Input
                        id="reg-password-confirm"
                        type="password"
                        value={regPasswordConfirm}
                        onChange={e => setRegPasswordConfirm(e.target.value)}
                        placeholder="Sifreyi tekrarlayin"
                        autoComplete="new-password"
                        required
                      />
                      {regPasswordConfirm.length > 0 && regPassword !== regPasswordConfirm && (
                        <p className="text-[10px] text-destructive">Sifreler eslesmiyor</p>
                      )}
                    </div>
                    {error && activeTab === 'register' && (
                      <div className="flex items-start gap-2 p-2 bg-destructive/10 border border-destructive/20 rounded-lg">
                        <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                        <p className="text-xs text-destructive">{error}</p>
                      </div>
                    )}
                    <Button type="submit" className="w-full gradient-gold text-primary-foreground font-bold" disabled={loading}>
                      {loading ? 'Hesap olusturuluyor...' : 'Kayit Ol'}
                    </Button>
                    <p className="text-[10px] text-muted-foreground text-center">
                      Kayit olarak kullanim sartlarini kabul etmis olursunuz.
                    </p>
                  </form>
                </TabsContent>
              </Tabs>

              <Button variant="ghost" size="sm" className="w-full mt-2 text-xs text-muted-foreground" onClick={() => { setShowAuth(false); setError(''); setSuccess('') }}>
                Geri Don
              </Button>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-[10px] text-muted-foreground">
          Kurgu strateji oyunu. Icerik tamamen hayalidir.
        </p>
      </div>
    </div>
  )
}

function getPasswordStrength(password: string): number {
  if (!password) return 0
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  return score
}
