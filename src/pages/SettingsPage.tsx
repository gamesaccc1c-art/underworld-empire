import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Settings, Volume2, VolumeX, Bell, BellOff, Moon, Sun, User, Shield, LogOut, Trash2, Save, CircleAlert as AlertCircle, RotateCcw } from 'lucide-react'
import { useGameStore } from '@/stores/gameStore'
import { useGuestStore } from '@/stores/guestStore'
import { signOut } from '@/lib/supabase/auth'
import * as db from '@/lib/supabase/database'
import { toast } from 'sonner'
import { useTheme } from '@/components/theme-provider'
import { resetTutorial } from '@/components/shared/TutorialOverlay'

interface GameSettings {
  soundEnabled: boolean
  musicEnabled: boolean
  notificationsEnabled: boolean
  vibrationEnabled: boolean
  autoCollect: boolean
  showDamageNumbers: boolean
}

const DEFAULT_SETTINGS: GameSettings = {
  soundEnabled: true,
  musicEnabled: true,
  notificationsEnabled: true,
  vibrationEnabled: true,
  autoCollect: false,
  showDamageNumbers: true,
}

function loadSettings(): GameSettings {
  try {
    const stored = localStorage.getItem('uw-settings')
    if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
  } catch {}
  return DEFAULT_SETTINGS
}

function saveSettings(settings: GameSettings) {
  localStorage.setItem('uw-settings', JSON.stringify(settings))
}

