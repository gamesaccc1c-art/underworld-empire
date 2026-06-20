import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Gem, ShoppingBag, Crown, Sparkles, Gift, Zap, CircleCheck as CheckCircle, Package, Timer, Shield, Swords, Star, Lock, TrendingUp, Flame } from 'lucide-react'
import { toast } from 'sonner'
import { useGameStore } from '@/stores/gameStore'
import { useGuestStore } from '@/stores/guestStore'
import * as db from '@/lib/supabase/database'
import type { ShopProduct, VipInfo, ChestDefinition, ChestResult, PlayerItem } from '@/types/game'
import { Spinner } from '@/components/ui/spinner'

const ITEM_NAMES: Record<string, string> = {
  speed_5m: '5 Dakika Hızlandırıcı',
  speed_1h: '1 Saat Hızlandırıcı',
  speed_2h: '2 Saat Hızlandırıcı',
  speed_5h: '5 Saat Hızlandırıcı',
  speed_8h: '8 Saat Hızlandırıcı',
  speed_24h: '24 Saat Hızlandırıcı',
  speed_50h: '50 Saat Hızlandırıcı',
}

const CONTENT_ICONS: Record<string, { icon: string; color: string; label: string }> = {
  diamonds: { icon: '💎', color: 'text-cyan-400', label: 'Elmas' },
  cash: { icon: '💰', color: 'text-green-400', label: 'Nakit' },
  black_money: { icon: '🖤', color: 'text-yellow-400', label: 'Kara Para' },
  weapon_power: { icon: '⚔️', color: 'text-orange-400', label: 'Silah Gücü' },
  influence: { icon: '👑', color: 'text-amber-400', label: 'Etki' },
  intel: { icon: '🔍', color: 'text-blue-400', label: 'İstihbarat' },
  loyalty: { icon: '❤️', color: 'text-red-400', label: 'Sadakat' },
  vip_points: { icon: '⭐', color: 'text-gold', label: 'VIP Puan' },
}

const RARITY_STYLES: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  common: { bg: 'bg-secondary/30', border: 'border-border/40', text: 'text-muted-foreground', badge: 'bg-secondary text-muted-foreground' },
  uncommon: { bg: 'bg-green-950/20', border: 'border-green-700/30', text: 'text-green-400', badge: 'bg-green-900/40 text-green-300' },
  rare: { bg: 'bg-blue-950/20', border: 'border-blue-700/30', text: 'text-blue-400', badge: 'bg-blue-900/40 text-blue-300' },
  epic: { bg: 'bg-purple-950/20', border: 'border-purple-700/30', text: 'text-purple-400', badge: 'bg-purple-900/40 text-purple-300' },
  legendary: { bg: 'bg-amber-950/20', border: 'border-gold/30', text: 'text-gold', badge: 'bg-amber-900/40 text-gold' },
  mythic: { bg: 'bg-red-950/20', border: 'border-red-700/30', text: 'text-red-400', badge: 'bg-red-900/40 text-red-300' },
}

const VIP_BONUS_LABELS: Record<string, string> = {
  construction_speed: 'İnşaat Hızı',
  training_speed: 'Eğitim Hızı',
  research_speed: 'Araştırma Hızı',
  resource_production: 'Kaynak Üretimi',
  attack_bonus: 'Saldırı Bonusu',
  defense_bonus: 'Savunma Bonusu',
  extra_missions: 'Ek Görev',
  extra_raids: 'Ek Baskın',
  energy_regen_bonus: 'Enerji Yenilenme',
  shop_discount: 'Mağaza İndirimi',
  daily_diamonds: 'Günlük Elmas',
}

