import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Users, Crown, Shield, Zap, Plus, Search, Swords, Star, Trophy, HandHelping, MessageCircle, Beaker, Gift, LogOut, UserMinus, ChevronUp, ChevronDown, Lock } from 'lucide-react'
import { useGuestStore } from '@/stores/guestStore'
import { useGameStore } from '@/stores/gameStore'
import { toast } from 'sonner'
import * as db from '@/lib/supabase/database'
import type { Family, FamilyMember, FamilyTech, FamilyHelpRequest, FamilyChatMessage } from '@/types/game'

const RANK_NAMES: Record<number, string> = { 1: 'Uye', 2: 'Guvenilir', 3: 'Yetkili', 4: 'Sag Kol', 5: 'Patron' }
const RANK_COLORS: Record<number, string> = {
  1: 'text-muted-foreground',
  2: 'text-blue-400',
  3: 'text-emerald-400',
  4: 'text-amber-400',
  5: 'text-gold',
}
const RANK_BG: Record<number, string> = {
  1: 'bg-secondary/40',
  2: 'bg-blue-950/30 border border-blue-900/30',
  3: 'bg-emerald-950/30 border border-emerald-900/30',
  4: 'bg-amber-950/30 border border-amber-900/30',
  5: 'bg-amber-950/40 border border-gold/30',
}

const TECH_INFO: Record<string, { name: string; desc: string; icon: React.ElementType }> = {
  attack_bonus:      { name: 'Saldiri Bonusu', desc: '+%5/lv saldiri gucu', icon: Swords },
  defense_bonus:     { name: 'Savunma Bonusu', desc: '+%5/lv savunma gucu', icon: Shield },
  resource_bonus:    { name: 'Kaynak Bonusu', desc: 'Uretim +%3/lv', icon: Gift },
  help_speed:        { name: 'Yardim Hizi', desc: 'Sure -%10/lv', icon: HandHelping },
  territory_income:  { name: 'Bolge Geliri', desc: '+%5/lv gelir', icon: Trophy },
}

const DONATION_AMOUNTS: Record<string, number> = {
  cash: 5000, influence: 500, loyalty: 500,
  weapon_power: 500, black_money: 1000, intel: 200,
}

const RESOURCE_NAMES: Record<string, string> = {
  cash: 'Nakit', influence: 'Nufuz', loyalty: 'Sadakat',
  weapon_power: 'Silah Gucu', black_money: 'Kara Para', intel: 'Istihbarat',
}

// ─── Rank Badge ───────────────────────────────────────────────────────────────

