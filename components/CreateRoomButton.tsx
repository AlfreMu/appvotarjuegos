'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabaseClient'

type CreateRoomButtonProps = {
  className?: string
}

export default function CreateRoomButton({ className = '' }: CreateRoomButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleCreateRoom = async () => {
    setLoading(true)
    setError(null)
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
        setError('No se pudo crear la sala. Intentalo de nuevo.')
        return
      }

      const room = roomRes.data

      if (!room) {
        console.error('Room created but no data was returned')
        setError('La sala se creó sin devolver datos válidos.')
        return
      }
      router.push(`/room/${room.id}`)
    } catch (err) {
      console.error('Failed to create room:', err)
      setError('Ocurrió un error inesperado al crear la sala.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleCreateRoom}
        disabled={loading}
        className={`inline-flex items-center justify-center rounded-xl bg-emerald-500 px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50 ${className}`}
      >
        {loading ? 'Creando...' : 'Crear sala'}
      </button>
      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
    </div>
  )
}