function PackageCard({ product, onBuy }: { product: ShopProduct; onBuy: () => void }) {
  const isLimited = product.is_limited
  const contents = product.contents as Record<string, number>
  const contentEntries = Object.entries(contents).filter(([, v]) => v > 0).slice(0, 4)

  return (
    <Card className={`relative overflow-hidden transition-all border ${isLimited ? 'card-premium border-gold/30 hover:border-gold/50 hover:glow-gold' : 'border-border/40 bg-card/70 hover:border-gold/20'}`}>
      {/* Top ribbon */}
      {isLimited && (
        <div className="absolute top-0 left-0 right-0 h-0.5 shimmer" />
      )}
      {product.badge === 'EN ÇOK SATAN' && (
        <div className="absolute top-2 right-2 badge-hot">En Çok Satan</div>
      )}
      {isLimited && (
        <div className="absolute top-2 right-2 badge-limited">Sınırlı Süre</div>
      )}

      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${isLimited ? 'bg-gradient-to-br from-amber-600/30 to-amber-900/40 border border-gold/30' : 'bg-secondary/60 border border-border/30'}`}>
            {isLimited ? <Crown className="h-6 w-6 text-gold" /> : <Gift className="h-6 w-6 text-muted-foreground" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-bold ${isLimited ? 'text-gold' : 'text-foreground'}`}>{product.name}</p>
            {product.discount_label && (
              <Badge className="mt-0.5 bg-destructive/20 text-red-300 border-red-700/30 text-[9px] px-1.5">
                <Sparkles className="h-2.5 w-2.5 mr-0.5" />{product.discount_label}
              </Badge>
            )}
          </div>
        </div>

        {/* Content icons */}
        {contentEntries.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {contentEntries.map(([key, val]) => {
              const info = CONTENT_ICONS[key] || { icon: '📦', color: 'text-foreground', label: key }
              return (
                <div key={key} className="flex items-center gap-1 bg-secondary/40 rounded-lg px-2 py-1 border border-border/30">
                  <span className="text-sm">{info.icon}</span>
                  <span className={`text-[10px] font-bold tabular-nums ${info.color}`}>
                    {val >= 1000000 ? `${(val/1000000).toFixed(1)}M` : val >= 1000 ? `${(val/1000).toFixed(0)}K` : val}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Price + buy */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <p className={`text-xl font-black ${isLimited ? 'text-gold' : 'text-foreground'}`}>{product.price} TL</p>
            <p className="text-[9px] text-muted-foreground">+{product.price} VIP puan</p>
          </div>
          <Button
            onClick={onBuy}
            className={`font-bold ${isLimited ? 'gradient-gold text-primary-foreground' : 'bg-secondary hover:bg-secondary/80 text-foreground border border-border/50'}`}
          >
            <ShoppingBag className="h-4 w-4 mr-1.5" />
            Satın Al
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function DiamondCard({ product, onBuy }: { product: ShopProduct; onBuy: () => void }) {
  const contents = product.contents as Record<string, number>
  const diamonds = contents.diamonds || 0
  const isPopular = product.badge === 'EN ÇOK SATAN'
  const hasBig = diamonds >= 2000

  return (
    <Card className={`relative overflow-hidden border transition-all cursor-pointer hover:scale-[1.02] active:scale-100 ${isPopular ? 'border-gold/40 bg-gradient-to-br from-amber-950/30 to-card' : 'border-border/30 bg-card/60 hover:border-cyan-700/30'}`}
      onClick={onBuy}>
      {isPopular && <div className="absolute top-0 inset-x-0 h-0.5 shimmer" />}
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <div className={`h-12 w-12 rounded-xl flex flex-col items-center justify-center shrink-0 ${hasBig ? 'bg-gradient-to-br from-cyan-900/50 to-cyan-950/50 border border-cyan-700/40' : 'bg-cyan-950/30 border border-cyan-900/30'}`}>
            <Gem className={`h-5 w-5 ${hasBig ? 'text-cyan-300' : 'text-cyan-500'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-bold truncate">{product.name}</p>
              {isPopular && <span className="badge-hot shrink-0">Popüler</span>}
            </div>
            <p className="text-lg font-black text-cyan-400 tabular-nums">{diamonds.toLocaleString()} 💎</p>
            {product.discount_label && (
              <p className="text-[9px] text-destructive font-bold">{product.discount_label}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-base font-bold text-gold">{product.price} TL</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function ShopPage() {
  const [products, setProducts] = useState<ShopProduct[]>([])
  const [chests, setChests] = useState<ChestDefinition[]>([])
  const [items, setItems] = useState<PlayerItem[]>([])
  const [vipInfo, setVipInfo] = useState<VipInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [purchaseModal, setPurchaseModal] = useState<ShopProduct | null>(null)
  const [chestResult, setChestResult] = useState<ChestResult | null>(null)
  const [purchased, setPurchased] = useState(false)
  const [activeTab, setActiveTab] = useState('packages')

  const isGuest = useGuestStore(s => s.isGuest)
  const guestPlayer = useGuestStore(s => s.player)
  const guestAdd = useGuestStore(s => s.addResources)
  const authPlayer = useGameStore(s => s.player)
  const loadPlayer = useGameStore(s => s.loadPlayer)
  const player = isGuest ? guestPlayer : authPlayer

  useEffect(() => {
    async function load() {
      try {
        const [prods, ch, vip, it] = await Promise.all([
          db.getShopProducts(),
          db.getChestDefinitions(),
          isGuest ? null : db.getVipInfo(),
          isGuest ? [] : db.getPlayerItems(),
        ])
        setProducts(prods)
        setChests(ch)
        if (vip) setVipInfo(vip)
        setItems(it as PlayerItem[])
      } catch (e: unknown) {
        toast.error('Magaza yuklenemedi: ' + (e as Error).message)
      }
      setLoading(false)
    }
    load()
  }, [isGuest])

  async function handleDemoPurchase(product: ShopProduct) {
    if (isGuest) {
      const contents = product.contents as Record<string, number>
      const resources: Record<string, number> = {}
      if (contents.diamonds) resources.diamonds = contents.diamonds
      if (contents.cash) resources.cash = contents.cash
      if (contents.weapon_power) resources.weapon_power = contents.weapon_power
      if (contents.influence) resources.influence = contents.influence
      guestAdd(resources)
      setPurchased(true)
      setTimeout(() => { setPurchased(false); setPurchaseModal(null) }, 2000)
      return
    }
    const result = await db.buyDemoProduct(product.id)
    if (!result.ok) { toast.error(result.error || 'Satın alma başarısız'); return }
    await loadPlayer()
    setPurchased(true)
    toast.success(`${product.name} satın alındı!`)
    setTimeout(() => { setPurchased(false); setPurchaseModal(null) }, 2000)
    const vip = await db.getVipInfo()
    if (vip) setVipInfo(vip)
    const it = await db.getPlayerItems()
    setItems(it)
  }

  async function handleOpenChest(chestType: string) {
    if (isGuest) { toast.error('Hesap gerekli'); return }
    const result = await db.openGameChest(chestType)
    if (!result.ok) { toast.error(result.error); return }
    setChestResult(result)
    await loadPlayer()
  }

  async function handleClaimVipDaily() {
    if (isGuest) return
    const result = await db.claimVipDaily()
    if (!result.ok) { toast.error(result.error); return }
    toast.success(`+${result.diamonds} Elmas alındı!`)
    await loadPlayer()
    const vip = await db.getVipInfo()
    if (vip) setVipInfo(vip)
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <Spinner className="h-8 w-8 text-gold" />
      <p className="text-xs text-muted-foreground font-display tracking-wider">MAĞAZA YÜKLENİYOR...</p>
    </div>
  )

  const limitedProducts = products.filter(p => p.is_limited)
  const regularPackages = products.filter(p => !p.is_limited && !p.sku.startsWith('diamond_'))
  const diamondProducts = products.filter(p => p.sku.startsWith('diamond_'))

  return (
    <div className="p-3 space-y-3 pb-6">
      <div className="text-center">
        <h1 className="font-display text-lg font-black tracking-wider text-gold">MAĞAZA</h1>
        <p className="text-xs text-muted-foreground">Gücünü artır, rakiplerini ez</p>
      </div>

      {/* Diamond + VIP balance bar */}
      <div className="bg-gradient-to-r from-amber-950/40 via-card to-cyan-950/30 border border-border/40 rounded-2xl p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-cyan-950/50 border border-cyan-800/40 rounded-xl px-3 py-2">
            <Gem className="h-5 w-5 text-cyan-400" />
            <div>
              <p className="text-[9px] text-muted-foreground leading-none">Elmas</p>
              <p className="text-base font-black text-cyan-400 tabular-nums leading-tight">{player?.diamonds?.toLocaleString() || 0}</p>
            </div>
          </div>
          {vipInfo && vipInfo.vip_level > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-950/50 border border-gold/30 rounded-xl px-3 py-2">
              <Crown className="h-4 w-4 text-gold" />
              <div>
                <p className="text-[9px] text-muted-foreground leading-none">VIP</p>
                <p className="text-base font-black text-gold leading-tight">{vipInfo.vip_level}</p>
              </div>
            </div>
          )}
        </div>
        <Button size="sm" className="gradient-gold text-primary-foreground font-bold" onClick={() => setActiveTab('diamonds')}>
          <Gem className="h-3.5 w-3.5 mr-1.5" /> Elmas Al
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 h-9 bg-secondary/50">
          <TabsTrigger value="packages" className="text-[10px] font-semibold data-[state=active]:text-gold gap-1">
            <ShoppingBag className="h-3.5 w-3.5" /><span className="hidden sm:inline">Paketler</span>
          </TabsTrigger>
          <TabsTrigger value="vip" className="text-[10px] font-semibold data-[state=active]:text-gold gap-1">
            <Crown className="h-3.5 w-3.5" /><span className="hidden sm:inline">VIP</span>
          </TabsTrigger>
          <TabsTrigger value="chests" className="text-[10px] font-semibold data-[state=active]:text-gold gap-1">
            <Package className="h-3.5 w-3.5" /><span className="hidden sm:inline">Sandık</span>
          </TabsTrigger>
          <TabsTrigger value="items" className="text-[10px] font-semibold data-[state=active]:text-gold gap-1">
            <Timer className="h-3.5 w-3.5" /><span className="hidden sm:inline">Eşya</span>
          </TabsTrigger>
          <TabsTrigger value="diamonds" className="text-[10px] font-semibold data-[state=active]:text-cyan-400 gap-1">
            <Gem className="h-3.5 w-3.5" /><span className="hidden sm:inline">Elmas</span>
          </TabsTrigger>
        </TabsList>

        {/* ═══ PACKAGES TAB ═══ */}
        <TabsContent value="packages" className="space-y-3 mt-3">
          {limitedProducts.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Flame className="h-3.5 w-3.5 text-red-400" />
                <p className="text-xs font-bold text-red-400 uppercase tracking-wide">Sınırlı Süreli Teklifler</p>
              </div>
              {limitedProducts.map(product => (
                <PackageCard key={product.id} product={product} onBuy={() => setPurchaseModal(product)} />
              ))}
            </div>
          )}

          {regularPackages.length > 0 && (
            <div className="space-y-2">
              {limitedProducts.length > 0 && <p className="text-xs font-semibold text-muted-foreground mt-2">Diğer Paketler</p>}
              {regularPackages.map(product => (
                <PackageCard key={product.id} product={product} onBuy={() => setPurchaseModal(product)} />
              ))}
            </div>
          )}

          {products.filter(p => !p.sku.startsWith('diamond_')).length === 0 && (
            <div className="py-12 text-center space-y-2">
              <Package className="h-10 w-10 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">Paket bulunamadı</p>
            </div>
          )}
        </TabsContent>

        {/* ═══ VIP TAB ═══ */}
        <TabsContent value="vip" className="space-y-3 mt-3">
          {vipInfo ? (
            <>
              {/* VIP Header card */}
              <div className="relative bg-gradient-to-br from-amber-950/40 to-card border border-gold/30 rounded-2xl overflow-hidden p-4 space-y-3">
                <div className="absolute top-0 inset-x-0 h-0.5 shimmer" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-amber-500/30 to-amber-900/50 border border-gold/40 flex items-center justify-center">
                      <Crown className="h-7 w-7 text-gold" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xl font-black text-gold font-display">VIP {vipInfo.vip_level}</p>
                        {vipInfo.vip_level === 0 && <Badge className="badge-new text-[9px]">Yeni Başla</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{vipInfo.vip_points?.toLocaleString()} VIP Puanı</p>
                    </div>
                  </div>
                  {vipInfo.can_claim_daily && vipInfo.vip_level > 0 && (
                    <Button size="sm" className="gradient-gold text-primary-foreground font-bold" onClick={handleClaimVipDaily}>
                      <Gift className="h-3.5 w-3.5 mr-1" /> Günlük Al
                    </Button>
                  )}
                </div>

                {/* Progress bar */}
                {vipInfo.next && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">VIP {vipInfo.vip_level + 1} için</span>
                      <span className="text-gold font-bold">{vipInfo.vip_points.toLocaleString()} / {vipInfo.next.points_required.toLocaleString()}</span>
                    </div>
                    <div className="h-3 bg-secondary/60 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.min((vipInfo.vip_points / vipInfo.next.points_required) * 100, 100)}%`,
                          background: 'linear-gradient(90deg, oklch(0.78 0.15 75), oklch(0.65 0.18 50))'
                        }}
                      />
                    </div>
                    <p className="text-[9px] text-muted-foreground text-center">Her satın alma VIP puanı kazandırır!</p>
                  </div>
                )}

                {/* Subscriptions */}
                <div className="flex gap-2 flex-wrap">
                  {vipInfo.monthly_card_active && (
                    <Badge className="bg-emerald-900/30 text-emerald-400 border-emerald-700/30 text-[9px]">
                      <CheckCircle className="h-2.5 w-2.5 mr-1" />Aylık Kart Aktif
                    </Badge>
                  )}
                  {vipInfo.season_pass_active && (
                    <Badge className="bg-cyan-900/30 text-cyan-400 border-cyan-700/30 text-[9px]">
                      <CheckCircle className="h-2.5 w-2.5 mr-1" />Sezon Kartı Aktif
                    </Badge>
                  )}
                </div>
              </div>

              {/* Active bonuses */}
              {vipInfo.current && vipInfo.vip_level > 0 && (
                <Card className="border-border/30">
                  <CardContent className="p-3 space-y-2">
                    <p className="text-xs font-bold flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-gold" />Aktif VIP Bonusları
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {Object.entries(vipInfo.current)
                        .filter(([k, v]) => !['id', 'vip_level', 'points_required', 'daily_chest_tier'].includes(k) && typeof v === 'number' && v > 0)
                        .map(([key, val]) => (
                          <div key={key} className="flex items-center gap-1.5 bg-secondary/30 rounded-lg px-2 py-1">
                            <TrendingUp className="h-2.5 w-2.5 text-gold shrink-0" />
                            <span className="text-[10px] text-muted-foreground truncate">{VIP_BONUS_LABELS[key] || key}</span>
                            <span className="text-[10px] text-gold font-bold ml-auto shrink-0">
                              +{val as number}{['speed', 'production', 'bonus', 'discount', 'regen'].some(s => key.includes(s)) ? '%' : ''}
                            </span>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* VIP level progression */}
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-muted-foreground">VIP Seviyeleri</p>
                {(vipInfo.all || []).map(vip => {
                  const isActive = vipInfo.vip_level >= vip.vip_level
                  const isCurrent = vipInfo.vip_level === vip.vip_level
                  const isNext = vip.vip_level === vipInfo.vip_level + 1
                  return (
                    <Card key={vip.vip_level} className={`border transition-all ${isActive ? 'bg-amber-950/20 border-gold/20' : isNext ? 'border-blue-700/20 opacity-80' : 'opacity-40 border-border/20'}`}>
                      <CardContent className="p-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`h-6 w-6 rounded-lg flex items-center justify-center ${isActive ? 'bg-gold/20' : 'bg-secondary/40'}`}>
                              <Crown className={`h-3 w-3 ${isActive ? 'text-gold' : 'text-muted-foreground'}`} />
                            </div>
                            <div>
                              <p className="text-xs font-bold">VIP {vip.vip_level}</p>
                              <p className="text-[9px] text-muted-foreground">{vip.points_required.toLocaleString()} puan</p>
                            </div>
                          </div>
                          {isCurrent && <Badge className="bg-gold/20 text-gold border-gold/30 text-[8px]">Mevcut</Badge>}
                          {isNext && <Badge className="bg-blue-900/20 text-blue-400 border-blue-700/20 text-[8px]">Sonraki</Badge>}
                          {!isActive && !isNext && <Lock className="h-3.5 w-3.5 text-muted-foreground/40" />}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2">
                          {vip.attack_bonus > 0 && <span className="text-[9px] text-orange-400"><Swords className="h-2.5 w-2.5 inline mr-0.5" />+{vip.attack_bonus}%</span>}
                          {vip.defense_bonus > 0 && <span className="text-[9px] text-blue-400"><Shield className="h-2.5 w-2.5 inline mr-0.5" />+{vip.defense_bonus}%</span>}
                          {vip.construction_speed > 0 && <span className="text-[9px] text-green-400"><Timer className="h-2.5 w-2.5 inline mr-0.5" />+{vip.construction_speed}%</span>}
                          {vip.daily_diamonds > 0 && <span className="text-[9px] text-cyan-400"><Gem className="h-2.5 w-2.5 inline mr-0.5" />{vip.daily_diamonds}/gün</span>}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <div className="h-16 w-16 rounded-2xl bg-amber-950/30 border border-gold/20 flex items-center justify-center">
                <Crown className="h-8 w-8 text-gold/40" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-muted-foreground">VIP bilgisi yükleniyor...</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Giriş yaparak VIP avantajlarından yararlan</p>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ═══ CHESTS TAB ═══ */}
        <TabsContent value="chests" className="space-y-3 mt-3">
          <p className="text-xs text-muted-foreground">Sandık aç, nadir ödüller kazan!</p>
          <div className="grid grid-cols-2 gap-2">
            {chests.map(chest => {
              const style = RARITY_STYLES[chest.chest_type] || RARITY_STYLES.common
              const canOpen = !isGuest && player && (player.diamonds || 0) >= chest.diamond_cost
              return (
                <Card key={chest.id} className={`${style.bg} border ${style.border} hover:scale-[1.02] transition-all`}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${style.bg} border ${style.border}`}>
                        <Package className={`h-5 w-5 ${style.text}`} />
                      </div>
                      <Badge className={`${style.badge} border text-[8px] capitalize`}>{chest.chest_type}</Badge>
                    </div>
                    <p className={`text-xs font-bold ${style.text}`}>{chest.name}</p>
                    <div className="space-y-0.5">
                      {Object.entries(chest.drop_rates).filter(([, v]) => v > 0).map(([rarity, rate]) => (
                        <div key={rarity} className="flex justify-between text-[8px]">
                          <span className={RARITY_STYLES[rarity]?.text || 'text-muted-foreground capitalize'}>{rarity}</span>
                          <span className="text-muted-foreground">{rate}%</span>
                        </div>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      className={`w-full h-7 text-[10px] font-bold ${canOpen ? 'gradient-gold text-primary-foreground' : 'bg-secondary/60 text-muted-foreground border border-border/30'}`}
                      onClick={() => handleOpenChest(chest.chest_type)}
                      disabled={!canOpen}
                    >
                      <Gem className="h-3 w-3 mr-1 text-cyan-400" /> {chest.diamond_cost} Elmas
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* ═══ ITEMS TAB ═══ */}
        <TabsContent value="items" className="space-y-3 mt-3">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <div className="h-14 w-14 rounded-2xl bg-secondary/40 flex items-center justify-center">
                <Timer className="h-7 w-7 text-muted-foreground/30" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-muted-foreground">Henüz eşya yok</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Sandık aç veya paket satın al</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {items.filter(i => i.amount > 0).map(item => (
                <Card key={item.item_key} className="border-border/30 bg-card/60">
                  <CardContent className="p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="h-8 w-8 rounded-lg bg-cyan-950/40 border border-cyan-800/30 flex items-center justify-center">
                        <Timer className="h-4 w-4 text-cyan-400" />
                      </div>
                      <Badge variant="outline" className="text-[9px] h-5 px-1.5 border-cyan-700/30 text-cyan-400 font-bold">{item.amount}×</Badge>
                    </div>
                    <p className="text-[10px] font-semibold leading-tight">{ITEM_NAMES[item.item_key] || item.item_key}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ═══ DIAMONDS TAB ═══ */}
        <TabsContent value="diamonds" className="space-y-2 mt-3">
          <div className="text-center py-2">
            <p className="text-xs text-muted-foreground">Elmas satın al, her alışveriş VIP puanı kazandırır</p>
          </div>
          {diamondProducts.map(product => (
            <DiamondCard key={product.id} product={product} onBuy={() => setPurchaseModal(product)} />
          ))}
          {diamondProducts.length === 0 && (
            <div className="py-8 text-center">
              <Gem className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Elmas paketi bulunamadı</p>
            </div>
          )}
          <div className="bg-secondary/20 border border-border/20 rounded-xl p-3 text-center">
            <p className="text-[9px] text-muted-foreground flex items-center justify-center gap-1">
              <Star className="h-3 w-3 text-gold" />
              Her satın alma VIP puanı kazandırır!
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Purchase Confirm Modal */}
      <Dialog open={!!purchaseModal} onOpenChange={() => { setPurchaseModal(null); setPurchased(false) }}>
        <DialogContent className="bg-card border-border/50 max-w-sm">
          {purchaseModal && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-700/30 to-amber-900/30 border border-gold/30 flex items-center justify-center shrink-0">
                    <Gift className="h-5 w-5 text-gold" />
                  </div>
                  <span>{purchaseModal.name}</span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Contents */}
                <div className="bg-secondary/40 rounded-xl p-3 border border-border/30 space-y-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Paket İçeriği</p>
                  <div className="space-y-1.5">
                    {Object.entries(purchaseModal.contents as Record<string, number>).filter(([, v]) => v > 0).map(([key, val]) => {
                      const info = CONTENT_ICONS[key] || { icon: '📦', color: 'text-foreground', label: key }
                      return (
                        <div key={key} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span>{info.icon}</span>
                            <span className="text-xs text-muted-foreground">{info.label}</span>
                          </div>
                          <span className={`text-sm font-bold ${info.color}`}>
                            +{val >= 1000000 ? `${(val/1000000).toFixed(1)}M` : val >= 1000 ? `${(val/1000).toFixed(0)}K` : val}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {purchased ? (
                  <div className="text-center space-y-3 py-4">
                    <div className="h-14 w-14 rounded-full bg-neon/10 border border-neon/30 flex items-center justify-center mx-auto">
                      <CheckCircle className="h-8 w-8 text-neon" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-neon">Başarılı!</p>
                      <p className="text-xs text-muted-foreground">Kaynaklar hesabınıza eklendi.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-center bg-secondary/30 rounded-xl p-3 border border-border/30">
                      <p className="text-3xl font-black text-gold">{purchaseModal.price} TL</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">+{purchaseModal.price} VIP Puanı</p>
                    </div>
                    <Button className="w-full gradient-gold text-primary-foreground font-bold h-12 text-base" onClick={() => handleDemoPurchase(purchaseModal)}>
                      <ShoppingBag className="h-5 w-5 mr-2" /> Demo Satın Al
                    </Button>
                    <p className="text-[9px] text-muted-foreground text-center">Demo mod aktif — gerçek ödeme alınmaz.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Chest Result Modal */}
      <Dialog open={!!chestResult} onOpenChange={() => setChestResult(null)}>
        <DialogContent className="bg-card border-border/50 max-w-sm">
          {chestResult?.ok && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 justify-center text-gold font-display">
                  <Package className="h-6 w-6" /> Sandık Açıldı!
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-center">
                <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-sm font-bold mx-auto ${RARITY_STYLES[chestResult.rarity || 'common']?.badge}`}>
                  {chestResult.rarity?.toUpperCase()}
                </div>
                <div className="bg-secondary/40 rounded-2xl p-4 border border-border/30 space-y-2">
                  {Object.entries(chestResult.rewards || {}).map(([key, val]) => {
                    const info = CONTENT_ICONS[key] || { icon: '📦', color: 'text-neon', label: key }
                    return (
                      <div key={key} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{info.icon}</span>
                          <span className="text-sm text-muted-foreground">{ITEM_NAMES[key] || info.label}</span>
                        </div>
                        <span className={`text-base font-bold ${info.color}`}>+{(val as number).toLocaleString()}</span>
                      </div>
                    )
                  })}
                </div>
                <Button className="w-full gradient-gold text-primary-foreground font-bold" onClick={() => setChestResult(null)}>
                  Harika! Devam Et
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
