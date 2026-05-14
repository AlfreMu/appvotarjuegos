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
      proposals.map((proposal) => ({
        option: proposal.game_name,
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
    <div className="flex w-full justify-center items-center">
      <Wheel
        mustStartSpinning={mustSpin}
        prizeNumber={prizeNumber}
        data={data}
        backgroundColors={['#06b6d4', '#3b82f6', '#8b5cf6', '#22c55e']}
        textColors={['#ffffff']}
        onStopSpinning={() => {
          setMustSpin(false)
          onSpinComplete?.()
        }}
      />
    </div>
  )
}
