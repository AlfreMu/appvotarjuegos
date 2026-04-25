'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabaseClient'

export default function CreateRoomButton() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleCreateRoom = async () => {
    setLoading(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const roomRes = await supabase
        .from('rooms')
        .insert([
          {
            status: 'waiting',
            mode: 'voting',
            proposal_duration: 90,
            voting_duration: 30,
          },
        ])
        .select()
        .single()

      if (roomRes.error) {
        console.error('Error creating room:', roomRes.error)
        return
      }

      const room = roomRes.data

      if (!room) {
        console.error('Room created but no data was returned')
        return
      }
      router.push(`/room/${room.id}`)
    } catch (err) {
      console.error('Failed to create room:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleCreateRoom}
      disabled={loading}
      className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
    >
      {loading ? 'Creando...' : 'Crear sala'}
    </button>
  )
}
