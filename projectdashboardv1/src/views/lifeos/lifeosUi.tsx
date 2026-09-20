import type { FormEvent, ReactNode } from 'react'
import {
  LIFE_AREAS,
  areaLabel,
  parseLifeArea,
  type AreaFilter,
  type AreaSource,
  type LifeAreaKey,
} from '../../lib/lifeos'

export function LifeOsPage({
  eyebrow,
  title,
  action,
  children,
}: {
  eyebrow: string
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="view-stack lifeos-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

export function LifeOsEmpty({
  title,
  text,
  action,
}: {
  title: string
  text: string
  action?: ReactNode
}) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon" />
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  )
}

export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="text-field">
      <span>{label}</span>
      {children}
    </label>
  )
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <div className="lifeos-chip-row">{children}</div>
}

export function preventEmptySubmit(event: FormEvent, value: string): boolean {
  event.preventDefault()
  return Boolean(value.trim())
}

export function LifeAreaSelect({
  value,
  inherited,
  source,
  onChange,
  compact = false,
}: {
  value?: LifeAreaKey | null
  inherited?: LifeAreaKey | null
  source?: AreaSource
  onChange: (next: LifeAreaKey | undefined) => void
  compact?: boolean
}) {
  const hint = !value && inherited
    ? `Geerbt: ${areaLabel(inherited)}${source && source !== 'unclassified' ? '' : ''}`
    : !value
      ? 'Unclassified'
      : undefined

  return (
    <label className={compact ? 'life-area-select life-area-select--compact' : 'text-field life-area-select'}>
      {!compact && <span>Area</span>}
      <select
        aria-label="Life Area"
        value={value ?? ''}
        onChange={event => onChange(parseLifeArea(event.target.value))}
      >
        <option value="">{inherited ? `Geerbt · ${areaLabel(inherited)}` : 'Unclassified'}</option>
        {LIFE_AREAS.map(area => (
          <option key={area.key} value={area.key}>{area.name}</option>
        ))}
      </select>
      {!compact && hint && <small className="field-hint">{hint}</small>}
    </label>
  )
}

export function LifeAreaFilter({
  value,
  onChange,
}: {
  value: AreaFilter
  onChange: (next: AreaFilter) => void
}) {
  const options: Array<{ id: AreaFilter; label: string }> = [
    { id: 'all', label: 'All' },
    ...LIFE_AREAS.map(area => ({ id: area.key as AreaFilter, label: area.name })),
    { id: 'unclassified', label: 'Unclassified' },
  ]
  return (
    <div className="life-area-filter" role="group" aria-label="Nach Life Area filtern">
      {options.map(option => (
        <button
          key={option.id}
          type="button"
          className={value === option.id ? 'life-area-chip is-active' : 'life-area-chip'}
          data-area={option.id}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function LifeAreaMark({
  area,
  inherited = false,
}: {
  area?: LifeAreaKey | null
  inherited?: boolean
}) {
  return (
    <span className="life-area-mark" data-area={area ?? 'unclassified'}>
      <span className="life-area-dot" aria-hidden="true" />
      {areaLabel(area)}{inherited ? ' · geerbt' : ''}
    </span>
  )
}