function RankBadge({ rank, size = 'sm' }: { rank: number; size?: 'sm' | 'lg' }) {
  const isLeader = rank === 5
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full font-bold ${
      size === 'lg' ? 'text-xs px-2 py-0.5' : 'text-[9px] px-1.5 py-0.5'
    } ${RANK_BG[rank]} ${RANK_COLORS[rank]}`}>
      {isLeader && <Crown className={size === 'lg' ? 'h-3 w-3' : 'h-2.5 w-2.5'} />}
      {RANK_NAMES[rank]}
    </span>
  )
}

export function FamilyPage() {
  const isGuest = useGuestStore(s => s.isGuest)
  const guestPlayer = useGuestStore(s => s.player)
  const authPlayer = useGameStore(s => s.player)
  const player = isGuest ? guestPlayer : authPlayer
  const loadPlayer = useGameStore(s => s.loadPlayer)

  const [families, setFamilies] = useState<Family[]>([])
  const [myFamily, setMyFamily] = useState<Family | null>(null)
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [tech, setTech] = useState<FamilyTech[]>([])
  const [helpRequests, setHelpRequests] = useState<FamilyHelpRequest[]>([])
  const [chatMessages, setChatMessages] = useState<FamilyChatMessage[]>([])
  const [myRank, setMyRank] = useState(1)
  const [myContribution, setMyContribution] = useState(0)

  const [createOpen, setCreateOpen] = useState(false)
  const [familyName, setFamilyName] = useState('')
  const [familyTag, setFamilyTag] = useState('')
  const [familyDesc, setFamilyDesc] = useState('')
  const [search, setSearch] = useState('')
  const [chatInput, setChatInput] = useState('')
  const [loading, setLoading] = useState(false)

  const loadFamilies = useCallback(async () => {
    if (isGuest) return
    try { setFamilies(await db.getFamilies()) } catch { /* ignore */ }
  }, [isGuest])

  const loadMyFamily = useCallback(async () => {
    if (isGuest || !player?.family_id) { setMyFamily(null); setMembers([]); setTech([]); return }
    const details = await db.getFamilyDetails(player.family_id)
    if (details?.ok) {
      setMyFamily(details.family)
      setMembers(details.members)
      setTech(details.tech)
      const me = details.members.find(m => m.user_id === player.id)
      if (me) { setMyRank(me.rank); setMyContribution(me.contribution) }
    }
  }, [isGuest, player?.family_id, player?.id])

  const loadHelp = useCallback(async () => {
    if (!player?.family_id) return
    try { setHelpRequests(await db.getFamilyHelpRequests(player.family_id)) } catch { /* ignore */ }
  }, [player?.family_id])

  const loadChat = useCallback(async () => {
    if (!player?.family_id) return
    try { setChatMessages(await db.getFamilyChat(player.family_id)) } catch { /* ignore */ }
  }, [player?.family_id])

  useEffect(() => { loadFamilies() }, [loadFamilies])
  useEffect(() => { loadMyFamily() }, [loadMyFamily])
  useEffect(() => { loadHelp() }, [loadHelp])
  useEffect(() => { loadChat() }, [loadChat])

  async function handleCreate() {
    if (!player || !familyName || !familyTag || isGuest) return
    setLoading(true)
    const result = await db.createFamily(familyName, familyTag, familyDesc)
    setLoading(false)
    if (!result.ok) { toast.error(result.error); return }
    toast.success('Aile kuruldu!')
    setCreateOpen(false); setFamilyName(''); setFamilyTag(''); setFamilyDesc('')
    await loadPlayer(); await loadMyFamily(); await loadFamilies()
  }

  async function handleJoin(familyId: string) {
    if (isGuest) return
    setLoading(true)
    const result = await db.joinFamily(familyId)
    setLoading(false)
    if (!result.ok) { toast.error(result.error); return }
    toast.success('Aileye katildiniz!')
    await loadPlayer(); await loadMyFamily(); await loadFamilies()
  }

  async function handleLeave() {
    if (isGuest) return
    setLoading(true)
    const result = await db.leaveFamily()
    setLoading(false)
    if (!result.ok) { toast.error(result.error); return }
    toast.success('Aileden ayrildiniz')
    await loadPlayer()
    setMyFamily(null); setMembers([]); setTech([])
    await loadFamilies()
  }

  async function handleDonate(resource: string) {
    const amount = DONATION_AMOUNTS[resource] || 1000
    setLoading(true)
    const result = await db.donateToFamily(resource, amount)
    setLoading(false)
    if (!result.ok) { toast.error(result.error); return }
    toast.success(`+${result.contribution} katki puani kazanildi!`)
    await loadPlayer(); await loadMyFamily()
  }

  async function handleUpgradeTech(techKey: string) {
    setLoading(true)
    const result = await db.upgradeFamilyTech(techKey)
    setLoading(false)
    if (!result.ok) { toast.error(result.error); return }
    toast.success(`Teknoloji Lv.${result.new_level} oldu!`)
    await loadMyFamily()
  }

  async function handleGiveHelp(requestId: string) {
    setLoading(true)
    const result = await db.giveFamilyHelp(requestId)
    setLoading(false)
    if (!result.ok) { toast.error(result.error); return }
    toast.success(`${result.time_reduced}s sure azaltildi!`)
    await loadHelp()
  }

  async function handleChangeRank(userId: string, newRank: number) {
    setLoading(true)
    const result = await db.changeMemberRank(userId, newRank)
    setLoading(false)
    if (!result.ok) { toast.error(result.error); return }
    toast.success('Rutbe degistirildi!')
    await loadMyFamily()
  }

  async function handleKick(userId: string) {
    setLoading(true)
    const result = await db.kickFamilyMember(userId)
    setLoading(false)
    if (!result.ok) { toast.error(result.error); return }
    toast.success('Uye atildi')
    await loadMyFamily()
  }

  async function handleSendChat() {
    if (!chatInput.trim() || !player?.family_id) return
    const result = await db.sendFamilyChat(player.family_id, chatInput.trim(), player.username)
    if (!result.ok) { toast.error(result.error || 'Mesaj gönderilemedi'); return }
    setChatInput('')
    await loadChat()
  }

  const filtered = families.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.tag.toLowerCase().includes(search.toLowerCase())
  )

  // ─── No Family View ──────────────────────────────────────────────────────────
  if (!myFamily) {
    return (
      <div className="p-3 space-y-4 pb-6">
        {/* Header */}
        <div className="relative rounded-2xl overflow-hidden border border-border/30 bg-gradient-to-br from-slate-900 via-card to-amber-950/20">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-950/20 via-transparent to-transparent pointer-events-none" />
          <div className="relative px-4 py-4 text-center space-y-1">
            <h1 className="font-display text-xl font-black tracking-wider text-gold drop-shadow-[0_0_15px_oklch(0.78_0.15_75/30%)]">
              AILE
            </h1>
            <p className="text-xs text-muted-foreground">Aile kur veya katil, birlikte guclen</p>
          </div>
        </div>

        {/* Benefits */}
        <div className="bg-card/60 border border-border/30 rounded-xl p-3">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1">
            <Trophy className="h-3 w-3 text-gold" /> Aile Avantajlari
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {Object.entries(TECH_INFO).map(([key, info]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className="h-6 w-6 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
                  <info.icon className="h-3 w-3 text-gold" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold">{info.name}</p>
                  <p className="text-[9px] text-muted-foreground">{info.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="w-full gradient-gold text-primary-foreground font-bold">
              <Plus className="h-4 w-4 mr-1.5" /> Aile Kur
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border/50 max-w-sm">
            <DialogHeader>
              <DialogTitle>Yeni Aile Kur</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {isGuest && (
                <div className="bg-amber-950/30 border border-amber-700/30 rounded-xl p-3">
                  <p className="text-xs text-amber-400">Aile kurmak icin hesap olusturmaniz gerekir!</p>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">Aile Adi</Label>
                <Input value={familyName} onChange={e => setFamilyName(e.target.value)} placeholder="Karanlik Ailesi" disabled={isGuest} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Etiket (2-4 harf)</Label>
                <Input value={familyTag} onChange={e => setFamilyTag(e.target.value.toUpperCase())} placeholder="KRN" maxLength={4} disabled={isGuest} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Aciklama (opsiyonel)</Label>
                <Input value={familyDesc} onChange={e => setFamilyDesc(e.target.value)} placeholder="Aile aciklamasi..." disabled={isGuest} />
              </div>
              <div className="bg-secondary/30 rounded-lg px-3 py-2 space-y-0.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Maliyet:</span>
                  <span className="text-gold font-bold">50.000 Nakit</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Min. Seviye:</span>
                  <span className="text-gold font-bold">5</span>
                </div>
              </div>
              <Button
                className="w-full gradient-gold text-primary-foreground font-bold"
                onClick={handleCreate}
                disabled={isGuest || !familyName || !familyTag || loading}
              >
                {loading ? 'Kuruluyor...' : 'Aile Kur'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Search & Family List */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Aile ara..."
              className="pl-8 h-9 text-xs bg-secondary/30"
            />
          </div>
          {filtered.length === 0 ? (
            <div className="text-center py-6">
              <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Aile bulunamadi</p>
            </div>
          ) : (
            filtered.map((family, i) => (
              <Card key={family.id} className="border-border/30 bg-card/80 hover:border-gold/20 transition-all">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2.5">
                    <div className="relative shrink-0">
                      <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-amber-700 to-amber-900 flex items-center justify-center border border-gold/30">
                        <span className="text-xs font-black text-gold">{family.tag}</span>
                      </div>
                      {i < 3 && (
                        <div className={`absolute -top-1 -right-1 h-4 w-4 rounded-full flex items-center justify-center ${i === 0 ? 'bg-gold' : i === 1 ? 'bg-slate-400' : 'bg-amber-700'}`}>
                          <span className="text-[8px] font-black text-primary-foreground">{i + 1}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold truncate">{family.name}</p>
                        <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-gold/30 text-gold/80 shrink-0">Lv.{family.level}</Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">{family.description || 'Aciklama yok'}</p>
                      <div className="flex items-center gap-2 text-[9px] text-muted-foreground mt-1">
                        <span className="flex items-center gap-0.5"><Users className="h-2.5 w-2.5" />{family.member_count}/{family.max_members}</span>
                        <span className="flex items-center gap-0.5"><Zap className="h-2.5 w-2.5" />{((family.power || 0) / 1000).toFixed(0)}K</span>
                        <span className="flex items-center gap-0.5"><Star className="h-2.5 w-2.5" />{family.territory_count} bolge</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-gold/20 hover:bg-gold/30 border border-gold/30 text-gold shrink-0"
                      onClick={() => handleJoin(family.id)}
                      disabled={loading || isGuest || !!player?.family_id}
                    >
                      Katil
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    )
  }

  // ─── Has Family View ─────────────────────────────────────────────────────────
  const totalContribution = members.reduce((sum, m) => sum + (m.contribution || 0), 0)
  const myContribPct = totalContribution > 0 ? Math.round((myContribution / totalContribution) * 100) : 0

  return (
    <div className="p-3 space-y-3 pb-6">
      {/* Family profile card */}
      <div className="relative rounded-2xl overflow-hidden border border-gold/20 bg-gradient-to-br from-amber-950/40 via-card to-slate-900">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-950/20 via-transparent to-transparent pointer-events-none" />
        <div className="relative p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-amber-600 to-amber-900 flex items-center justify-center border-2 border-gold/40 shrink-0 shadow-lg">
              <span className="text-lg font-black text-gold">{myFamily.tag}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-base font-black">{myFamily.name}</p>
                <Badge variant="outline" className="text-[9px] border-gold/30 text-gold/80 px-1.5">Lv.{myFamily.level}</Badge>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">{myFamily.member_count}/{myFamily.max_members} uye</p>
              <RankBadge rank={myRank} size="sm" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { value: `${((myFamily.power || 0) / 1000).toFixed(0)}K`, label: 'Guc', color: 'text-red-400' },
              { value: myFamily.territory_count, label: 'Bolge', color: 'text-blue-400' },
              { value: myFamily.xp?.toLocaleString(), label: 'XP', color: 'text-gold' },
            ].map(({ value, label, color }) => (
              <div key={label} className="bg-black/20 rounded-xl p-2 text-center">
                <p className={`text-sm font-black ${color} font-display`}>{value}</p>
                <p className="text-[9px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          {/* My contribution */}
          <div className="bg-black/20 rounded-xl px-3 py-2 space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">Katkım</span>
              <span className="text-gold font-bold">{myContribution.toLocaleString()} · %{myContribPct}</span>
            </div>
            <div className="h-1.5 bg-secondary/60 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${myContribPct}%`,
                  background: 'linear-gradient(90deg, oklch(0.78 0.15 75), oklch(0.85 0.18 85))',
                }}
              />
            </div>
          </div>

          {myFamily.announcement && (
            <div className="bg-gold/5 border border-gold/20 rounded-xl px-3 py-2">
              <p className="text-[10px] text-gold/80 flex items-start gap-1.5">
                <Crown className="h-3 w-3 mt-0.5 shrink-0" />
                {myFamily.announcement}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="members">
        <TabsList className="grid w-full grid-cols-5 h-9">
          <TabsTrigger value="members" className="text-[9px] px-0.5"><Users className="h-3.5 w-3.5" /></TabsTrigger>
          <TabsTrigger value="donate" className="text-[9px] px-0.5"><Gift className="h-3.5 w-3.5" /></TabsTrigger>
          <TabsTrigger value="tech" className="text-[9px] px-0.5"><Beaker className="h-3.5 w-3.5" /></TabsTrigger>
          <TabsTrigger value="help" className="text-[9px] px-0.5"><HandHelping className="h-3.5 w-3.5" /></TabsTrigger>
          <TabsTrigger value="chat" className="text-[9px] px-0.5"><MessageCircle className="h-3.5 w-3.5" /></TabsTrigger>
        </TabsList>

        {/* Members */}
        <TabsContent value="members" className="space-y-2 mt-3">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{members.length} Uye</p>
          {members.sort((a, b) => b.rank - a.rank || b.contribution - a.contribution).map(member => {
            const isMe = member.user_id === player?.id
            return (
              <Card key={member.user_id} className={`border-border/30 ${isMe ? 'border-gold/20 bg-gold/5' : ''}`}>
                <CardContent className="p-2.5 flex items-center gap-2">
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${RANK_BG[member.rank]}`}>
                    <span className={RANK_COLORS[member.rank]}>{member.username.slice(0, 2).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-bold truncate">{member.username}</p>
                      {isMe && <span className="text-[8px] text-gold font-semibold">Sen</span>}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <RankBadge rank={member.rank} />
                      <span className="text-[9px] text-muted-foreground">Lv.{member.level}</span>
                      <span className="text-[9px] text-muted-foreground">{member.contribution.toLocaleString()} katki</span>
                    </div>
                  </div>
                  {myRank >= 4 && !isMe && member.rank < myRank && (
                    <div className="flex items-center gap-0.5">
                      {member.rank < myRank - 1 && (
                        <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => handleChangeRank(member.user_id, member.rank + 1)}>
                          <ChevronUp className="h-3 w-3" />
                        </Button>
                      )}
                      {member.rank > 1 && (
                        <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => handleChangeRank(member.user_id, member.rank - 1)}>
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  )}
                  {myRank >= 3 && !isMe && member.rank < myRank && (
                    <Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-red-400/60 hover:text-red-400" onClick={() => handleKick(member.user_id)}>
                      <UserMinus className="h-3 w-3" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
          {myRank < 5 && (
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
              onClick={handleLeave}
              disabled={loading}
            >
              <LogOut className="h-3.5 w-3.5 mr-1.5" /> Aileden Ayril
            </Button>
          )}
        </TabsContent>

        {/* Donate */}
        <TabsContent value="donate" className="space-y-3 mt-3">
          <div className="bg-gold/5 border border-gold/20 rounded-xl px-3 py-2">
            <p className="text-xs text-gold/80">Kaynak bagislayarak katki puani kazan. Gunluk 5 bagis hakkin var.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(DONATION_AMOUNTS).map(([resource, amount]) => {
              const playerVal = player ? (player as unknown as Record<string, number>)[resource] ?? 0 : 0
              const canDonate = playerVal >= amount
              return (
                <Card key={resource} className={`border-border/30 ${!canDonate ? 'opacity-50' : ''}`}>
                  <CardContent className="p-2.5 space-y-1.5">
                    <p className="text-[10px] font-bold">{RESOURCE_NAMES[resource]}</p>
                    <p className="text-[9px] text-muted-foreground">{amount.toLocaleString()} bagisla</p>
                    <div className="text-[9px] text-muted-foreground">
                      Mevcut: {playerVal.toLocaleString()}
                    </div>
                    <Button
                      size="sm"
                      className="w-full h-6 text-[10px] bg-gold/15 hover:bg-gold/25 border border-gold/30 text-gold"
                      disabled={loading || !canDonate}
                      onClick={() => handleDonate(resource)}
                    >
                      Bagisla
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* Tech */}
        <TabsContent value="tech" className="space-y-2 mt-3">
          <p className="text-xs text-muted-foreground">Bagislarla doldurulan aile teknolojilerini yukselt.</p>
          {tech.map(t => {
            const info = TECH_INFO[t.tech_key]
            if (!info) return null
            const Icon = info.icon
            const percent = t.required_progress > 0 ? Math.min((t.progress / t.required_progress) * 100, 100) : 0
            const canUpgrade = t.progress >= t.required_progress && t.level < 10
            const isMaxed = t.level >= 10

            return (
              <Card key={t.tech_key} className={`border-border/30 ${canUpgrade ? 'border-gold/30 bg-gold/5' : ''}`}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${isMaxed ? 'bg-gold/20' : canUpgrade ? 'bg-gold/10' : 'bg-secondary/50'}`}>
                        <Icon className={`h-4 w-4 ${isMaxed ? 'text-gold' : canUpgrade ? 'text-gold/80' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <p className="text-xs font-bold">
                          {info.name}
                          <span className={`ml-1.5 ${isMaxed ? 'text-gold' : 'text-muted-foreground'}`}>Lv.{t.level}/10</span>
                        </p>
                        <p className="text-[9px] text-muted-foreground">{info.desc}</p>
                      </div>
                    </div>
                    {isMaxed ? (
                      <Badge variant="outline" className="text-[9px] border-gold/40 text-gold">MAX</Badge>
                    ) : canUpgrade && myRank >= 4 ? (
                      <Button size="sm" className="h-6 text-[10px] gradient-gold text-primary-foreground" onClick={() => handleUpgradeTech(t.tech_key)} disabled={loading}>
                        Yukselt
                      </Button>
                    ) : canUpgrade ? (
                      <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                        <Lock className="h-2.5 w-2.5" /> Yetkili+
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[9px] text-muted-foreground">
                      <span>Ilerleme</span>
                      <span className={canUpgrade ? 'text-gold font-bold' : ''}>{t.progress}/{t.required_progress}</span>
                    </div>
                    <div className="h-1.5 bg-secondary/60 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${percent}%`,
                          background: canUpgrade
                            ? 'linear-gradient(90deg, oklch(0.78 0.15 75), oklch(0.85 0.18 85))'
                            : 'linear-gradient(90deg, oklch(0.5 0.1 230), oklch(0.6 0.12 220))',
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </TabsContent>

        {/* Help */}
        <TabsContent value="help" className="space-y-2 mt-3">
          <p className="text-xs text-muted-foreground">Aile uyelerine yardim ederek surelerini azaltin ve katki kazanin.</p>
          {helpRequests.length === 0 ? (
            <div className="bg-card/40 border border-dashed border-border/40 rounded-2xl p-8 text-center">
              <HandHelping className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Yardim istegi yok</p>
            </div>
          ) : (
            helpRequests.filter(r => r.helps_received < r.max_helps).map(req => {
              const requester = members.find(m => m.user_id === req.user_id)
              return (
                <Card key={req.id} className="border-border/30">
                  <CardContent className="p-2.5 flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-blue-950/30 border border-blue-900/30 flex items-center justify-center shrink-0">
                      <HandHelping className="h-3.5 w-3.5 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold">{requester?.username || 'Uye'}</p>
                      <p className="text-[9px] text-muted-foreground">{req.help_type} · {req.helps_received}/{req.max_helps} yardim</p>
                    </div>
                    {req.user_id !== player?.id && (
                      <Button size="sm" className="h-6 text-[10px] bg-blue-700/70 hover:bg-blue-600 text-white" onClick={() => handleGiveHelp(req.id)} disabled={loading}>
                        Yardim Et
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )
            })
          )}
        </TabsContent>

        {/* Chat */}
        <TabsContent value="chat" className="space-y-2 mt-3">
          <div className="h-52 overflow-y-auto space-y-1.5 bg-secondary/10 border border-border/20 rounded-xl p-2.5">
            {chatMessages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-xs text-muted-foreground/50">Henuz mesaj yok</p>
              </div>
            ) : (
              [...chatMessages].reverse().map(msg => (
                <div key={msg.id} className={`text-[10px] ${msg.message_type === 'system' ? 'text-gold/70 italic text-center py-0.5' : ''}`}>
                  {msg.message_type !== 'system' && (
                    <span className={`font-bold ${msg.username === player?.username ? 'text-gold' : 'text-foreground/80'}`}>
                      {msg.username}:{' '}
                    </span>
                  )}
                  <span className="text-muted-foreground">{msg.message}</span>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-1.5">
            <Input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendChat()}
              placeholder="Mesaj yaz..."
              className="h-8 text-xs flex-1"
            />
            <Button size="sm" className="h-8 text-xs px-3 gradient-gold text-primary-foreground" onClick={handleSendChat} disabled={!chatInput.trim()}>
              Gonder
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
