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
  const startX = useRef(0)
  const startY = useRef(0)
  const axis = useRef<'undecided' | 'x' | 'y'>('undecided')
  const longPressTimer = useRef<number | null>(null)
  const longPressFired = useRef(false)
  const pointerId = useRef<number | null>(null)

  const clearLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  useEffect(() => () => clearLongPress(), [])

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || event.button > 0) return
    pointerId.current = event.pointerId
    startX.current = event.clientX
    startY.current = event.clientY
    axis.current = 'undecided'
    longPressFired.current = false
    setDragging(true)

    if (onLongPress) {
      const point = { x: event.clientX, y: event.clientY }
      longPressTimer.current = window.setTimeout(() => {
        longPressFired.current = true
        setDragging(false)
        setOffset(0)
        onLongPress(point)
      }, LONG_PRESS_MS)
    }
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging || pointerId.current !== event.pointerId) return
    const dx = event.clientX - startX.current
    const dy = event.clientY - startY.current

    if (axis.current === 'undecided') {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      axis.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (axis.current === 'y') {
        clearLongPress()
        setDragging(false)
        setOffset(0)
        return
      }
    }

    if (axis.current !== 'x') return
    clearLongPress()
    event.preventDefault()

    let next = dx
    if (!onSwipeLeft && next < 0) next = 0
    if (!onSwipeRight && next > 0) next = 0
    setOffset(Math.max(-120, Math.min(120, next)))
  }

  const finish = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== event.pointerId) return
    clearLongPress()
    const committedLeft = offset <= -SWIPE_THRESHOLD && onSwipeLeft && !longPressFired.current
    const committedRight = offset >= SWIPE_THRESHOLD && onSwipeRight && !longPressFired.current
    setDragging(false)
    setOffset(0)
    pointerId.current = null
    axis.current = 'undecided'
    if (committedLeft) onSwipeLeft()
    else if (committedRight) onSwipeRight()
  }

  const onContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!onLongPress || disabled) return
    event.preventDefault()
    onLongPress({ x: event.clientX, y: event.clientY })
  }

  return (
    <div
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
