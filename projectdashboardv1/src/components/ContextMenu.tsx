import { useEffect, useRef } from 'react'

export type ContextMenuItem = {
  id: string
  label: string
  danger?: boolean
  disabled?: boolean
}

type ContextMenuProps = {
  x: number
  y: number
  items: ContextMenuItem[]
  onSelect: (id: string) => void
  onClose: () => void
  title?: string
}

export function ContextMenu({ x, y, items, onSelect, onClose, title }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const onPointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      if (ref.current && target && !ref.current.contains(target)) onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('touchstart', onPointer)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('touchstart', onPointer)
    }
  }, [onClose])

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    const maxX = window.innerWidth - rect.width - 8
    const maxY = window.innerHeight - rect.height - 8
    node.style.left = `${Math.max(8, Math.min(x, maxX))}px`
    node.style.top = `${Math.max(8, Math.min(y, maxY))}px`
  }, [x, y])

  return (
    <div className="context-menu-backdrop" role="presentation">
      <div
        ref={ref}
        className="context-menu"
        role="menu"
        aria-label={title ?? 'Aktionen'}
        style={{ left: x, top: y }}
      >
        {title && <div className="context-menu__title">{title}</div>}
        {items.map(item => (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            className={item.danger ? 'context-menu__item is-danger' : 'context-menu__item'}
            disabled={item.disabled}
            onClick={() => {
              if (item.disabled) return
              onSelect(item.id)
              onClose()
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}
