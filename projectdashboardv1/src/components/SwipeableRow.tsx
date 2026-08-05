import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'

type SwipeableRowProps = {
  children: ReactNode
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onLongPress?: (point: { x: number; y: number }) => void
  leftLabel?: string
  rightLabel?: string
  disabled?: boolean
}

const SWIPE_THRESHOLD = 72
const LONG_PRESS_MS = 480

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest('input, textarea, select, button, a, label, [contenteditable="true"]'))
}

export function SwipeableRow({
  children,
  onSwipeLeft,
  onSwipeRight,
  onLongPress,
  leftLabel = 'Erledigt',
  rightLabel = 'Verschieben',
  disabled = false,
}: SwipeableRowProps) {
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const startX = useRef(0)
  const startY = useRef(0)
  const offsetRef = useRef(0)
  const axis = useRef<'undecided' | 'x' | 'y'>('undecided')
  const longPressTimer = useRef<number | null>(null)
  const longPressFired = useRef(false)
  const pointerId = useRef<number | null>(null)
  const ignoreGestures = useRef(false)

  const clearLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const resetGesture = () => {
    clearLongPress()
    setDragging(false)
    offsetRef.current = 0
    setOffset(0)
    pointerId.current = null
    axis.current = 'undecided'
    ignoreGestures.current = false
  }

  useEffect(() => () => clearLongPress(), [])

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || event.button > 0) return
    if (isInteractiveTarget(event.target)) {
      ignoreGestures.current = true
      return
    }

    ignoreGestures.current = false
    pointerId.current = event.pointerId
    startX.current = event.clientX
    startY.current = event.clientY
    axis.current = 'undecided'
    longPressFired.current = false
    offsetRef.current = 0
    setOffset(0)
    setDragging(true)

    try {
      rootRef.current?.setPointerCapture(event.pointerId)
    } catch { /* ignore */ }

    if (onLongPress) {
      const point = { x: event.clientX, y: event.clientY }
      longPressTimer.current = window.setTimeout(() => {
        longPressFired.current = true
        setDragging(false)
        offsetRef.current = 0
        setOffset(0)
        // Offset menu away from finger so release doesn't hit first item
        onLongPress({ x: point.x + 12, y: point.y + 12 })
      }, LONG_PRESS_MS)
    }
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (ignoreGestures.current || !dragging || pointerId.current !== event.pointerId) return
    const dx = event.clientX - startX.current
    const dy = event.clientY - startY.current

    if (axis.current === 'undecided') {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      axis.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (axis.current === 'y') {
        resetGesture()
        return
      }
    }

    if (axis.current !== 'x') return
    clearLongPress()
    event.preventDefault()

    let next = dx
    if (!onSwipeLeft && next < 0) next = 0
    if (!onSwipeRight && next > 0) next = 0
    next = Math.max(-120, Math.min(120, next))
    offsetRef.current = next
    setOffset(next)
  }

  const finish = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (ignoreGestures.current) {
      ignoreGestures.current = false
      return
    }
    if (pointerId.current !== event.pointerId) return
    clearLongPress()
    const finalOffset = offsetRef.current
    const committedLeft = finalOffset <= -SWIPE_THRESHOLD && onSwipeLeft && !longPressFired.current
    const committedRight = finalOffset >= SWIPE_THRESHOLD && onSwipeRight && !longPressFired.current

    try {
      if (rootRef.current?.hasPointerCapture(event.pointerId)) {
        rootRef.current.releasePointerCapture(event.pointerId)
      }
    } catch { /* ignore */ }

    setDragging(false)
    offsetRef.current = 0
    setOffset(0)
    pointerId.current = null
    axis.current = 'undecided'

    if (committedLeft) onSwipeLeft()
    else if (committedRight) onSwipeRight()
  }

  const onContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!onLongPress || disabled || isInteractiveTarget(event.target)) return
    event.preventDefault()
    onLongPress({ x: event.clientX + 8, y: event.clientY + 8 })
  }

  return (
    <div
      ref={rootRef}
      className={`swipe-row${dragging ? ' is-dragging' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      onContextMenu={onContextMenu}
    >
      <div className="swipe-row__behind swipe-row__behind--left" aria-hidden="true">
        <span>{leftLabel}</span>
      </div>
      <div className="swipe-row__behind swipe-row__behind--right" aria-hidden="true">
        <span>{rightLabel}</span>
      </div>
      <div
        className="swipe-row__front"
        style={{ transform: `translateX(${offset}px)` }}
      >
        {children}
      </div>
    </div>
  )
}
