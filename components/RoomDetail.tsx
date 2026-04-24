'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { GAME_OPTIONS } from '@/lib/games'
import { getSupabaseBrowserClient } from '@/lib/supabaseClient'

type Room = {
  id: string
  status: string
  mode: string
  host_id: string | null
}

type Player = {
  id: string
  room_id: string
  nickname: string
  avatar: string
  is_host: boolean
}

type Proposal = {
  id: string
  room_id: string
  player_id: string
  game_name: string
  normalized_name: string
}

type Vote = {
  id: string
  room_id: string
  player_id: string
  proposal_id: string
}

type RoomDetailProps = {
  roomId: string
}

const AVATARS = ['capybara', 'dog', 'cat', 'fox']

export default function RoomDetail({ roomId }: RoomDetailProps) {
  const [room, setRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nickname, setNickname] = useState('')
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0])
  const [hasJoined, setHasJoined] = useState(false)
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null)
  const [joinLoading, setJoinLoading] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [startGameLoading, setStartGameLoading] = useState(false)
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [proposalError, setProposalError] = useState<string | null>(null)
  const [proposalLoading, setProposalLoading] = useState(false)
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [votes, setVotes] = useState<Vote[]>([])
  const [voteError, setVoteError] = useState<string | null>(null)
  const [voteLoading, setVoteLoading] = useState(false)
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const isHost = currentPlayer?.id === room?.host_id

  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const supabase = getSupabaseBrowserClient()
        const { data, error: dbError } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', roomId)
          .single()

        if (dbError) {
          if (dbError.code === 'PGRST116') {
            setError('Sala no encontrada')
          } else {
            setError(dbError.message)
          }
          console.error('Database error:', dbError)
        } else if (data) {
          setRoom(data)
        }
      } catch (err) {
        setError('Error cargando la sala')
        console.error('Fetch error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchRoom()
  }, [roomId])

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    const currentRoomId = roomId

    if (!currentRoomId) {
      console.log('[Room] Skipping room subscription because roomId is not ready')
      return
    }

    console.log('Subscribing to room:', currentRoomId)

    const roomChannel = supabase
      .channel('room-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${currentRoomId}`,
        },
        (payload) => {
          console.log('ROOM UPDATE:', payload.new)
          setRoom(payload.new as Room)
        },
      )
      .subscribe((status) => {
        console.log(`[Room] Subscription status for room ${currentRoomId}:`, status)
      })

    return () => {
      console.log(`[Room] Cleaning up room subscription for ${currentRoomId}`)
      supabase.removeChannel(roomChannel)
    }
  }, [roomId])

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    const currentRoomId = roomId

    if (!currentRoomId || (room?.status !== 'proposing' && room?.status !== 'voting')) {
      return
    }

    let isActive = true

    const loadInitialProposals = async () => {
      try {
        console.log(`[Proposals] Loading initial proposals for room ${currentRoomId}`)
        const { data, error } = await supabase
          .from('proposals')
          .select('*')
          .eq('room_id', currentRoomId)
          .order('created_at', { ascending: true })

        if (error) {
          console.error('[Proposals] Error fetching proposals:', error)
          return
        }

        if (isActive && data) {
          console.log(
            `[Proposals] Initial fetch complete for room ${currentRoomId}. Found ${data.length} proposals`,
            data,
          )
          setProposals(data as Proposal[])
        }
      } catch (err) {
        console.error('[Proposals] Error fetching proposals:', err)
      }
    }

    loadInitialProposals()

    console.log(`[Proposals] Starting realtime subscription for room ${currentRoomId}`)

    const proposalChannel = supabase
      .channel('proposals-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'proposals',
          filter: `room_id=eq.${currentRoomId}`,
        },
        (payload) => {
          const newProposal = payload.new as Proposal
          console.log('NEW PROPOSAL EVENT:', newProposal)

          setProposals((prev) => {
            if (prev.some((proposal) => proposal.id === newProposal.id)) {
              return prev
            }

            return [...prev, newProposal]
          })
        },
      )
      .subscribe((status) => {
        console.log(`[Proposals] Subscription status for room ${currentRoomId}:`, status)
      })

    return () => {
      isActive = false
      supabase.removeChannel(proposalChannel)
    }
  }, [roomId, room?.status])

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    const currentRoomId = roomId

    if (!currentRoomId) {
      return
    }

    let isActive = true

    const loadInitialVotes = async () => {
      try {
        console.log(`[Votes] Loading initial votes for room ${currentRoomId}`)
        const { data, error } = await supabase
          .from('votes')
          .select('*')
          .eq('room_id', currentRoomId)

        if (error) {
          console.error('[Votes] Error fetching votes:', error)
          return
        }

        if (isActive && data) {
          console.log(
            `[Votes] Initial fetch complete for room ${currentRoomId}. Found ${data.length} votes`,
            data,
          )
          setVotes(data as Vote[])
        }
      } catch (err) {
        console.error('[Votes] Error fetching votes:', err)
      }
    }

    loadInitialVotes()

    console.log(`[Votes] Starting realtime subscription for room ${currentRoomId}`)

    const voteChannel = supabase
      .channel('votes-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'votes',
          filter: `room_id=eq.${currentRoomId}`,
        },
        (payload) => {
          const newVote = payload.new as Vote
          console.log('VOTE EVENT RECEIVED:', payload)
          console.log('RoomId:', roomId)
          console.log('Payload room_id:', payload.new.room_id)
          console.log('NEW VOTE EVENT:', newVote)

          setVotes((prev) => {
            if (prev.some((vote) => vote.id === newVote.id)) {
              return prev
            }

            return [...prev, newVote]
          })
        },
      )
      .subscribe((status) => {
        console.log(`[Votes] Subscription status for room ${currentRoomId}:`, status)
      })

    return () => {
      isActive = false
      supabase.removeChannel(voteChannel)
    }
  }, [roomId])

  useEffect(() => {
    if (room?.status !== 'voting' || !currentPlayer) {
      return
    }

    const currentUserVote = votes.find((vote) => vote.player_id === currentPlayer.id)
    setSelectedProposalId(currentUserVote?.proposal_id ?? null)
  }, [votes, currentPlayer, room?.status])

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    const currentRoomId = roomId

    if (!currentRoomId) {
      console.log('[Players] Skipping players effect because roomId is not ready')
      return
    }

    let isActive = true

    const fetchInitialPlayers = async () => {
      try {
        console.log(`[Players] Loading initial players for room ${currentRoomId}`)
        const { data, error } = await supabase
          .from('players')
          .select('*')
          .eq('room_id', currentRoomId)
          .order('created_at', { ascending: true })

        if (error) {
          console.error('[Players] Error fetching players:', error)
          return
        }

        if (isActive && data) {
          console.log(
            `[Players] Initial fetch complete for room ${currentRoomId}. Found ${data.length} players`,
            data,
          )
          setPlayers(data)
        }
      } catch (err) {
        console.error('[Players] Error fetching players:', err)
      }
    }

    fetchInitialPlayers()

    console.log(`[Players] Starting realtime subscription for room ${currentRoomId}`)
    console.log('Subscribing to room:', currentRoomId)

    const channel = supabase
      .channel('players-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${currentRoomId}`,
        },
        (payload) => {
          const newPlayer = payload.new as Player
          console.log('NEW PLAYER EVENT:', newPlayer)

          setPlayers((prev) => {
            if (prev.some((player) => player.id === newPlayer.id)) {
              return prev
            }

            return [...prev, newPlayer]
          })
        },
      )
      .subscribe((status) => {
        console.log(`[Players] Subscription status for room ${currentRoomId}:`, status)

        if (status === 'SUBSCRIBED') {
          console.log(`[Players] Successfully subscribed to room ${currentRoomId}`)
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`[Players] Channel error for room ${currentRoomId}`)
        } else if (status === 'TIMED_OUT') {
          console.error(`[Players] Subscription timed out for room ${currentRoomId}`)
        }
      })

    return () => {
      console.log(`[Players] Cleaning up subscription for room ${currentRoomId}`)
      isActive = false
      supabase.removeChannel(channel)
    }
  }, [roomId])

  useEffect(() => {
    if (!room?.host_id || currentPlayer) {
      return
    }

    const storedHostPlayerId =
      typeof window !== 'undefined'
        ? window.sessionStorage.getItem(`viciemos-host-player-id:${roomId}`)
        : null

    if (!storedHostPlayerId || storedHostPlayerId !== room.host_id) {
      return
    }

    const hostPlayer = players.find((player) => player.id === room.host_id)

    if (!hostPlayer) {
      return
    }

    console.log('[Host] Auto-assigning current player from session storage', hostPlayer.id)
    setCurrentPlayer(hostPlayer)
    setHasJoined(true)
    setNickname(hostPlayer.nickname)
    setSelectedAvatar(hostPlayer.avatar)
  }, [room?.host_id, players, currentPlayer, roomId])

  const handleJoinRoom = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!nickname.trim()) {
      setJoinError('Por favor ingresa un nombre')
      return
    }

    setJoinLoading(true)
    setJoinError(null)

    try {
      const supabase = getSupabaseBrowserClient()
      const { data, error: dbError } = await supabase
        .from('players')
        .insert([
          {
            room_id: roomId,
            nickname: nickname.trim(),
            avatar: selectedAvatar,
            is_host: false,
          },
        ])
        .select()
        .single()

      if (dbError) {
        setJoinError(dbError.message)
        console.error('Error joining room:', dbError)
      } else {
        const insertedPlayer = data as Player | null

        if (insertedPlayer) {
          console.log('JOINED PLAYER:', insertedPlayer)
          setCurrentPlayer(insertedPlayer)
          setPlayers((prev) => {
            if (prev.some((player) => player.id === insertedPlayer.id)) {
              return prev
            }

            return [...prev, insertedPlayer]
          })
        }

        setHasJoined(true)
      }
    } catch (err) {
      setJoinError('Error al unirse a la sala')
      console.error('Join error:', err)
    } finally {
      setJoinLoading(false)
    }
  }

  const handleStartGame = async () => {
    if (!roomId) {
      return
    }

    setStartGameLoading(true)

    try {
      const supabase = getSupabaseBrowserClient()
      const { error: dbError } = await supabase
        .from('rooms')
        .update({ status: 'proposing' })
        .eq('id', roomId)

      if (dbError) {
        console.error('[Room] Error starting game:', dbError)
      }
    } catch (err) {
      console.error('[Room] Start game error:', err)
    } finally {
      setStartGameLoading(false)
    }
  }

  const handleGoToVoting = async () => {
    if (!roomId) {
      return
    }

    setStartGameLoading(true)

    try {
      const supabase = getSupabaseBrowserClient()
      const { error: dbError } = await supabase
        .from('rooms')
        .update({ status: 'voting' })
        .eq('id', roomId)

      if (dbError) {
        console.error('[Room] Error moving to voting:', dbError)
      }
    } catch (err) {
      console.error('[Room] Move to voting error:', err)
    } finally {
      setStartGameLoading(false)
    }
  }

  const handleFinishVoting = async () => {
    if (!roomId) {
      return
    }

    setStartGameLoading(true)

    try {
      const supabase = getSupabaseBrowserClient()
      const { error: dbError } = await supabase
        .from('rooms')
        .update({ status: 'finished' })
        .eq('id', roomId)

      if (dbError) {
        console.error('[Room] Error finishing voting:', dbError)
      }
    } catch (err) {
      console.error('[Room] Finish voting error:', err)
    } finally {
      setStartGameLoading(false)
    }
  }

  const handleAddProposal = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!currentPlayer) {
      setProposalError('Primero debes unirte a la sala')
      return
    }

    const trimmedName = input.trim()
    if (!trimmedName) {
      setProposalError('Ingresa un nombre de juego')
      return
    }

    const playerProposalsCount = proposals.filter(
      (proposal) => proposal.player_id === currentPlayer.id,
    ).length

    if (playerProposalsCount >= 2) {
      setProposalError('Ya alcanzaste el maximo de 2 propuestas')
      return
    }

    setProposalLoading(true)
    setProposalError(null)

    try {
      const supabase = getSupabaseBrowserClient()
      const normalizedName = trimmedName.toLowerCase()

      const { data, error: dbError } = await supabase
        .from('proposals')
        .insert([
          {
            room_id: roomId,
            player_id: currentPlayer.id,
            game_name: trimmedName,
            normalized_name: normalizedName,
          },
        ])
        .select()
        .single()

      if (dbError) {
        setProposalError(dbError.message)
        console.error('[Proposals] Error adding proposal:', dbError)
        return
      }

      const insertedProposal = data as Proposal | null

      if (insertedProposal) {
        console.log('JOINED PROPOSAL:', insertedProposal)
        setProposals((prev) => {
          if (prev.some((proposal) => proposal.id === insertedProposal.id)) {
            return prev
          }

          return [...prev, insertedProposal]
        })
        setInput('')
        setSuggestions([])
      }
    } catch (err) {
      setProposalError('Error al agregar el juego')
      console.error('[Proposals] Proposal insert error:', err)
    } finally {
      setProposalLoading(false)
    }
  }

  const handleProposalInputChange = (value: string) => {
    setInput(value)

    const normalizedValue = value.trim().toLowerCase()

    if (!normalizedValue) {
      setSuggestions([])
      return
    }

    const nextSuggestions = GAME_OPTIONS.filter((game) =>
      game.toLowerCase().includes(normalizedValue),
    ).slice(0, 5)

    setSuggestions(nextSuggestions)
  }

  const handleSelectSuggestion = (selectedGame: string) => {
    setInput(selectedGame)
    setSuggestions([])
  }

  const handleVoteProposal = async (proposalId: string) => {
    if (!currentPlayer) {
      setVoteError('Primero debes unirte a la sala')
      return
    }

    if (votes.some((vote) => vote.player_id === currentPlayer.id)) {
      setVoteError('Ya votaste')
      const existingVote = votes.find((vote) => vote.player_id === currentPlayer.id)
      setSelectedProposalId(existingVote?.proposal_id ?? null)
      return
    }

    setVoteLoading(true)
    setVoteError(null)

    try {
      const supabase = getSupabaseBrowserClient()
      const { data, error: dbError } = await supabase
        .from('votes')
        .insert([
          {
            room_id: roomId,
            player_id: currentPlayer.id,
            proposal_id: proposalId,
          },
        ])
        .select()
        .single()

      if (dbError) {
        setVoteError(dbError.message)
        console.error('[Votes] Error adding vote:', dbError)
        return
      }

      const insertedVote = data as Vote | null

      if (insertedVote) {
        console.log('JOINED VOTE:', insertedVote)
        setSelectedProposalId(insertedVote.proposal_id)
        setVotes((prev) => {
          if (prev.some((vote) => vote.id === insertedVote.id)) {
            return prev
          }

          return [...prev, insertedVote]
        })
      }
    } catch (err) {
      setVoteError('Error al votar')
      console.error('[Votes] Vote insert error:', err)
    } finally {
      setVoteLoading(false)
    }
  }

  const getVoteCount = (proposalId: string) => {
    return votes.filter((vote) => vote.proposal_id === proposalId).length
  }

  const totalVotes = votes.length

  const voteCounts = votes.reduce<Record<string, number>>((acc, vote) => {
    acc[vote.proposal_id] = (acc[vote.proposal_id] ?? 0) + 1
    return acc
  }, {})

  const maxVotes = Object.values(voteCounts).length > 0 ? Math.max(...Object.values(voteCounts)) : 0
  const winners = proposals.filter((proposal) => voteCounts[proposal.id] === maxVotes && maxVotes > 0)

  useEffect(() => {
    console.log('Current player:', currentPlayer?.id)
    console.log('Room host:', room?.host_id)
    console.log('Is host:', isHost)
  }, [currentPlayer?.id, room?.host_id, isHost])

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-6 py-16 sm:px-10">
        <section className="w-full rounded-3xl border border-slate-800 bg-slate-950/70 p-8 shadow-glow">
          <p className="text-slate-400">Cargando sala...</p>
        </section>
      </main>
    )
  }

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-6 py-16 sm:px-10">
        <section className="w-full rounded-3xl border border-slate-800 bg-slate-950/70 p-8 shadow-glow">
          <p className="text-red-400">{error}</p>
        </section>
      </main>
    )
  }

  if (!room) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-6 py-16 sm:px-10">
        <section className="w-full rounded-3xl border border-slate-800 bg-slate-950/70 p-8 shadow-glow">
          <p className="text-slate-400">Sala no disponible</p>
        </section>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-6 py-16 sm:px-10">
      <section className="w-full rounded-3xl border border-slate-800 bg-slate-950/70 p-8 shadow-glow">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-slate-400">Sala</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">{room.id}</h1>
        <div className="mt-6 space-y-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
              Estado
            </p>
            <p className="mt-1 text-lg text-slate-200">{room.status}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Modo</p>
            <p className="mt-1 text-lg text-slate-200">{room.mode}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Rol</p>
            <p className="mt-1 text-lg text-slate-200">
              {isHost ? 'Eres el host' : 'Esperando al host...'}
            </p>
          </div>
        </div>

        {room.status === 'waiting' ? (
          <>
            {hasJoined ? (
              <div className="mt-8 rounded-2xl border border-emerald-800/50 bg-emerald-950/30 p-6">
                <p className="text-emerald-400">
                  Te has unido a la sala como: <span className="font-semibold">{nickname}</span>
                </p>
              </div>
            ) : (
              <form onSubmit={handleJoinRoom} className="mt-8 space-y-4">
                <div>
                  <label className="block text-sm font-medium uppercase tracking-[0.16em] text-slate-400">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Tu nombre"
                    className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2 text-slate-200 placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium uppercase tracking-[0.16em] text-slate-400">
                    Avatar
                  </label>
                  <div className="mt-2 flex gap-2">
                    {AVATARS.map((avatar) => (
                      <button
                        key={avatar}
                        type="button"
                        onClick={() => setSelectedAvatar(avatar)}
                        className={`rounded-lg border-2 px-4 py-2 transition ${
                          selectedAvatar === avatar
                            ? 'border-sky-500 bg-sky-500/20 text-sky-300'
                            : 'border-slate-700 bg-slate-900/50 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        {avatar}
                      </button>
                    ))}
                  </div>
                </div>

                {joinError && <p className="text-sm text-red-400">{joinError}</p>}

                <button
                  type="submit"
                  disabled={joinLoading}
                  className="w-full rounded-lg bg-sky-500 py-3 font-medium text-slate-950 transition hover:bg-sky-400 disabled:opacity-50"
                >
                  {joinLoading ? 'Entrando...' : 'Entrar a la sala'}
                </button>
              </form>
            )}

            <div className="mt-8 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-slate-400">
                  Jugadores ({players.length})
                </h2>
                {isHost ? (
                  <button
                    type="button"
                    onClick={handleStartGame}
                    disabled={startGameLoading}
                    className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
                  >
                    {startGameLoading ? 'Iniciando...' : 'Iniciar partida'}
                  </button>
                ) : null}
              </div>
              <div className="grid gap-2">
                {players.length === 0 ? (
                  <p className="text-slate-500">Esperando a mas jugadores...</p>
                ) : (
                  players.map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-3"
                    >
                      <span className="text-xl">🎭</span>
                      <div>
                        <p className="font-medium text-slate-200">{player.nickname}</p>
                        <p className="text-xs text-slate-500">{player.avatar}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        ) : room.status === 'proposing' ? (
          <div className="mt-8 space-y-6">
            <div className="rounded-2xl border border-sky-800/50 bg-sky-950/30 p-6">
              <p className="text-sky-300">Fase de propuestas iniciada</p>
            </div>

            {isHost ? (
              <button
                type="button"
                onClick={handleGoToVoting}
                disabled={startGameLoading}
                className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-violet-400 disabled:opacity-50"
              >
                {startGameLoading ? 'Cambiando...' : 'Ir a votación'}
              </button>
            ) : null}

            <form onSubmit={handleAddProposal} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <div>
                <label className="block text-sm font-medium uppercase tracking-[0.16em] text-slate-400">
                  Juego
                </label>
                <div className="relative mt-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => handleProposalInputChange(e.target.value)}
                    placeholder="Nombre del juego"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2 text-slate-200 placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                  />
                  {suggestions.length > 0 ? (
                    <div className="absolute left-0 right-0 top-full z-10 mt-2 overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
                      {suggestions.map((game) => (
                        <button
                          key={game}
                          type="button"
                          onClick={() => handleSelectSuggestion(game)}
                          className="block w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
                        >
                          {game}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              {proposalError && <p className="text-sm text-red-400">{proposalError}</p>}

              <button
                type="submit"
                disabled={proposalLoading}
                className="w-full rounded-lg bg-sky-500 py-3 font-medium text-slate-950 transition hover:bg-sky-400 disabled:opacity-50"
              >
                {proposalLoading ? 'Agregando...' : 'Agregar juego'}
              </button>
            </form>

            <div className="space-y-3">
              <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-slate-400">
                Propuestas ({proposals.length})
              </h2>
              <div className="grid gap-2">
                {proposals.length === 0 ? (
                  <p className="text-slate-500">Todavia no hay propuestas.</p>
                ) : (
                  proposals.map((proposal) => {
                    const proposer = players.find((player) => player.id === proposal.player_id)

                    return (
                      <div
                        key={proposal.id}
                        className="flex items-center justify-between gap-4 rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-3"
                      >
                        <div>
                          <p className="font-medium text-slate-200">{proposal.game_name}</p>
                          <p className="text-xs text-slate-500">
                            Propuesto por {proposer?.nickname ?? 'Desconocido'}
                          </p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        ) : room.status === 'voting' ? (
          <div className="mt-8 space-y-6">
            <div className="rounded-2xl border border-violet-800/50 bg-violet-950/30 p-6">
              <p className="text-violet-300">Fase de votación iniciada</p>
            </div>

            {isHost ? (
              <button
                type="button"
                onClick={handleFinishVoting}
                disabled={startGameLoading}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
              >
                {startGameLoading ? 'Finalizando...' : 'Finalizar votación'}
              </button>
            ) : null}

            {voteError && <p className="text-sm text-red-400">{voteError}</p>}

            <div className="space-y-3">
              <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-slate-400">
                Propuestas para votar
              </h2>
              <div className="grid gap-2">
                {proposals.length === 0 ? (
                  <p className="text-slate-500">Todavia no hay propuestas para votar.</p>
                ) : (
                  proposals.map((proposal) => {
                    const isSelected = selectedProposalId === proposal.id
                    const proposalVotes = getVoteCount(proposal.id)
                    const percentage =
                      totalVotes === 0 ? 0 : Math.round((proposalVotes / totalVotes) * 100)

                    return (
                      <button
                        key={proposal.id}
                        type="button"
                        onClick={() => handleVoteProposal(proposal.id)}
                        disabled={voteLoading || Boolean(selectedProposalId)}
                        className={`flex items-center justify-between gap-4 rounded-lg border px-4 py-3 text-left transition ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-950/30'
                            : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'
                        }`}
                      >
                        <div>
                          <p className="font-medium text-slate-200">
                            {proposal.game_name} ({proposalVotes} votos - {percentage}%)
                          </p>
                          <p className="text-xs text-slate-500">
                            Propuesto por{' '}
                            {players.find((player) => player.id === proposal.player_id)?.nickname ??
                              'Desconocido'}
                          </p>
                          <div className="mt-2 h-2 w-full rounded bg-gray-700">
                            <div
                              className="h-2 rounded bg-green-400"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                        {isSelected ? <span className="text-sm text-emerald-400">Tu voto</span> : null}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        ) : room.status === 'finished' ? (
          <div className="mt-8 space-y-6">
            <div className="rounded-2xl border border-emerald-800/50 bg-emerald-950/30 p-6">
              <p className="text-emerald-300">Resultado final</p>
            </div>

            {winners.length === 0 ? (
              <div className="rounded-2xl border border-slate-800/50 bg-slate-900/30 p-6">
                <p className="text-slate-300">Aún no hay votos.</p>
              </div>
            ) : winners.length === 1 ? (
              <div className="space-y-3 rounded-2xl border border-slate-800/50 bg-slate-900/30 p-6">
                <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-slate-400">
                  Ganador:
                </h2>
                {(() => {
                  const winner = winners[0]
                  const proposer = players.find((player) => player.id === winner.player_id)

                  return (
                    <>
                      <p className="text-xl font-semibold text-white">{winner.game_name}</p>
                      <p className="text-slate-300">
                        Propuesto por: {proposer?.nickname ?? 'Desconocido'}
                      </p>
                      <p className="text-slate-300">Votos: {voteCounts[winner.id] ?? 0}</p>
                    </>
                  )
                })()}
              </div>
            ) : (
              <div className="space-y-3 rounded-2xl border border-slate-800/50 bg-slate-900/30 p-6">
                <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-slate-400">
                  Empate entre:
                </h2>
                <div className="grid gap-2">
                  {winners.map((winner) => (
                    <div
                      key={winner.id}
                      className="rounded-lg border border-slate-700 bg-slate-950/40 px-4 py-3 text-slate-200"
                    >
                      <p className="font-medium">{winner.game_name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-slate-800/50 bg-slate-900/30 p-6">
            <p className="text-slate-300">Estado de la sala: {room.status}</p>
          </div>
        )}
      </section>
    </main>
  )
}
