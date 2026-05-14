'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

const getRoomIdFromInput = (value: string) => {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return null
  }

  const routeMatch = trimmedValue.match(/\/room\/([^/?#]+)/i)

  if (routeMatch?.[1]) {
    return routeMatch[1]
  }

  if (/^https?:\/\//i.test(trimmedValue)) {
    try {
      const parsedUrl = new URL(trimmedValue)
      const pathnameMatch = parsedUrl.pathname.match(/\/room\/([^/?#]+)/i)
      return pathnameMatch?.[1] ?? null
    } catch {
      return null
    }
  }

  return trimmedValue.replace(/^\/+|\/+$/g, '')
}

export default function JoinRoomForm() {
  const router = useRouter()
  const [roomInput, setRoomInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const roomId = getRoomIdFromInput(roomInput)

    if (!roomId) {
      setError('Pegá un link válido o un ID de sala.')
      return
    }

    setError(null)
    router.push(`/room/${roomId}`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block text-sm font-medium text-slate-300" htmlFor="room-link">
        Unirse a una sala
      </label>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          id="room-link"
          type="text"
          value={roomInput}
          onChange={(event) => setRoomInput(event.target.value)}
          placeholder="Pegá un link o escribí el ID de la sala"
          className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-slate-200 placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900/60 px-5 py-3 text-sm font-medium text-slate-100 transition hover:border-slate-500 hover:bg-slate-900"
        >
          Unirse a una sala
        </button>
      </div>
      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
    </form>
  )
}
