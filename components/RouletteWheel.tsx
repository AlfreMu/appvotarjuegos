'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

export type RouletteOption = {
  id: string
  label: string
}

type Props = {
  options: RouletteOption[]
  winnerIndex: number
  shouldSpin: boolean
  onFinish: () => void
}

const SEGMENT_COLORS = ['#22d3ee', '#10b981', '#f59e0b', '#f43f5e', '#38bdf8', '#6366f1']
const SVG_SIZE = 220
const CENTER = SVG_SIZE / 2
const RADIUS = 98
const INNER_RADIUS = 29
const SPIN_DURATION_MS = 4500

const polarToCartesian = (cx: number, cy: number, radius: number, angleDegrees: number) => {
  const angleRadians = (angleDegrees * Math.PI) / 180

  return {
    x: cx + radius * Math.cos(angleRadians),
    y: cy + radius * Math.sin(angleRadians),
  }
}

const describeSlicePath = (
  startAngle: number,
  endAngle: number,
  outerRadius: number,
  innerRadius: number,
) => {
  const startOuter = polarToCartesian(CENTER, CENTER, outerRadius, startAngle)
  const endOuter = polarToCartesian(CENTER, CENTER, outerRadius, endAngle)
  const endInner = polarToCartesian(CENTER, CENTER, innerRadius, endAngle)
  const startInner = polarToCartesian(CENTER, CENTER, innerRadius, startAngle)
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0

  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${endOuter.x} ${endOuter.y}`,
    `L ${endInner.x} ${endInner.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${startInner.x} ${startInner.y}`,
    'Z',
  ].join(' ')
}

const truncateLabel = (label: string) => {
  if (label.length <= 16) {
    return label
  }

  return `${label.slice(0, 16).trimEnd()}...`
}

export default function RouletteWheel({ options, winnerIndex, shouldSpin, onFinish }: Props) {
  const [rotation, setRotation] = useState(0)
  const [isSpinning, setIsSpinning] = useState(false)
  const lastSpinKeyRef = useRef<string | null>(null)
  const finishTimerRef = useRef<number | null>(null)

  const segmentAngle = options.length > 0 ? 360 / options.length : 0

  const slices = useMemo(() => {
    if (options.length === 0) {
      return []
    }

    return options.map((option, index) => {
      const startAngle = -90 + index * segmentAngle
      const endAngle = startAngle + segmentAngle
      const middleAngle = startAngle + segmentAngle / 2
      const labelRadius = 68
      const labelPosition = polarToCartesian(CENTER, CENTER, labelRadius, middleAngle)
      const shouldFlipText = middleAngle > 90 && middleAngle < 270
      const textRotation = shouldFlipText ? middleAngle + 180 : middleAngle

      return {
        id: option.id,
        path: describeSlicePath(startAngle, endAngle, RADIUS, INNER_RADIUS),
        label: truncateLabel(option.label),
        color: SEGMENT_COLORS[index % SEGMENT_COLORS.length],
        textX: labelPosition.x,
        textY: labelPosition.y,
        textRotation,
      }
    })
  }, [options, segmentAngle])

  const separators = useMemo(() => {
    if (options.length === 0) {
      return []
    }

    return options.map((option, index) => {
      const angle = -90 + index * segmentAngle
      const start = polarToCartesian(CENTER, CENTER, INNER_RADIUS + 3, angle)
      const end = polarToCartesian(CENTER, CENTER, RADIUS - 3, angle)

      return {
        id: option.id,
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
      }
    })
  }, [options, segmentAngle])

  useEffect(() => {
    return () => {
      if (finishTimerRef.current !== null) {
        window.clearTimeout(finishTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!shouldSpin || options.length === 0 || winnerIndex < 0 || winnerIndex >= options.length) {
      return
    }

    const spinKey = `${options.map((option) => option.id).join(':')}:${winnerIndex}`

    if (lastSpinKeyRef.current === spinKey) {
      return
    }

    if (finishTimerRef.current !== null) {
      window.clearTimeout(finishTimerRef.current)
    }

    const desiredNormalizedRotation =
      (360 - winnerIndex * segmentAngle - segmentAngle / 2 + 360) % 360
    const currentNormalizedRotation = ((rotation % 360) + 360) % 360
    const deltaToTarget =
      (desiredNormalizedRotation - currentNormalizedRotation + 360) % 360
    const finalRotation = rotation + 360 * 5 + deltaToTarget

    setIsSpinning(true)
    setRotation(finalRotation)
    lastSpinKeyRef.current = spinKey

    finishTimerRef.current = window.setTimeout(() => {
      setIsSpinning(false)
      onFinish()
    }, SPIN_DURATION_MS)
  }, [onFinish, options, rotation, segmentAngle, shouldSpin, winnerIndex])

  if (options.length === 0) {
    return null
  }

  return (
    <div className="flex w-full items-center justify-center overflow-visible px-2">
      <div className="relative flex w-full max-w-[340px] items-center justify-center rounded-[30px] border border-cyan-200/10 bg-[linear-gradient(145deg,rgba(15,23,42,0.96),rgba(3,7,18,0.98))] p-4 shadow-[0_24px_70px_rgba(2,6,23,0.62)] ring-1 ring-white/10 sm:max-w-[430px] sm:p-7">
        <div className="pointer-events-none absolute inset-0 rounded-[30px] bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.18),transparent_34%),radial-gradient(circle_at_50%_100%,rgba(16,185,129,0.11),transparent_38%)]" />
        <div className="pointer-events-none absolute inset-3 rounded-[24px] border border-white/5" />
        <div className="pointer-events-none absolute left-1/2 top-2 z-30 -translate-x-1/2 drop-shadow-[0_0_18px_rgba(34,211,238,0.55)] sm:top-3">
          <div className="h-0 w-0 border-l-[15px] border-r-[15px] border-t-[28px] border-l-transparent border-r-transparent border-t-cyan-200 sm:border-l-[18px] sm:border-r-[18px] sm:border-t-[34px]" />
          <div className="mx-auto -mt-[27px] h-2 w-2 rounded-full bg-white/85 sm:-mt-[32px]" />
        </div>

        <div
          className={`relative z-10 aspect-square w-full max-w-[300px] overflow-visible transition duration-300 sm:max-w-[360px] ${
            isSpinning
              ? 'scale-[1.03] cursor-wait'
              : 'scale-100'
          }`}
        >
          <div
            className="absolute inset-0 rounded-full shadow-[0_0_40px_rgba(59,130,246,0.24)]"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: isSpinning
                ? 'transform 4.5s cubic-bezier(0.22, 1, 0.36, 1)'
                : 'none',
            }}
          >
            <svg
              viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
              className="h-full w-full overflow-visible drop-shadow-[0_0_28px_rgba(14,165,233,0.18)]"
              aria-label="Ruleta de desempate"
              role="img"
            >
              <defs>
                <radialGradient id="wheelBase" cx="50%" cy="50%" r="64%">
                  <stop offset="0%" stopColor="#334155" />
                  <stop offset="58%" stopColor="#111827" />
                  <stop offset="100%" stopColor="#020617" />
                </radialGradient>
                <radialGradient id="centerCap" cx="42%" cy="35%" r="70%">
                  <stop offset="0%" stopColor="#e0f2fe" />
                  <stop offset="45%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#0f172a" />
                </radialGradient>
                <linearGradient id="wheelSheen" x1="20%" x2="80%" y1="0%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.28" />
                  <stop offset="42%" stopColor="#ffffff" stopOpacity="0.04" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </linearGradient>
              </defs>

              <circle cx={CENTER} cy={CENTER} r={RADIUS + 9} fill="#020617" />
              <circle cx={CENTER} cy={CENTER} r={RADIUS + 6} fill="url(#wheelBase)" />
              <circle
                cx={CENTER}
                cy={CENTER}
                r={RADIUS + 3}
                fill="none"
                stroke="rgba(226,232,240,0.26)"
                strokeWidth="3"
              />

              {slices.map((slice) => (
                <g key={slice.id}>
                  <path
                    d={slice.path}
                    fill={slice.color}
                    stroke="rgba(8,17,31,0.92)"
                    strokeWidth="1.4"
                  />
                  <text
                    x={slice.textX}
                    y={slice.textY}
                    fill="#e5e7eb"
                    fontFamily="Arial, sans-serif"
                    fontSize="7.4"
                    fontWeight="700"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${slice.textRotation} ${slice.textX} ${slice.textY})`}
                  >
                    {slice.label}
                  </text>
                </g>
              ))}

              {separators.map((separator) => (
                <line
                  key={separator.id}
                  x1={separator.x1}
                  y1={separator.y1}
                  x2={separator.x2}
                  y2={separator.y2}
                  stroke="rgba(255,255,255,0.24)"
                  strokeLinecap="round"
                  strokeWidth="0.8"
                />
              ))}

              <circle
                cx={CENTER}
                cy={CENTER}
                r={RADIUS - 5}
                fill="url(#wheelSheen)"
                opacity="0.52"
              />
              <circle
                cx={CENTER}
                cy={CENTER}
                r={INNER_RADIUS + 4}
                fill="#020617"
                opacity="0.72"
              />
              <circle
                cx={CENTER}
                cy={CENTER}
                r={INNER_RADIUS + 1}
                fill="url(#centerCap)"
                stroke="rgba(224,242,254,0.42)"
                strokeWidth="2"
              />
              <circle
                cx={CENTER}
                cy={CENTER}
                r={4}
                fill="#dbeafe"
                stroke="rgba(34,211,238,0.45)"
                strokeWidth="1.2"
              />
            </svg>
          </div>

          <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex h-[74px] w-[74px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-cyan-100/25 bg-[radial-gradient(circle_at_35%_20%,rgba(14,165,233,0.34),rgba(2,6,23,0.96)_62%)] text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-50 shadow-[inset_0_1px_10px_rgba(255,255,255,0.08),0_0_30px_rgba(34,211,238,0.22)] sm:h-[90px] sm:w-[90px] sm:text-[11px]">
            PlayPoll
          </div>
        </div>
      </div>
    </div>
  )
}
