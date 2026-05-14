'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState } from 'react'

type RouletteProposal = {
  id: string
  game_name: string
}

type RouletteWheelProps = {
  proposals: RouletteProposal[]
  winnerProposal: RouletteProposal | null
  onSpinComplete?: () => void
}

const Wheel = dynamic(
  () => import('react-custom-roulette').then((module) => module.Wheel),
  { ssr: false },
)

const SEGMENT_COLORS = ['#2563eb', '#06b6d4', '#3b82f6', '#0ea5e9']

export default function RouletteWheel({
  proposals,
  winnerProposal,
  onSpinComplete,
}: RouletteWheelProps) {
  const [mustSpin, setMustSpin] = useState(false)
  const [prizeNumber, setPrizeNumber] = useState(0)
  const lastSpunWinnerRef = useRef<string | null>(null)

  const data = useMemo(
    () =>
      proposals.map((proposal, index) => ({
        option:
          proposal.game_name.length > 20
            ? `${proposal.game_name.slice(0, 20).trimEnd()}…`
            : proposal.game_name,
        style: {
          backgroundColor: SEGMENT_COLORS[index % SEGMENT_COLORS.length],
          textColor: '#e5e7eb',
          fontSize: 13,
          fontWeight: 700,
        },
      })),
    [proposals],
  )

  const winnerIndex = winnerProposal
    ? proposals.findIndex((proposal) => proposal.id === winnerProposal.id)
    : -1

  useEffect(() => {
    if (!winnerProposal || winnerIndex === -1) {
      return
    }

    if (lastSpunWinnerRef.current === winnerProposal.id) {
      return
    }

    if (!mustSpin) {
      setPrizeNumber(winnerIndex)
      setMustSpin(true)
      lastSpunWinnerRef.current = winnerProposal.id
    }
  }, [mustSpin, winnerIndex, winnerProposal])

  if (proposals.length === 0) {
    return null
  }

  return (
    <div className="flex w-full items-center justify-center overflow-visible">
      <div
        className={`relative flex w-full max-w-[380px] items-center justify-center overflow-visible rounded-2xl border border-white/10 bg-[#0b1220] p-6 ring-1 ring-white/10 shadow-lg shadow-black/30 transition duration-300 ${
          mustSpin
            ? 'scale-[1.03] cursor-wait shadow-[0_0_40px_rgba(59,130,246,0.2)]'
            : 'scale-100 shadow-[0_0_40px_rgba(59,130,246,0.16)]'
        }`}
      >
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),_transparent_38%),radial-gradient(circle_at_bottom,_rgba(37,99,235,0.12),_transparent_30%)]" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-slate-950/90 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200 shadow-[0_0_24px_rgba(34,211,238,0.16)]">
          PlayPoll
        </div>
        <div className="relative z-0 flex min-h-[320px] w-full items-center justify-center overflow-visible">
          <Wheel
            mustStartSpinning={mustSpin}
            prizeNumber={prizeNumber}
            data={data}
            backgroundColors={SEGMENT_COLORS}
            textColors={['#e5e7eb']}
            outerBorderColor="#0f172a"
            outerBorderWidth={10}
            innerRadius={18}
            innerBorderColor="#1e293b"
            innerBorderWidth={6}
            radiusLineColor="rgba(255,255,255,0.12)"
            radiusLineWidth={2}
            fontFamily="Arial"
            fontSize={13}
            fontWeight={700}
            textDistance={62}
            spinDuration={0.9}
            pointerProps={{
              src: '/roulette-pointer.svg',
              style: {
                filter: 'drop-shadow(0 0 18px rgba(34, 211, 238, 0.4))',
                transform: 'translateY(-6px)',
              },
            }}
            onStopSpinning={() => {
              setMustSpin(false)
              onSpinComplete?.()
            }}
          />
        </div>
      </div>
    </div>
  )
}
