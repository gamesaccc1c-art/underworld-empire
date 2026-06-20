import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Separator } from '@/components/ui/separator'
import { UserPlus, Copy, Gift, Users, Gem, Banknote, CircleCheck as CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useGameStore } from '@/stores/gameStore'
import { useGuestStore } from '@/stores/guestStore'
import { toast } from 'sonner'

interface ReferralInfo {
  code: string | null
  uses: number
  max_uses: number
  total_referred: number
  has_used_code: boolean
}

export function ReferralPage() {
  const isGuest = useGuestStore(s => s.isGuest)
  const loadPlayer = useGameStore(s => s.loadPlayer)
  const [info, setInfo] = useState<ReferralInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [inputCode, setInputCode] = useState('')
  const [claiming, setClaiming] = useState(false)
  const [generating, setGenerating] = useState(false)

  const load = useCallback(async () => {
    if (isGuest) { setLoading(false); return }
    const { data } = await supabase.rpc('get_referral_info')
    if (data?.ok) setInfo(data as ReferralInfo)
    setLoading(false)
  }, [isGuest])

  useEffect(() => { load() }, [load])

  async function generateCode() {
    setGenerating(true)
    const { data } = await supabase.rpc('generate_referral_code')
    if (data?.ok) {
      setInfo(prev => prev ? { ...prev, code: data.code, uses: data.uses, max_uses: data.max_uses } : null)
      toast.success('Davet kodunuz olusturuldu!')
    }
    setGenerating(false)
  }

  async function useCode() {
    if (!inputCode.trim()) { toast.error('Bir kod girin'); return }
    setClaiming(true)
    const { data } = await supabase.rpc('use_referral_code', { p_code: inputCode.trim() })
    if (data?.ok) {
      toast.success(`Kod kullanildi! +${data.reward_diamonds} Elmas, +${data.reward_cash.toLocaleString()} Nakit`)
      setInfo(prev => prev ? { ...prev, has_used_code: true } : null)
      setInputCode('')
      await loadPlayer()
    } else {
      toast.error(data?.error || 'Kod kullanilamadi')
    }
    setClaiming(false)
  }

  function copyCode() {
    if (!info?.code) return
    navigator.clipboard.writeText(info.code).then(() => {
      toast.success('Kod kopyalandi!')
    }).catch(() => {
      toast.error('Kopyalama basarisiz')
    })
  }

  if (isGuest) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[300px] text-center space-y-3">
        <UserPlus className="h-12 w-12 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Davet sistemi icin hesap olusturun.</p>
      </div>
    )
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-[300px]"><Spinner className="h-6 w-6 text-gold" /></div>
  }

  return (
    <div className="p-3 space-y-4 pb-6">
      <div className="text-center">
        <h1 className="font-display text-xl font-black tracking-wider text-gold">DAVET ET</h1>
        <p className="text-xs text-muted-foreground">Arkadaslarini davet et, oduller kazan</p>
      </div>

      {/* Rewards info */}
      <Card className="border-gold/20 bg-gradient-to-br from-amber-950/20 to-card">
        <CardContent className="p-4 space-y-3">
          <h3 className="text-xs font-bold flex items-center gap-1.5">
            <Gift className="h-3.5 w-3.5 text-gold" /> Davet Odulleri
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-secondary/30 rounded-lg p-3 text-center space-y-1">
              <p className="text-[10px] text-muted-foreground">Davet Eden</p>
              <div className="flex items-center justify-center gap-1.5">
                <Gem className="h-3.5 w-3.5 text-cyan-400" />
                <span className="text-sm font-bold">30</span>
              </div>
              <div className="flex items-center justify-center gap-1">
                <Banknote className="h-3 w-3 text-green-400" />
                <span className="text-xs">15K</span>
              </div>
            </div>
            <div className="bg-secondary/30 rounded-lg p-3 text-center space-y-1">
              <p className="text-[10px] text-muted-foreground">Davet Edilen</p>
              <div className="flex items-center justify-center gap-1.5">
                <Gem className="h-3.5 w-3.5 text-cyan-400" />
                <span className="text-sm font-bold">50</span>
              </div>
              <div className="flex items-center justify-center gap-1">
                <Banknote className="h-3 w-3 text-green-400" />
                <span className="text-xs">25K</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Your code */}
      <Card className="border-border/40 bg-card/70">
        <CardContent className="p-4 space-y-3">
          <h3 className="text-xs font-bold flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-blue-400" /> Sizin Davet Kodunuz
          </h3>

          {info?.code ? (
            <>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-secondary/50 border border-border/40 rounded-lg px-3 py-2.5 font-mono text-center text-lg tracking-widest font-bold text-gold">
                  {info.code}
                </div>
                <Button size="sm" variant="outline" className="h-10 w-10 shrink-0" onClick={copyCode}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Kullanan: {info.uses} / {info.max_uses}</span>
                <Badge variant="outline" className="text-[9px]">
                  <Users className="h-2.5 w-2.5 mr-0.5" />{info.total_referred} davet
                </Badge>
              </div>
            </>
          ) : (
            <Button className="w-full gradient-gold text-primary-foreground" onClick={generateCode} disabled={generating}>
              {generating ? <Spinner className="h-4 w-4" /> : <><UserPlus className="h-4 w-4 mr-1.5" />Davet Kodu Olustur</>}
            </Button>
          )}
        </CardContent>
      </Card>

      <Separator className="opacity-30" />

      {/* Use a code */}
      <Card className="border-border/40 bg-card/70">
        <CardContent className="p-4 space-y-3">
          <h3 className="text-xs font-bold flex items-center gap-1.5">
            <Gift className="h-3.5 w-3.5 text-green-400" /> Davet Kodu Kullan
          </h3>

          {info?.has_used_code ? (
            <div className="flex items-center gap-2 text-green-400 text-xs">
              <CheckCircle2 className="h-4 w-4" />
              <span>Zaten bir davet kodu kullandiniz.</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                value={inputCode}
                onChange={e => setInputCode(e.target.value.toUpperCase())}
                placeholder="XXXXXXXX"
                className="font-mono tracking-widest text-center uppercase"
                maxLength={8}
              />
              <Button size="sm" className="shrink-0" onClick={useCode} disabled={claiming || !inputCode.trim()}>
                {claiming ? <Spinner className="h-4 w-4" /> : 'Kullan'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
