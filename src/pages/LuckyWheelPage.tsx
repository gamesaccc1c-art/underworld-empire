import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { RotateCw, Gem, Banknote, Zap, Shield, Star, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useGuestStore } from '@/stores/guestStore'
import { useGameStore } from '@/stores/gameStore'
import { toast } from 'sonner'

const WHEEL_SEGMENTS = [
  { label: '5K Nakit', color: '#166534', type: 'cash' },
  { label: '100 XP', color: '#1e40af', type: 'xp' },
  { label: '5 Elmas', color: '#0e7490', type: 'diamonds' },
  { label: '10K Nakit', color: '#15803d', type: 'cash' },
  { label: '1 Enerji', color: '#9333ea', type: 'energy' },
  { label: '10 Etki', color: '#b45309', type: 'influence' },
  { label: '15 Elmas', color: '#0891b2', type: 'diamonds' },
  { label: '200 XP', color: '#1d4ed8', type: 'xp' },
  { label: '20K Nakit', color: '#047857', type: 'cash' },
  { label: '2 Enerji', color: '#7c3aed', type: 'energy' },
  { label: '50 Etki', color: '#d97706', type: 'influence' },
  { label: '50 Elmas', color: '#06b6d4', type: 'diamonds' },
]

const PRIZE_ICONS: Record<string, React.ElementType> = {
  cash: Banknote,
  xp: Star,
  diamonds: Gem,
  energy: Zap,
  influence: Shield,
}

const PRIZE_COLORS: Record<string, string> = {
  cash: 'text-green-400',
  xp: 'text-blue-400',
  diamonds: 'text-cyan-400',
  energy: 'text-purple-400',
  influence: 'text-amber-400',
}

