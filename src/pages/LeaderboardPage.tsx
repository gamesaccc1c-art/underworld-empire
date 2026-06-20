import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Trophy, Shield, User, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useGuestStore } from '@/stores/guestStore'
import { useGameStore } from '@/stores/gameStore'
import { Spinner } from '@/components/ui/spinner'
import type { LeaderboardPlayer, LeaderboardFamily } from '@/types/game'

const MOCK_PLAYERS: LeaderboardPlayer[] = [
  { id: '1', username: 'KaranlikPatron', level: 28, power: 145000, title: 'Sehir Efendisi', vip_level: 5, reputation: 9000, family_id: null, family_name: 'Karanlik Aile', family_tag: 'KRN', created_at: '' },
  { id: '2', username: 'DevirAlici',     level: 25, power: 120000, title: 'Yeraltı Devi',   vip_level: 4, reputation: 7500, family_id: null, family_name: 'Demir Yumruk',   family_tag: 'DMR', created_at: '' },
  { id: '3', username: 'GolgeKral',      level: 23, power: 98000,  title: 'Mafya Patronu',  vip_level: 3, reputation: 6200, family_id: null, family_name: null,              family_tag: null,  created_at: '' },
  { id: '4', username: 'DemirYumruk',    level: 21, power: 87500,  title: 'Cete Lideri',    vip_level: 3, reputation: 5100, family_id: null, family_name: null,              family_tag: null,  created_at: '' },
  { id: '5', username: 'Altin_Kont',     level: 20, power: 76000,  title: 'Para Efendisi',  vip_level: 2, reputation: 4200, family_id: null, family_name: null,              family_tag: null,  created_at: '' },
]

const MOCK_FAMILIES: LeaderboardFamily[] = [
  { id: '1', name: 'Karanlik Aile',      tag: 'KRN', power: 485000, level: 8, territory_count: 3, member_count: 24, created_at: '' },
  { id: '2', name: 'Demir Yumruk',       tag: 'DMR', power: 420000, level: 7, territory_count: 2, member_count: 20, created_at: '' },
  { id: '3', name: 'Gece Kuslari',       tag: 'GCK', power: 380000, level: 6, territory_count: 2, member_count: 18, created_at: '' },
  { id: '4', name: 'Altin Eller',        tag: 'ALE', power: 310000, level: 5, territory_count: 1, member_count: 15, created_at: '' },
  { id: '5', name: 'Sehrin Efendileri',  tag: 'SHR', power: 265000, level: 5, territory_count: 1, member_count: 12, created_at: '' },
]

const RANK_COLORS = ['text-gold', 'text-slate-300', 'text-amber-600', 'text-foreground', 'text-foreground']
const RANK_BG    = ['bg-amber-950/30 border-gold/20', 'bg-slate-900/30 border-slate-600/20', 'bg-amber-950/20 border-amber-800/20', '', '']

export function LeaderboardPage() {
  const isGuest = useGuestStore(s => s.isGuest)
  const guestPlayer = useGuestStore(s => s.player)
  const authPlayer = useGameStore(s => s.player)
  const player = isGuest ? guestPlayer : authPlayer

  const [players, setPlayers] = useState<LeaderboardPlayer[]>([])
  const [families, setFamilies] = useState<LeaderboardFamily[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const [{ data: pd }, { data: fd }] = await Promise.all([
        supabase.rpc('get_player_leaderboard', { p_limit: 50 }),
        supabase.rpc('get_family_leaderboard', { p_limit: 50 }),
      ])
      setPlayers((pd && pd.length > 0) ? pd as LeaderboardPlayer[] : MOCK_PLAYERS)
      setFamilies((fd && fd.length > 0) ? fd as LeaderboardFamily[] : MOCK_FAMILIES)
    } catch {
      setPlayers(MOCK_PLAYERS)
      setFamilies(MOCK_FAMILIES)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const allPlayers = [...players]
  if (player && !allPlayers.find(p => p.username === player.username)) {
    allPlayers.push({
      id: player.id, username: player.username, level: player.level,
      power: player.power, title: player.title, vip_level: player.vip_level,
      reputation: player.reputation, family_id: null, family_name: null, family_tag: null, created_at: '',
    })
    allPlayers.sort((a, b) => b.power - a.power)
  }

  const myRank = allPlayers.findIndex(p => p.username === player?.username) + 1

  return (
    <div className="p-3 space-y-4 pb-6">
      <div className="text-center">
        <h1 className="font-display text-xl font-black tracking-wider text-gold">LIDER TABLOSU</h1>
        <p className="text-xs text-muted-foreground">Sehrin en guclu patronlari</p>
      </div>

      {player && (
        <Card className="border-gold/20 bg-gradient-to-r from-amber-950/30 to-card">
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-gold/20 flex items-center justify-center">
                <User className="h-4 w-4 text-gold" />
              </div>
              <div>
                <p className="text-xs font-bold">{player.username} <span className="text-muted-foreground">(Sen)</span></p>
                <p className="text-[10px] text-muted-foreground">{player.title}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-bold text-gold">#{myRank || '?'}</p>
                <p className="text-[10px] text-muted-foreground">{player.power.toLocaleString()} Güç</p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground"
                onClick={() => load(true)}
                disabled={refreshing}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="players">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="players">Oyuncular</TabsTrigger>
          <TabsTrigger value="families">Aileler</TabsTrigger>
        </TabsList>

        <TabsContent value="players" className="space-y-1.5 mt-3">
          {loading ? <div className="flex justify-center py-4"><Spinner className="h-6 w-6" /></div> : allPlayers.slice(0, 20).map((p, i) => (
            <Card key={p.id || i} className={`border ${RANK_BG[i] || 'bg-card/50 border-border/30'}`}>
              <CardContent className="p-2.5 flex items-center gap-2.5">
                <div className={`text-sm font-black w-6 text-center shrink-0 ${RANK_COLORS[i] || 'text-muted-foreground'}`}>
                  {i < 3 ? <Trophy className="h-4 w-4 mx-auto" /> : `#${i + 1}`}
                </div>
                <div className="h-8 w-8 rounded-full bg-secondary/50 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={`text-xs font-semibold truncate ${p.username === player?.username ? 'text-gold' : ''}`}>{p.username}</p>
                    {p.vip_level > 0 && (
                      <Badge className="gradient-gold text-primary-foreground text-[8px] px-1 py-0 h-3.5">VIP{p.vip_level}</Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">{p.title} · Lv.{p.level}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-gold">{p.power >= 1000 ? `${(p.power / 1000).toFixed(0)}K` : p.power}</p>
                  <p className="text-[9px] text-muted-foreground">guc</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="families" className="space-y-1.5 mt-3">
          {families.map((family, i) => (
            <Card key={family.id} className={`border ${RANK_BG[i] || 'bg-card/50 border-border/30'}`}>
              <CardContent className="p-2.5 flex items-center gap-2.5">
                <div className={`text-sm font-black w-6 text-center shrink-0 ${RANK_COLORS[i] || 'text-muted-foreground'}`}>
                  {i < 3 ? <Trophy className="h-4 w-4 mx-auto" /> : `#${i + 1}`}
                </div>
                <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-amber-700 to-amber-900 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-black text-gold">{family.tag}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold truncate">{family.name}</p>
                    <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5">Lv.{family.level}</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    <Shield className="h-2.5 w-2.5 inline mr-0.5" />{family.territory_count} bolge · {family.member_count} uye
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-gold">{(family.power / 1000).toFixed(0)}K</p>
                  <p className="text-[9px] text-muted-foreground">guc</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}


