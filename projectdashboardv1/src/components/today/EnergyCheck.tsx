export type EnergyLevel = 'low' | 'okay' | 'high'

const OPTIONS: { value: EnergyLevel; label: string; icon: string }[] = [
  { value: 'low',  label: 'Niedrig', icon: '🪫' },
  { value: 'okay', label: 'Okay',    icon: '🔆' },
  { value: 'high', label: 'Gut',     icon: '⚡' },
]

interface Props {
  value: EnergyLevel | null
  onChange: (v: EnergyLevel) => void
}

export function EnergyCheck({ value, onChange }: Props) {
  return (
    <div className="card energy-check">
      <p className="energy-check-label">Wie ist deine Energie gerade?</p>
      <div className="energy-options">
        {OPTIONS.map(opt => (
          <button
            key={opt.value}
            className={`energy-option ${value === opt.value ? 'selected' : ''}`}
            onClick={() => onChange(opt.value)}
            aria-pressed={value === opt.value}
          >
            <span className="energy-option-icon" aria-hidden="true">{opt.icon}</span>
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