export function LuckyWheelPage() {
  const isGuest = useGuestStore(s => s.isGuest)
  const loadPlayer = useGameStore(s => s.loadPlayer)
  const [canSpin, setCanSpin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [spinning, setSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [prize, setPrize] = useState<{ type: string; amount: number } | null>(null)
  const wheelRef = useRef<HTMLDivElement>(null)

  const checkStatus = useCallback(async () => {
    if (isGuest) { setCanSpin(true); setLoading(false); return }
    const { data } = await supabase.rpc('get_wheel_status')
    if (data?.ok) setCanSpin(data.can_spin)
    setLoading(false)
  }, [isGuest])

  useEffect(() => { checkStatus() }, [checkStatus])

  async function handleSpin() {
    if (spinning) return

    if (isGuest) {
      const types = ['cash', 'xp', 'diamonds', 'energy', 'influence']
      const type = types[Math.floor(Math.random() * types.length)]
      const amounts: Record<string, number[]> = {
        cash: [5000, 10000, 15000],
        xp: [100, 200, 300],
        diamonds: [5, 10, 15],
        energy: [1, 2, 3],
        influence: [10, 20, 50],
      }
      const amount = amounts[type][Math.floor(Math.random() * 3)]
      animateSpin(type, amount)
      setCanSpin(false)
      const g = useGuestStore.getState()
      if (type === 'cash') g.addResources({ cash: amount })
      else if (type === 'diamonds') g.addResources({ diamonds: amount })
      return
    }

    setSpinning(true)
    const { data } = await supabase.rpc('spin_lucky_wheel')
    if (data?.ok) {
      animateSpin(data.prize_type, data.prize_amount)
      setCanSpin(false)
    } else {
      toast.error(data?.error || 'Cevrilemedi')
      setSpinning(false)
    }
  }

  function animateSpin(prizeType: string, prizeAmount: number) {
    setSpinning(true)
    setPrize(null)

    const segIndex = WHEEL_SEGMENTS.findIndex(s => s.type === prizeType) || 0
    const segAngle = 360 / WHEEL_SEGMENTS.length
    const targetAngle = 360 - (segIndex * segAngle + segAngle / 2)
    const spins = 5 + Math.floor(Math.random() * 3)
    const finalRotation = rotation + spins * 360 + targetAngle

    setRotation(finalRotation)

    setTimeout(() => {
      setPrize({ type: prizeType, amount: prizeAmount })
      setSpinning(false)
      if (!isGuest) loadPlayer()
    }, 4000)
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-[300px]"><Spinner className="h-6 w-6 text-gold" /></div>
  }

  return (
    <div className="p-3 space-y-4 pb-6">
      <div className="text-center">
        <h1 className="font-display text-xl font-black tracking-wider text-gold">SANS CARKI</h1>
        <p className="text-xs text-muted-foreground">Gunde bir kez cevir, odulunu kap!</p>
      </div>

      {/* Wheel */}
      <div className="relative flex items-center justify-center">
        <div className="relative w-72 h-72 mx-auto">
          {/* Pointer */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10">
            <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-t-[20px] border-l-transparent border-r-transparent border-t-gold drop-shadow-lg" />
          </div>

          {/* Wheel body */}
          <div
            ref={wheelRef}
            className="w-full h-full rounded-full border-4 border-gold/40 shadow-2xl shadow-gold/10 overflow-hidden relative"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
            }}
          >
            <svg viewBox="0 0 200 200" className="w-full h-full">
              {WHEEL_SEGMENTS.map((seg, i) => {
                const angle = 360 / WHEEL_SEGMENTS.length
                const startAngle = i * angle - 90
                const endAngle = startAngle + angle
                const startRad = (startAngle * Math.PI) / 180
                const endRad = (endAngle * Math.PI) / 180
                const x1 = 100 + 100 * Math.cos(startRad)
                const y1 = 100 + 100 * Math.sin(startRad)
                const x2 = 100 + 100 * Math.cos(endRad)
                const y2 = 100 + 100 * Math.sin(endRad)
                const largeArc = angle > 180 ? 1 : 0
                const midRad = ((startAngle + angle / 2) * Math.PI) / 180
                const textX = 100 + 65 * Math.cos(midRad)
                const textY = 100 + 65 * Math.sin(midRad)
                const textAngle = startAngle + angle / 2 + 90

                return (
                  <g key={i}>
                    <path
                      d={`M100,100 L${x1},${y1} A100,100 0 ${largeArc},1 ${x2},${y2} Z`}
                      fill={seg.color}
                      stroke="rgba(0,0,0,0.3)"
                      strokeWidth="0.5"
                    />
                    <text
                      x={textX}
                      y={textY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="white"
                      fontSize="6"
                      fontWeight="bold"
                      transform={`rotate(${textAngle}, ${textX}, ${textY})`}
                    >
                      {seg.label}
                    </text>
                  </g>
                )
              })}
              <circle cx="100" cy="100" r="15" fill="#1a1a2e" stroke="rgba(212,175,55,0.6)" strokeWidth="2" />
              <text x="100" y="100" textAnchor="middle" dominantBaseline="middle" fill="#d4af37" fontSize="5" fontWeight="bold">CEVIR</text>
            </svg>
          </div>
        </div>
      </div>

      {/* Prize display */}
      {prize && (
        <Card className="border-gold/30 bg-gradient-to-br from-amber-950/30 to-card animate-in zoom-in-95 duration-300">
          <CardContent className="p-4 text-center space-y-2">
            <Sparkles className="h-6 w-6 text-gold mx-auto" />
            <p className="text-xs text-muted-foreground">Tebrikler!</p>
            <div className="flex items-center justify-center gap-2">
              {(() => {
                const Icon = PRIZE_ICONS[prize.type] || Star
                return <Icon className={`h-5 w-5 ${PRIZE_COLORS[prize.type] || 'text-gold'}`} />
              })()}
              <p className="text-lg font-black text-gold font-display">
                +{prize.amount.toLocaleString()} {prize.type === 'cash' ? 'Nakit' : prize.type === 'xp' ? 'XP' : prize.type === 'diamonds' ? 'Elmas' : prize.type === 'energy' ? 'Enerji' : 'Etki'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Spin button */}
      <Button
        className="w-full h-12 text-sm font-bold gradient-gold text-primary-foreground disabled:opacity-40"
        disabled={!canSpin || spinning}
        onClick={handleSpin}
      >
        {spinning ? (
          <><RotateCw className="h-4 w-4 mr-2 animate-spin" /> Cark donuyor...</>
        ) : canSpin ? (
          <><RotateCw className="h-4 w-4 mr-2" /> Carki Cevir</>
        ) : (
          'Yarin tekrar gel!'
        )}
      </Button>

      {!canSpin && !spinning && (
        <p className="text-[10px] text-center text-muted-foreground">
          Bir sonraki cevirme hakki yarin sifirlanacak.
        </p>
      )}
    </div>
  )
}
