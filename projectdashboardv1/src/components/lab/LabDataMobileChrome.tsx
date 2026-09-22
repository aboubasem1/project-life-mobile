import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown, MoreHorizontal, Search, X } from 'lucide-react'
import {
  LAB_DATA_AREAS,
  LAB_DATA_GROUPS,
  labDataAreaById,
  type LabDataQuickAction,
  type LabDataSection,
} from '../../lib/labDataNav'

export function LabDataMobileChrome({
  section,
  contextLine,
  onSectionChange,
  onSearchToggle,
  searchOpen,
  onOpenSettings,
  onQuickAction,
  collapsed,
}: {
  section: LabDataSection
  contextLine: string
  onSectionChange: (section: LabDataSection) => void
  onSearchToggle: () => void
  searchOpen: boolean
  onOpenSettings: () => void
  onQuickAction?: (action: LabDataQuickAction) => void
  collapsed: boolean
}) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const area = labDataAreaById(section)
  const Icon = area.icon

  useEffect(() => {
    if (!sheetOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setSheetOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheetOpen])

  useEffect(() => {
    if (sheetOpen) return
    triggerRef.current?.focus()
  }, [sheetOpen])

  return (
    <div className={collapsed ? 'lab-data-mobile is-collapsed' : 'lab-data-mobile'}>
      <header className="lab-data-mobile__header">
        <div className="lab-data-mobile__titles">
          <p className="lab-data-mobile__eyebrow">Lab</p>
          <h1 className="lab-data-mobile__title">Daten</h1>
        </div>
        <div className="lab-data-mobile__actions">
          <button
            type="button"
            className={searchOpen ? 'icon-button is-active' : 'icon-button'}
            aria-label={searchOpen ? 'Suche schließen' : 'Suchen'}
            aria-pressed={searchOpen}
            onClick={onSearchToggle}
          >
            <Search size={18} />
          </button>
          <div className="lab-data-mobile__more">
            <button
              type="button"
              className="icon-button"
              aria-label="Weitere Aktionen"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(current => !current)}
            >
              <MoreHorizontal size={18} />
            </button>
            {menuOpen && (
              <div className="lab-data-mobile__menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    onOpenSettings()
                  }}
                >
                  Reiter anpassen
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="lab-data-taskbar">
        <button
          ref={triggerRef}
          type="button"
          className="lab-data-taskbar__current"
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          onClick={() => setSheetOpen(true)}
        >
          <span className="lab-data-taskbar__icon" aria-hidden="true">
            <Icon size={16} />
          </span>
          <span className="lab-data-taskbar__copy">
            <strong>{area.label}</strong>
            <small>{contextLine}</small>
          </span>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
        {area.quickAction && onQuickAction && (
          <button
            type="button"
            className="lab-data-taskbar__action"
            onClick={() => onQuickAction(area.quickAction!.id)}
          >
            {area.quickAction.label}
          </button>
        )}
      </div>

      {sheetOpen && (
        <LabDataAreaSheet
          section={section}
          contextBySection={{ [section]: contextLine }}
          onSelect={next => {
            onSectionChange(next)
            setSheetOpen(false)
          }}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  )
}

function LabDataAreaSheet({
  section,
  contextBySection,
  onSelect,
  onClose,
}: {
  section: LabDataSection
  contextBySection: Partial<Record<LabDataSection, string>>
  onSelect: (section: LabDataSection) => void
  onClose: () => void
}) {
  const titleId = useId()
  const sheetRef = useRef<HTMLDivElement | null>(null)
  const dragStartY = useRef<number | null>(null)
  const [dragY, setDragY] = useState(0)

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    sheetRef.current?.querySelector<HTMLElement>('button[aria-current="true"], button')?.focus()
    return () => previouslyFocused?.focus()
  }, [])

  return (
    <div
      className="lab-data-sheet-backdrop"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={sheetRef}
        className="lab-data-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={dragY > 0 ? { transform: `translateY(${dragY}px)` } : undefined}
        onTouchStart={event => {
          dragStartY.current = event.touches[0]?.clientY ?? null
        }}
        onTouchMove={event => {
          if (dragStartY.current == null) return
          const next = Math.max(0, (event.touches[0]?.clientY ?? 0) - dragStartY.current)
          setDragY(next)
        }}
        onTouchEnd={() => {
          if (dragY > 96) onClose()
          setDragY(0)
          dragStartY.current = null
        }}
      >
        <div className="lab-data-sheet__handle" aria-hidden="true" />
        <div className="lab-data-sheet__chrome">
          <h2 id={titleId}>Bereich wählen</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Schließen">
            <X size={18} />
          </button>
        </div>
        <div className="lab-data-sheet__body">
          {LAB_DATA_GROUPS.map(group => (
            <section key={group.id} className="lab-data-sheet__group">
              <h3>{group.label}</h3>
              <ul>
                {group.sectionIds.map(id => {
                  const area = LAB_DATA_AREAS.find(item => item.id === id)
                  if (!area) return null
                  const RowIcon = area.icon
                  const active = section === id
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        className={active ? 'lab-data-sheet__row is-active' : 'lab-data-sheet__row'}
                        aria-current={active ? 'true' : undefined}
                        onClick={() => onSelect(id)}
                      >
                        <span className="lab-data-sheet__row-icon" aria-hidden="true">
                          <RowIcon size={16} />
                        </span>
                        <span className="lab-data-sheet__row-copy">
                          <strong>{area.label}</strong>
                          <small>{contextBySection[id] || area.hint}</small>
                        </span>
                        {active && <Check size={16} aria-hidden="true" />}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
