'use client'

import { useEffect } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabaseClient'

export default function SupabaseTest() {
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const supabase = getSupabaseBrowserClient()
        const { data, error } = await supabase.from('rooms').select('*')

        if (error) {
          console.error('Supabase error:', error)
        } else {
          console.log('Rooms data:', data)
        }
      } catch (err) {
        console.error('Fetch error:', err)
      }
    }

    fetchRooms()
  }, [])

  return <div className="mt-8 p-4 text-slate-400">Testing Supabase...</div>
}
