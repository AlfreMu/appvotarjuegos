'use client'

import Image from 'next/image'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { getAvatarSrc } from '@/lib/avatarMap'
import CreateRoomButton from '@/components/CreateRoomButton'
import { GAME_OPTIONS } from '@/lib/games'
import RouletteWheel from '@/components/RouletteWheel'
import { getSupabaseBrowserClient } from '@/lib/supabaseClient'

type Room = {
  id: string
  status: string
  mode: string
  host_id: string | null
  winner_proposal_id: string | null
  proposal_duration: number
  voting_duration: number
  started_at: string | null
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

const AVATARS = ['capybara', 'panda', 'penguin', 'cat'] as const
type AvatarOption = (typeof AVATARS)[number]
const TIME_ZONE_SUFFIX_PATTERN = /(Z|[+-]\d{2}:?\d{2})$/i

const pickRandomWinner = <T,>(items: T[]) => {
  if (items.length === 0) {
    return null
  }

  const randomIndex = Math.floor(Math.random() * items.length)
  return items[randomIndex] ?? null
}

const createBeepAudio = () => {
  const sampleRate = 44100
  const durationSeconds = 0.12
  const frameCount = Math.floor(sampleRate * durationSeconds)
  const buffer = new ArrayBuffer(44 + frameCount * 2)
  const view = new DataView(buffer)

  const writeString = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + frameCount * 2, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, frameCount * 2, true)

  for (let index = 0; index < frameCount; index += 1) {
    const time = index / sampleRate
    const envelope = 1 - index / frameCount
    const sample = Math.sin(2 * Math.PI * 880 * time) * envelope
    view.setInt16(44 + index * 2, sample * 0x4fff, true)
  }

  const blob = new Blob([buffer], { type: 'audio/wav' })
  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)
  audio.preload = 'auto'

  return { audio, url }
}

const getStartedAtTimestamp = (startedAt: string | null) => {
  if (!startedAt) {
    return null
  }

  const isoStartedAt = startedAt.includes('T') ? startedAt : startedAt.replace(' ', 'T')
  const normalizedStartedAt = TIME_ZONE_SUFFIX_PATTERN.test(isoStartedAt)
    ? isoStartedAt
    : `${isoStartedAt}Z`
  const timestamp = Date.parse(normalizedStartedAt)

  return Number.isNaN(timestamp) ? null : timestamp
}

