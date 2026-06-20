import { useEffect, useRef } from 'react'
import { useGameStore } from '@/stores/gameStore'
import { useGuestStore } from '@/stores/guestStore'
import * as db from '@/lib/supabase/database'

const DARK_JOB_REGEN_MS = 30 * 60 * 1000
const RAID_REGEN_MS     = 60 * 60 * 1000
const SPY_REGEN_MS      = 45 * 60 * 1000

const POLL_INTERVAL_MS = 60_000

function safeGetItem(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

function safeSetItem(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* quota exceeded or private */ }
}

export function useEnergyRegen() {
  const session       = useGameStore(s => s.session)
  const authPlayer    = useGameStore(s => s.player)
  const setAuthPlayer = (patch: Partial<typeof authPlayer>) =>
    useGameStore.setState(s => s.player ? { player: { ...s.player!, ...patch } } : {})

  const isGuest    = useGuestStore(s => s.isGuest)
  const guestPlayer = useGuestStore(s => s.player)
  const updateGuest = useGuestStore(s => s.updatePlayer)

  const authTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const guestTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // auth regen
  useEffect(() => {
    if (!session || isGuest) return

    async function regenNow() {
      try {
        const res = await db.regenEnergy()
        if (res.ok && authPlayer) {
          const patch: Record<string, number> = {}
          if (res.dark_job_energy !== undefined) patch.dark_job_energy = res.dark_job_energy
          if (res.raid_energy     !== undefined) patch.raid_energy     = res.raid_energy
          if (res.spy_energy      !== undefined) patch.spy_energy      = res.spy_energy
          if (Object.keys(patch).length) setAuthPlayer(patch as Parameters<typeof setAuthPlayer>[0])
        }
      } catch {
        // network error — retry on next interval
      }
    }

    regenNow()
    authTimerRef.current = setInterval(regenNow, POLL_INTERVAL_MS)
    return () => { if (authTimerRef.current) clearInterval(authTimerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, isGuest])

  // guest regen
  useEffect(() => {
    if (!isGuest || !guestPlayer) return

    function regenGuest() {
      const player = useGuestStore.getState().player
      if (!player) return

      const now = Date.now()
      const lastDark = Number(safeGetItem('uw-energy-dark-last') || now)
      const lastRaid = Number(safeGetItem('uw-energy-raid-last') || now)
      const lastSpy  = Number(safeGetItem('uw-energy-spy-last')  || now)

      const darkGained = Math.floor((now - lastDark) / DARK_JOB_REGEN_MS)
      const raidGained = Math.floor((now - lastRaid) / RAID_REGEN_MS)
      const spyGained  = Math.floor((now - lastSpy)  / SPY_REGEN_MS)

      if (darkGained > 0 || raidGained > 0 || spyGained > 0) {
        const newDark = Math.min(player.dark_job_energy + darkGained, player.max_dark_job_energy)
        const newRaid = Math.min(player.raid_energy + raidGained, player.max_raid_energy)
        const newSpy  = Math.min(player.spy_energy  + spyGained,  player.max_spy_energy)

        if (darkGained > 0) safeSetItem('uw-energy-dark-last', String(now - ((now - lastDark) % DARK_JOB_REGEN_MS)))
        if (raidGained > 0) safeSetItem('uw-energy-raid-last', String(now - ((now - lastRaid) % RAID_REGEN_MS)))
        if (spyGained  > 0) safeSetItem('uw-energy-spy-last',  String(now - ((now - lastSpy)  % SPY_REGEN_MS)))

        updateGuest({ dark_job_energy: newDark, raid_energy: newRaid, spy_energy: newSpy })
      }
    }

    if (!safeGetItem('uw-energy-dark-last')) safeSetItem('uw-energy-dark-last', String(Date.now()))
    if (!safeGetItem('uw-energy-raid-last')) safeSetItem('uw-energy-raid-last', String(Date.now()))
    if (!safeGetItem('uw-energy-spy-last'))  safeSetItem('uw-energy-spy-last',  String(Date.now()))

    regenGuest()
    guestTimerRef.current = setInterval(regenGuest, POLL_INTERVAL_MS)
    return () => { if (guestTimerRef.current) clearInterval(guestTimerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGuest])
}