export function SettingsPage() {
  const navigate = useNavigate()
  const { player: authPlayer, setSession, loadPlayer } = useGameStore()
  const { player: guestPlayer, isGuest } = useGuestStore()
  const player = isGuest ? guestPlayer : authPlayer
  const { theme, setTheme } = useTheme()

  const [settings, setSettings] = useState<GameSettings>(loadSettings)
  const [editingUsername, setEditingUsername] = useState(false)
  const [newUsername, setNewUsername] = useState(player?.username || '')
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  function updateSetting<K extends keyof GameSettings>(key: K, value: GameSettings[K]) {
    const updated = { ...settings, [key]: value }
    setSettings(updated)
    saveSettings(updated)
  }

  async function handleSaveUsername() {
    if (!newUsername || newUsername.length < 3) {
      toast.error('Kullanici adi en az 3 karakter olmali')
      return
    }
    if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
      toast.error('Sadece harf, rakam ve _ kullanin')
      return
    }
    setSaving(true)
    try {
      await db.updatePlayerProfile(newUsername)
      await loadPlayer()
      setEditingUsername(false)
      toast.success('Kullanici adi guncellendi!')
    } catch {
      toast.error('Guncelleme basarisiz')
    }
    setSaving(false)
  }

  async function handleLogout() {
    if (!isGuest) {
      await signOut()
      setSession(null)
    } else {
      useGuestStore.getState().exitGuest()
    }
    navigate('/login')
  }

  function handleClearGuestData() {
    useGuestStore.getState().exitGuest()
    localStorage.removeItem('uw-settings')
    localStorage.removeItem('uw-energy-dark-last')
    localStorage.removeItem('uw-energy-raid-last')
    localStorage.removeItem('uw-energy-spy-last')
    toast.success('Tum veriler silindi')
    navigate('/login')
  }

  return (
    <div className="p-3 space-y-4 pb-6">
      <div className="text-center">
        <h1 className="font-display text-xl font-black tracking-wider text-gold">AYARLAR</h1>
        <p className="text-xs text-muted-foreground">Tercihlerinizi yonetin</p>
      </div>

      {/* Profile */}
      <Card className="border-border/40 bg-card/70">
        <CardContent className="p-4 space-y-3">
          <h3 className="text-xs font-semibold flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-gold" /> Profil
          </h3>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Kullanici Adi</p>
              {editingUsername ? (
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    value={newUsername}
                    onChange={e => setNewUsername(e.target.value)}
                    className="h-7 text-xs w-36"
                    maxLength={20}
                  />
                  <Button size="sm" className="h-7 text-[10px]" onClick={handleSaveUsername} disabled={saving}>
                    <Save className="h-3 w-3 mr-0.5" />{saving ? '...' : 'Kaydet'}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setEditingUsername(false)}>Iptal</Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{player?.username}</p>
                  {!isGuest && (
                    <Button size="sm" variant="ghost" className="h-5 text-[9px] px-1.5" onClick={() => { setNewUsername(player?.username || ''); setEditingUsername(true) }}>
                      Duzenle
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          {player?.email && (
            <div>
              <p className="text-xs text-muted-foreground">E-posta</p>
              <p className="text-sm">{player.email}</p>
            </div>
          )}

          {isGuest && (
            <div className="bg-amber-950/20 border border-amber-800/30 rounded-lg p-2.5">
              <p className="text-[10px] text-amber-400">Misafir olarak oynuyorsunuz. Kayit olarak verilerinizi koruyun.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card className="border-border/40 bg-card/70">
        <CardContent className="p-4 space-y-3">
          <h3 className="text-xs font-semibold flex items-center gap-1.5">
            {theme === 'dark' ? <Moon className="h-3.5 w-3.5 text-blue-400" /> : <Sun className="h-3.5 w-3.5 text-yellow-400" />}
            Gorunum
          </h3>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium">Tema</p>
              <p className="text-[10px] text-muted-foreground">Karanlik veya aydin mod</p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant={theme === 'dark' ? 'default' : 'outline'}
                className="h-7 text-[10px] px-2"
                onClick={() => setTheme('dark')}
              >
                <Moon className="h-3 w-3 mr-1" />Karanlik
              </Button>
              <Button
                size="sm"
                variant={theme === 'light' ? 'default' : 'outline'}
                className="h-7 text-[10px] px-2"
                onClick={() => setTheme('light')}
              >
                <Sun className="h-3 w-3 mr-1" />Aydin
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sound & Notifications */}
      <Card className="border-border/40 bg-card/70">
        <CardContent className="p-4 space-y-3">
          <h3 className="text-xs font-semibold flex items-center gap-1.5">
            <Volume2 className="h-3.5 w-3.5 text-green-400" /> Ses ve Bildirimler
          </h3>

          <SettingRow
            icon={settings.soundEnabled ? <Volume2 className="h-4 w-4 text-green-400" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
            label="Ses Efektleri"
            description="Oyun ici ses efektleri"
            checked={settings.soundEnabled}
            onToggle={(v) => updateSetting('soundEnabled', v)}
          />
          <Separator className="opacity-30" />
          <SettingRow
            icon={settings.musicEnabled ? <Volume2 className="h-4 w-4 text-blue-400" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
            label="Muzik"
            description="Arka plan muzigi"
            checked={settings.musicEnabled}
            onToggle={(v) => updateSetting('musicEnabled', v)}
          />
          <Separator className="opacity-30" />
          <SettingRow
            icon={settings.notificationsEnabled ? <Bell className="h-4 w-4 text-orange-400" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
            label="Bildirimler"
            description="Oyun ici bildirimler"
            checked={settings.notificationsEnabled}
            onToggle={(v) => updateSetting('notificationsEnabled', v)}
          />
          <Separator className="opacity-30" />
          <SettingRow
            icon={<Settings className="h-4 w-4 text-muted-foreground" />}
            label="Titresim"
            description="Dokunmatik geri bildirim"
            checked={settings.vibrationEnabled}
            onToggle={(v) => updateSetting('vibrationEnabled', v)}
          />
        </CardContent>
      </Card>

      {/* Gameplay */}
      <Card className="border-border/40 bg-card/70">
        <CardContent className="p-4 space-y-3">
          <h3 className="text-xs font-semibold flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-cyan-400" /> Oyun Ayarlari
          </h3>

          <SettingRow
            icon={<Settings className="h-4 w-4 text-gold" />}
            label="Otomatik Toplama"
            description="Uretimi otomatik topla"
            checked={settings.autoCollect}
            onToggle={(v) => updateSetting('autoCollect', v)}
          />
          <Separator className="opacity-30" />
          <SettingRow
            icon={<Settings className="h-4 w-4 text-red-400" />}
            label="Hasar Sayilari"
            description="Savasta hasar degerlerini goster"
            checked={settings.showDamageNumbers}
            onToggle={(v) => updateSetting('showDamageNumbers', v)}
          />
          <Separator className="opacity-30" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <RotateCcw className="h-4 w-4 text-cyan-400" />
              <div>
                <p className="text-xs font-medium">Egitimi Tekrarla</p>
                <p className="text-[10px] text-muted-foreground">Baslangic rehberini sifirla</p>
              </div>
            </div>
            <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => { resetTutorial(); toast.success('Egitim sifirlandı! Sayfayi yenileyince baslar.') }}>
              Sifirla
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* App Info */}
      <Card className="border-border/40 bg-card/70">
        <CardContent className="p-4 space-y-2">
          <h3 className="text-xs font-semibold">Uygulama Bilgisi</h3>
          <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
            <span>Versiyon</span>
            <span className="text-right font-mono">1.0.0</span>
            <span>Sunucu</span>
            <span className="text-right">
              <Badge variant="outline" className="text-[9px] px-1 py-0 border-neon/30 text-neon">Aktif</Badge>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/20 bg-card/70">
        <CardContent className="p-4 space-y-3">
          <h3 className="text-xs font-semibold text-destructive flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" /> Tehlikeli Bolge
          </h3>

          <Button
            variant="outline"
            className="w-full justify-start h-9 text-xs border-destructive/20 text-destructive hover:bg-destructive/10"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            {isGuest ? 'Misafir Modundan Cik' : 'Cikis Yap'}
          </Button>

          {isGuest && (
            <Button
              variant="outline"
              className="w-full justify-start h-9 text-xs border-destructive/20 text-destructive hover:bg-destructive/10"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Tum Verileri Sil
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="bg-card border-border/50 max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Verileri Sil
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Tum misafir verileriniz silinecek. Bu islem geri alinamaz.</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-8 text-xs" onClick={() => setShowDeleteConfirm(false)}>Iptal</Button>
              <Button variant="destructive" className="flex-1 h-8 text-xs" onClick={handleClearGuestData}>Sil</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SettingRow({ icon, label, description, checked, onToggle }: {
  icon: React.ReactNode
  label: string
  description: string
  checked: boolean
  onToggle: (value: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        {icon}
        <div>
          <p className="text-xs font-medium">{label}</p>
          <p className="text-[10px] text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onToggle} />
    </div>
  )
}
