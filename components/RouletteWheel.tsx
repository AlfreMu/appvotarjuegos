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

const SEGMENT_COLORS = ['#06b6d4', '#2563eb', '#0ea5e9', '#0891b2']
const SVG_SIZE = 200
const CENTER = SVG_SIZE / 2
const RADIUS = 90
const INNER_RADIUS = 26
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
      const labelRadius = 61
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
    <div className="flex w-full items-center justify-center overflow-visible">
      <div className="relative flex w-[280px] items-center justify-center rounded-[28px] border border-white/10 bg-[#0b1220] p-5 ring-1 ring-white/10 shadow-[0_18px_60px_rgba(2,6,23,0.55)] sm:w-[380px] sm:p-7">
        <div className="pointer-events-none absolute inset-0 rounded-[28px] bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),_transparent_34%),radial-gradient(circle_at_bottom,_rgba(37,99,235,0.16),_transparent_40%)]" />
        <div className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2 drop-shadow-[0_0_16px_rgba(34,211,238,0.45)]">
          <div className="h-0 w-0 border-l-[16px] border-r-[16px] border-t-[30px] border-l-transparent border-r-transparent border-t-cyan-300 sm:border-l-[18px] sm:border-r-[18px] sm:border-t-[34px]" />
        </div>

        <div
          className={`relative z-10 h-[280px] w-[280px] overflow-visible transition duration-300 sm:h-[380px] sm:w-[380px] ${
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
                <radialGradient id="wheelBase" cx="50%" cy="50%" r="60%">
                  <stop offset="0%" stopColor="#14213c" />
                  <stop offset="100%" stopColor="#08111f" />
                </radialGradient>
              </defs>

              <circle cx={CENTER} cy={CENTER} r={RADIUS + 3} fill="url(#wheelBase)" />
              <circle
                cx={CENTER}
                cy={CENTER}
                r={RADIUS + 1}
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="2"
              />

              {slices.map((slice) => (
                <g key={slice.id}>
                  <path
                    d={slice.path}
                    fill={slice.color}
                    stroke="rgba(8,17,31,0.92)"
                    strokeWidth="1.8"
                  />
                  <text
                    x={slice.textX}
                    y={slice.textY}
                    fill="#e5e7eb"
                    fontFamily="Arial, sans-serif"
                    fontSize="8"
                    fontWeight="700"
                    letterSpacing="0.2"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${slice.textRotation} ${slice.textX} ${slice.textY})`}
                  >
                    {slice.label}
                  </text>
                </g>
              ))}

              <circle
                cx={CENTER}
                cy={CENTER}
                r={INNER_RADIUS + 1}
                fill="#08111f"
                stroke="rgba(125,211,252,0.35)"
                strokeWidth="2.4"
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

          <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-cyan-300/20 bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.92),_rgba(2,6,23,0.96))] text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-100 shadow-[0_0_28px_rgba(34,211,238,0.18)] sm:h-[86px] sm:w-[86px] sm:text-[11px]">
            PlayPoll
          </div>
        </div>
      </div>
    </div>
  )
}
