import { getScoreColor, getScoreLabel } from '../../lib/score'

interface ScoreGaugeProps {
  score: number
  size?: number
}

export function ScoreGauge({ score, size = 180 }: ScoreGaugeProps) {
  const r     = 65
  const cx    = 90
  const cy    = 95
  const circ  = 2 * Math.PI * r
  const track = circ * 0.75
  const fill  = track * (Math.min(100, Math.max(0, score)) / 100)
  const color = getScoreColor(score)
  const label = getScoreLabel(score)
  const w     = 180
  const h     = Math.round(size * 170 / 180)

  return (
    <svg
      viewBox="0 0 180 170"
      width={size}
      height={h}
      style={{ overflow: 'visible' }}
      aria-label={`Tagesscore: ${score} von 100 — ${label}`}
    >
      {/* Track arc */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={`${track} ${circ - track}`}
        transform={`rotate(-225, ${cx}, ${cy})`}
      />
      {/* Filled arc */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={color}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={`${fill} ${circ - fill}`}
        transform={`rotate(-225, ${cx}, ${cy})`}
        style={{
          filter: `drop-shadow(0 0 10px ${color}88)`,
          transition: 'stroke-dasharray 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      />
      {/* Score number */}
      <text
        x={cx} y={cy - 10}
        textAnchor="middle"
        fill="white"
        fontSize="40"
        fontWeight="900"
        fontFamily="-apple-system, system-ui, sans-serif"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {score}
      </text>
      {/* Label */}
      <text
        x={cx} y={cy + 16}
        textAnchor="middle"
        fill={color}
        fontSize="12"
        fontWeight="700"
        fontFamily="-apple-system, system-ui, sans-serif"
        letterSpacing="1.5"
      >
        {label}
      </text>
      {/* /100 */}
      <text
        x={cx} y={cy + 34}
        textAnchor="middle"
        fill="rgba(255,255,255,0.28)"
        fontSize="10"
        fontFamily="-apple-system, system-ui, sans-serif"
        letterSpacing="0.5"
      >
        / 100 PUNKTE
      </text>
      {/* Hidden width setter */}
      <rect x="0" y="0" width={w} height="1" fill="none" />
    </svg>
  )
}
