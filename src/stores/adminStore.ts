import { create } from 'zustand'
import * as adminDb from '@/lib/supabase/adminDatabase'

interface AdminState {
  isAdmin: boolean | null
  checking: boolean
  checkAdmin: () => Promise<void>
}

export const useAdminStore = create<AdminState>((set) => ({
  isAdmin: null,
  checking: false,

  checkAdmin: async () => {
    set({ checking: true })
    const result = await adminDb.isAdmin()
    set({ isAdmin: result, checking: false })
  },
}))