export default function RoomDetail({ roomId }: RoomDetailProps) {
  const [room, setRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nickname, setNickname] = useState('')
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarOption>(AVATARS[0])
  const [hasJoined, setHasJoined] = useState(false)
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null)
  const [joinLoading, setJoinLoading] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [copyLinkFeedback, setCopyLinkFeedback] = useState<string | null>(null)
  const [startGameLoading, setStartGameLoading] = useState(false)
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [proposalError, setProposalError] = useState<string | null>(null)
  const [proposalLoading, setProposalLoading] = useState(false)
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [votes, setVotes] = useState<Vote[]>([])
  const [voteError, setVoteError] = useState<string | null>(null)
  const [voteLoading, setVoteLoading] = useState(false)
  const [showRoulette, setShowRoulette] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [spinFinished, setSpinFinished] = useState(false)
  const [proposalDuration, setProposalDuration] = useState(90)
  const [votingDuration, setVotingDuration] = useState(30)
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const isHost = currentPlayer?.id === room?.host_id
  const roomStatus = room?.status
  const roomStartedAt = room?.started_at
  const roomProposalDuration = room?.proposal_duration
  const roomVotingDuration = room?.voting_duration
  const transitionLockRef = useRef(false)
  const tieResolutionLockRef = useRef(false)
  const beepAudioRef = useRef<HTMLAudioElement | null>(null)
  const beepAudioUrlRef = useRef<string | null>(null)
  const lastBeepSecondRef = useRef<number | null>(null)
  const winAudioRef = useRef<HTMLAudioElement | null>(null)
  const hasPlayedWinSoundRef = useRef<string | null>(null)

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
          setProposalDuration(data.proposal_duration ?? 90)
          setVotingDuration(data.voting_duration ?? 30)
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
      return
    }

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
          const nextRoom = payload.new as Room
          setRoom(nextRoom)
          setProposalDuration(nextRoom.proposal_duration ?? 90)
          setVotingDuration(nextRoom.voting_duration ?? 30)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(roomChannel)
    }
  }, [roomId])

  useEffect(() => {
    const { audio, url } = createBeepAudio()

    beepAudioRef.current = audio
    beepAudioUrlRef.current = url

    return () => {
      beepAudioRef.current?.pause()
      beepAudioRef.current = null

      if (beepAudioUrlRef.current) {
        URL.revokeObjectURL(beepAudioUrlRef.current)
        beepAudioUrlRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    // Place the winner sound at /public/sounds/win.mp3.
    const audio = new Audio('/sounds/win.mp3')
    audio.preload = 'auto'
    audio.volume = 0.9
    winAudioRef.current = audio

    return () => {
      winAudioRef.current?.pause()
      winAudioRef.current = null
    }
  }, [])

  useEffect(() => {
    if (roomStatus !== 'proposing' && roomStatus !== 'voting') {
      setRemainingSeconds(null)
      return
    }

    const startedAtTimestamp = getStartedAtTimestamp(roomStartedAt ?? null)

    if (startedAtTimestamp === null) {
      setRemainingSeconds(null)
      return
    }

    const duration =
      roomStatus === 'proposing' ? roomProposalDuration ?? 90 : roomVotingDuration ?? 30

    const updateRemainingSeconds = () => {
      const elapsedSeconds = Math.max(
        0,
        Math.floor((Date.now() - startedAtTimestamp) / 1000),
      )

      const remaining = Math.max(0, duration - elapsedSeconds)
      setRemainingSeconds(remaining)
    }

    updateRemainingSeconds()

    const interval = window.setInterval(updateRemainingSeconds, 1000)

    return () => {
      window.clearInterval(interval)
    }
  }, [roomStatus, roomStartedAt, roomProposalDuration, roomVotingDuration])

  useEffect(() => {
    if (
      (roomStatus !== 'proposing' && roomStatus !== 'voting') ||
      remainingSeconds === null ||
      remainingSeconds > 10 ||
      remainingSeconds <= 0
    ) {
      lastBeepSecondRef.current = null
      beepAudioRef.current?.pause()

      if (beepAudioRef.current) {
        beepAudioRef.current.currentTime = 0
      }

      return
    }

    if (lastBeepSecondRef.current === remainingSeconds) {
      return
    }

    lastBeepSecondRef.current = remainingSeconds

    if (!beepAudioRef.current) {
      return
    }

    beepAudioRef.current.currentTime = 0
    void beepAudioRef.current.play().catch(() => {
      // Browsers can block autoplay before the first user interaction.
    })
  }, [remainingSeconds, roomStatus])

  useEffect(() => {
    if (!room || (room.status !== 'proposing' && room.status !== 'voting')) {
      transitionLockRef.current = false
      return
    }

    if (remainingSeconds === null || remainingSeconds > 0) {
      transitionLockRef.current = false
      return
    }

    if (transitionLockRef.current) {
      return
    }

    transitionLockRef.current = true

    const supabase = getSupabaseBrowserClient()

    const runTransition = async () => {
      try {
        if (room.status === 'proposing') {
          const { data, error } = await supabase
            .from('rooms')
            .update({ status: 'voting', started_at: new Date().toISOString() })
            .eq('id', room.id)
            .eq('status', 'proposing')
            .select()

          if (error) {
            console.error('[Room] Auto transition to voting error:', error)
            transitionLockRef.current = false
          } else if (data?.[0]) {
            setRoom(data[0] as Room)
          }
        } else if (room.status === 'voting') {
          const { data, error } = await supabase
            .from('rooms')
            .update({ status: 'finished' })
            .eq('id', room.id)
            .eq('status', 'voting')
            .select()

          if (error) {
            console.error('[Room] Auto transition to finished error:', error)
            transitionLockRef.current = false
          } else if (data?.[0]) {
            setRoom(data[0] as Room)
          }
        }
      } catch (err) {
        console.error('[Room] Auto transition error:', err)
        transitionLockRef.current = false
      }
    }

    void runTransition()
  }, [remainingSeconds, room])

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    const currentRoomId = roomId

    if (!currentRoomId || (room?.status !== 'proposing' && room?.status !== 'voting')) {
      return
    }

    let isActive = true

    const loadInitialProposals = async () => {
      try {
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
          setProposals(data as Proposal[])
        }
      } catch (err) {
        console.error('[Proposals] Error fetching proposals:', err)
      }
    }

    loadInitialProposals()

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

          setProposals((prev) => {
            if (prev.some((proposal) => proposal.id === newProposal.id)) {
              return prev
            }

            return [...prev, newProposal]
          })
        },
      )
      .subscribe()

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
        const { data, error } = await supabase
          .from('votes')
          .select('*')
          .eq('room_id', currentRoomId)

        if (error) {
          console.error('[Votes] Error fetching votes:', error)
          return
        }

        if (isActive && data) {
          setVotes(data as Vote[])
        }
      } catch (err) {
        console.error('[Votes] Error fetching votes:', err)
      }
    }

    loadInitialVotes()

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

          setVotes((prev) => {
            if (prev.some((vote) => vote.id === newVote.id)) {
              return prev
            }

            return [...prev, newVote]
          })
        },
      )
      .subscribe()

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
      return
    }

    let isActive = true

    const fetchInitialPlayers = async () => {
      try {
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
          setPlayers(data)
        }
      } catch (err) {
        console.error('[Players] Error fetching players:', err)
      }
    }

    fetchInitialPlayers()

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

          setPlayers((prev) => {
            if (prev.some((player) => player.id === newPlayer.id)) {
              return prev
            }

            return [...prev, newPlayer]
          })
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error(`[Players] Channel error for room ${currentRoomId}`)
        } else if (status === 'TIMED_OUT') {
          console.error(`[Players] Subscription timed out for room ${currentRoomId}`)
        }
      })

    return () => {
      isActive = false
      supabase.removeChannel(channel)
    }
  }, [roomId])

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
            is_host: !room?.host_id,
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
          setCurrentPlayer(insertedPlayer)
          if (!room?.host_id) {
            const { error: hostUpdateError } = await supabase
              .from('rooms')
              .update({ host_id: insertedPlayer.id })
              .eq('id', roomId)

            if (hostUpdateError) {
              console.error('Error assigning host:', hostUpdateError)
            }

            setRoom((prev) => (prev ? { ...prev, host_id: insertedPlayer.id } : prev))
          }
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
      const { data, error: dbError } = await supabase
        .from('rooms')
        .update({
          status: 'proposing',
          started_at: new Date().toISOString(),
          proposal_duration: proposalDuration,
          voting_duration: votingDuration,
        })
        .eq('id', roomId)
        .select()

      if (dbError) {
        console.error('[Room] Error starting game:', dbError)
      } else if (data?.[0]) {
        setRoom(data[0] as Room)
      }
    } catch (err) {
      console.error('[Room] Start game error:', err)
    } finally {
      setStartGameLoading(false)
    }
  }

  const handleCopyInviteLink = async () => {
    if (typeof window === 'undefined') {
      return
    }

    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopyLinkFeedback('Link copiado')
      window.setTimeout(() => setCopyLinkFeedback(null), 2000)
    } catch (error) {
      console.error('Error copying invite link:', error)
      setCopyLinkFeedback('No se pudo copiar el link')
      window.setTimeout(() => setCopyLinkFeedback(null), 2000)
    }
  }

  const handleGoToVoting = async () => {
    if (!roomId) {
      return
    }

    setStartGameLoading(true)

    try {
      const supabase = getSupabaseBrowserClient()
      const { data, error: dbError } = await supabase
        .from('rooms')
        .update({
          status: 'voting',
          started_at: new Date().toISOString(),
        })
        .eq('id', roomId)
        .select()

      if (dbError) {
        console.error('[Room] Error moving to voting:', dbError)
      } else if (data?.[0]) {
        setRoom(data[0] as Room)
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
      const { data, error: dbError } = await supabase
        .from('rooms')
        .update({ status: 'finished' })
        .eq('id', roomId)
        .select()

      if (dbError) {
        console.error('[Room] Error finishing voting:', dbError)
      } else if (data?.[0]) {
        setRoom(data[0] as Room)
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
  const finalWinner = room?.winner_proposal_id
    ? proposals.find((proposal) => proposal.id === room.winner_proposal_id) ?? null
    : null
  const finalWinnerPlayer = finalWinner
    ? players.find((player) => player.id === finalWinner.player_id) ?? null
    : null
  const winnerProposal = finalWinner
  const directWinner = winners.length === 1 ? winners[0] : null
  const directWinnerPlayer = directWinner
    ? players.find((player) => player.id === directWinner.player_id) ?? null
    : null
  const displayedWinner = finalWinner ?? directWinner
  const displayedWinnerPlayer = finalWinnerPlayer ?? directWinnerPlayer
  const hasPendingTie = room?.status === 'finished' && winners.length > 1 && !finalWinner
  const shouldRenderRoulette = room?.status === 'finished' && winners.length > 1
  const visibleFinalWinner =
    room?.status === 'finished' &&
    !hasPendingTie &&
    (shouldRenderRoulette ? showResult : Boolean(displayedWinner))
      ? displayedWinner
      : null
  const displayedWinnerVotes = displayedWinner ? voteCounts[displayedWinner.id] ?? 0 : 0
  const winnerVoteLabel = displayedWinnerVotes === 1 ? '1 voto' : `${displayedWinnerVotes} votos`
  const winnerMetaText = displayedWinnerPlayer
    ? `Propuesto por ${displayedWinnerPlayer.nickname} \u00b7 ${winnerVoteLabel}`
    : `Propuesto por Desconocido \u00b7 ${winnerVoteLabel}`
  const winnerTitle = '\u{1F3C6} Resultado final'
  const activePhaseDuration =
    room?.status === 'proposing'
      ? room.proposal_duration
      : room?.status === 'voting'
        ? room.voting_duration
        : null
  const timerPercentage =
    remainingSeconds !== null && activePhaseDuration
      ? Math.max(0, Math.min(100, (remainingSeconds / activePhaseDuration) * 100))
      : null
  const timerBarClassName =
    timerPercentage === null
      ? 'bg-slate-500'
      : timerPercentage > 50
        ? 'bg-emerald-400'
        : timerPercentage >= 20
          ? 'bg-amber-400'
          : 'bg-red-400'

  useEffect(() => {
    if (
      !room ||
      !isHost ||
      room.status !== 'finished' ||
      winners.length <= 1 ||
      room.winner_proposal_id
    ) {
      tieResolutionLockRef.current = false
      return
    }

    if (tieResolutionLockRef.current) {
      return
    }

    const selectedWinner = pickRandomWinner(winners)

    if (!selectedWinner) {
      return
    }

    tieResolutionLockRef.current = true

    const persistTieWinner = async () => {
      try {
        const supabase = getSupabaseBrowserClient()
        const { data, error } = await supabase
          .from('rooms')
          .update({ winner_proposal_id: selectedWinner.id })
          .eq('id', room.id)
          .is('winner_proposal_id', null)
          .select()

        if (error) {
          console.error('[Room] Error resolving tie winner:', error)
          tieResolutionLockRef.current = false
        } else if (data?.[0]) {
          setRoom(data[0] as Room)
        }
      } catch (err) {
        console.error('[Room] Tie resolution error:', err)
        tieResolutionLockRef.current = false
      }
    }

    void persistTieWinner()
  }, [isHost, room, winners])

  useEffect(() => {
    if (room?.status !== 'finished') {
      setShowRoulette(false)
      setShowResult(false)
      setSpinFinished(false)
      return
    }

    if (shouldRenderRoulette) {
      setShowRoulette(true)
      setShowResult(false)
      setSpinFinished(false)
      return
    }

    setShowRoulette(false)
    setShowResult(Boolean(displayedWinner))
    setSpinFinished(false)
  }, [displayedWinner, room?.status, roomId, shouldRenderRoulette])

  useEffect(() => {
    if (!shouldRenderRoulette || !spinFinished) {
      return
    }

    const hideRouletteTimer = window.setTimeout(() => {
      setShowRoulette(false)
    }, 500)

    const revealResultTimer = window.setTimeout(() => {
      setShowResult(true)
    }, 700)

    return () => {
      window.clearTimeout(hideRouletteTimer)
      window.clearTimeout(revealResultTimer)
    }
  }, [spinFinished, shouldRenderRoulette])

  useEffect(() => {
    if (room?.status !== 'finished' || !visibleFinalWinner || hasPendingTie) {
      return
    }

    const celebrationKey = `${roomId}:${visibleFinalWinner.id}`

    if (hasPlayedWinSoundRef.current === celebrationKey) {
      return
    }

    if (!winAudioRef.current) {
      return
    }

    hasPlayedWinSoundRef.current = celebrationKey
    winAudioRef.current.currentTime = 0
    void winAudioRef.current.play().catch(() => {
      // Browsers may still block autoplay before the first user interaction.
    })
  }, [hasPendingTie, room?.status, roomId, visibleFinalWinner])

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
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-white">PlayPoll</h1>
          <p className="text-sm text-slate-400">Elegí. Votá. Jugá.</p>
        </div>

        {room.status === 'waiting' ? (
          <>
            <div className="mt-6 flex justify-center">
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleCopyInviteLink}
                  className="rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:bg-slate-900/80"
                >
                  Copiar link de la sala
                </button>
                {copyLinkFeedback ? (
                  <p className="text-center text-sm text-slate-400">{copyLinkFeedback}</p>
                ) : null}
              </div>
            </div>

            <div className="hidden mt-6 space-y-1 text-sm text-slate-400">
              <p>1. Elegí un avatar</p>
              <p>2. Escribí tu nombre</p>
              <p>3. Esperá a que el host inicie la partida</p>
            </div>

            {hasJoined ? (
              <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-emerald-800/50 bg-emerald-950/30 p-6 text-center">
                <p className="text-emerald-400">
                  Te has unido a la sala como: <span className="font-semibold">{nickname}</span>
                </p>
              </div>
            ) : (
              <form onSubmit={handleJoinRoom} className="mx-auto mt-8 max-w-xl space-y-6">
                <div className="space-y-3 text-center">
                  <p className="text-base font-medium text-white">1. Escribí tu nombre.</p>
                  <label className="block text-center text-sm font-medium uppercase tracking-[0.16em] text-slate-400">
                    Nombre:
                  </label>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Tu nombre"
                    className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-3 text-slate-200 placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-3 text-center">
                  <p className="text-base font-medium text-white">2. Elegí tu animal favorito!</p>
                  <div className="mt-2 flex flex-wrap justify-center gap-5">
                    {AVATARS.map((avatar) => (
                      <button
                        key={avatar}
                        type="button"
                        onClick={() => setSelectedAvatar(avatar)}
                        className={`flex h-32 w-32 items-center justify-center rounded-2xl transition-all duration-200 hover:scale-105 ${
                          selectedAvatar === avatar
                            ? 'border-2 border-cyan-400 bg-cyan-500/10 shadow-md'
                            : 'border border-slate-700 bg-slate-900/50 hover:border-slate-500 hover:bg-slate-900/80'
                        }`}
                        aria-pressed={selectedAvatar === avatar}
                        aria-label={`Seleccionar avatar ${avatar}`}
                      >
                        <Image
                          src={getAvatarSrc(avatar)}
                          alt={avatar}
                          width={80}
                          height={80}
                          className="h-20 w-20 object-contain"
                        />
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

            <div
              className={`mx-auto mt-8 max-w-xl rounded-2xl border border-slate-800 bg-slate-900/40 p-5 ${
                isHost ? '' : 'hidden'
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-slate-400">
                  Tiempos de juego
                </h2>
                <span className="text-xs text-slate-500">Editable por host</span>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-300">
                  <span className="block text-xs uppercase tracking-[0.16em] text-slate-400">
                    Propuestas
                  </span>
                  <input
                    type="number"
                    min={10}
                    value={proposalDuration}
                    onChange={(e) => setProposalDuration(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2 text-slate-200 focus:border-sky-500 focus:outline-none"
                  />
                </label>

                <label className="space-y-2 text-sm text-slate-300">
                  <span className="block text-xs uppercase tracking-[0.16em] text-slate-400">
                    Votación
                  </span>
                  {isHost ? (
                    <input
                      type="number"
                      min={10}
                      value={votingDuration}
                      onChange={(e) => setVotingDuration(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2 text-slate-200 focus:border-sky-500 focus:outline-none"
                    />
                  ) : (
                    <p className="rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2 text-slate-200">
                      Votación: {votingDuration}s
                    </p>
                  )}
                </label>
              </div>
            </div>

            {!isHost ? (
              <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-slate-800 bg-slate-900/40 p-5 text-center">
                <p className="text-sm text-slate-400">🕒 Esperando a que el host inicie la partida</p>
              </div>
            ) : null}

            <div className="mx-auto mt-8 max-w-xl space-y-4">
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
                    (() => {
                      const playerIsHost = player.id === room.host_id
                      const playerIsCurrentUser = player.id === currentPlayer?.id

                      return (
                    <div
                      key={player.id}
                      className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-3"
                    >
                      <Image
                        src={getAvatarSrc(player.avatar)}
                        alt={player.avatar}
                        width={56}
                        height={56}
                        className="h-14 w-14 rounded-full object-cover ring-1 ring-slate-700"
                      />
                      <div className="flex min-w-0 flex-1 flex-col justify-center">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-slate-200">
                            {player.nickname}
                            {playerIsCurrentUser ? ' (Tú)' : ''}
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] ${
                              playerIsHost
                                ? 'bg-violet-500 text-white'
                                : 'bg-slate-800/40 text-slate-400'
                            }`}
                          >
                            {playerIsHost ? 'HOST' : 'Invitado'}
                          </span>
                        </div>
                      </div>
                    </div>
                      )
                    })()
                  ))
                )}
              </div>
            </div>
          </>
        ) : room.status === 'proposing' ? (
          <div className="mt-8 space-y-6">
            <div className="rounded-2xl border border-sky-800/50 bg-sky-950/30 p-6">
              <p className="text-sky-300">Fase de propuestas iniciada</p>
              {remainingSeconds !== null ? (
                <div className="mt-3 space-y-2">
                  <p className="text-sm text-slate-300">Tiempo restante: {remainingSeconds}s</p>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-[width] duration-700 ease-linear ${timerBarClassName}`}
                      style={{ width: `${timerPercentage ?? 0}%` }}
                    />
                  </div>
                </div>
              ) : null}
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
                  <p className="text-slate-500">Todavía no hay propuestas.</p>
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
              {remainingSeconds !== null ? (
                <div className="mt-3 space-y-2">
                  <p className="text-sm text-slate-300">Tiempo restante: {remainingSeconds}s</p>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-[width] duration-700 ease-linear ${timerBarClassName}`}
                      style={{ width: `${timerPercentage ?? 0}%` }}
                    />
                  </div>
                </div>
              ) : null}
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
                  <p className="text-slate-500">Todavía no hay propuestas para votar.</p>
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
            <div className="hidden rounded-2xl border border-emerald-800/50 bg-emerald-950/30 p-6">
              <p className="text-emerald-300">Resultado final</p>
            </div>

            {shouldRenderRoulette && !showResult ? (
              <div
                className={`rounded-2xl border border-slate-800/50 bg-slate-900/30 p-6 transition-opacity duration-300 ${
                  showRoulette ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <RouletteWheel
                  proposals={winners}
                  winnerProposal={winnerProposal}
                  onSpinComplete={() => setSpinFinished(true)}
                />
              </div>
            ) : null}

            {finalWinner && visibleFinalWinner ? (
              <div className="winner-screen-enter space-y-6 overflow-hidden rounded-[2rem] border border-cyan-500/15 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_42%),linear-gradient(180deg,rgba(10,18,35,0.92),rgba(7,11,26,0.98))] p-8 text-center opacity-100 scale-100 shadow-glow transition-all duration-500 sm:p-10">
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold tracking-[0.2em] text-cyan-300/90">
                    {winnerTitle}
                  </h2>
                  <p className="text-sm text-slate-400">{'\u{1F3AF} Desempate por ruleta'}</p>
                </div>
                <Image
                  src={getAvatarSrc(finalWinnerPlayer?.avatar)}
                  alt={finalWinnerPlayer?.nickname ?? 'Jugador ganador'}
                  width={128}
                  height={128}
                  className="winner-avatar-celebrate mx-auto h-32 w-32 rounded-full object-cover ring-4 ring-cyan-400/50 shadow-[0_0_40px_rgba(34,211,238,0.18)] sm:h-36 sm:w-36"
                />
                <div className="space-y-3">
                  <p className="winner-title-reveal text-4xl font-bold tracking-tight text-white sm:text-5xl">
                    {finalWinner.game_name}
                  </p>
                  <p className="mx-auto max-w-2xl text-sm text-slate-300 sm:text-base">
                    {winnerMetaText}
                  </p>
                </div>

                <div className="flex justify-center pt-2">
                  <CreateRoomButton className="min-w-[220px] px-6 py-3.5 text-base" />
                </div>
              </div>
            ) : winners.length === 0 ? (
              <div className="rounded-2xl border border-slate-800/50 bg-slate-900/30 p-6">
                <p className="text-slate-300">Aún no hay votos.</p>
              </div>
            ) : winners.length === 1 ? (
              <div className="winner-screen-enter space-y-6 overflow-hidden rounded-[2rem] border border-cyan-500/15 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_42%),linear-gradient(180deg,rgba(10,18,35,0.92),rgba(7,11,26,0.98))] p-8 text-center opacity-100 scale-100 shadow-glow transition-all duration-500 sm:p-10">
                <h2 className="text-sm font-semibold tracking-[0.2em] text-cyan-300/90">
                  {winnerTitle}
                </h2>
                {(() => {
                  const winner = winners[0]
                  const proposer = players.find((player) => player.id === winner.player_id)

                  return (
                    <>
                      <Image
                        src={getAvatarSrc(proposer?.avatar)}
                        alt={proposer?.nickname ?? 'Jugador ganador'}
                        width={128}
                        height={128}
                        className="winner-avatar-celebrate mx-auto h-32 w-32 rounded-full object-cover ring-4 ring-cyan-400/50 shadow-[0_0_40px_rgba(34,211,238,0.18)] sm:h-36 sm:w-36"
                      />
                      <div className="space-y-3">
                        <p className="winner-title-reveal text-4xl font-bold tracking-tight text-white sm:text-5xl">
                          {winner.game_name}
                        </p>
                        <p className="mx-auto max-w-2xl text-sm text-slate-300 sm:text-base">
                          {winnerMetaText}
                        </p>
                      </div>

                      <div className="flex justify-center pt-2">
                        <CreateRoomButton className="min-w-[220px] px-6 py-3.5 text-base" />
                      </div>
                    </>
                  )
                })()}
              </div>
            ) : (
              <div className="space-y-4 rounded-2xl border border-slate-800/50 bg-slate-900/30 p-6">
                <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-slate-400">
                  Empate detectado
                </h2>
                <p className="text-sm text-slate-300">
                  {finalWinner
                    ? 'La ruleta está resolviendo el desempate con el ganador ya definido en la sala.'
                    : 'Esperando a que se defina el ganador del desempate para iniciar la ruleta.'}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-slate-800/50 bg-slate-900/30 p-6">
            <p className="text-slate-300">La sala se está actualizando.</p>
          </div>
        )}
      </section>
    </main>
  )
}
