/**
 * AchievementToast — slides in from bottom when a new badge is unlocked.
 * Caller passes an Achievement[] from checkAchievements().
 * Auto-dismisses after 4 seconds per badge.
 */
import { useEffect, useState } from 'react'
import type { Achievement } from '../../lib/achievements'

interface Props {
  achievements: Achievement[]
  onDismiss: () => void
}

export function AchievementToast({ achievements, onDismiss }: Props) {
  const [idx, setIdx] = useState(0)
  const current = achievements[idx]

  useEffect(() => {
    if (!current) return
    const t = setTimeout(() => {
      if (idx < achievements.length - 1) {
        setIdx(i => i + 1)
      } else {
        onDismiss()
      }
    }, 4000)
    return () => clearTimeout(t)
  }, [idx, current, achievements.length, onDismiss])

  if (!current) return null

  return (
    <div className="achievement-toast" onClick={() => {
      if (idx < achievements.length - 1) setIdx(i => i + 1)
      else onDismiss()
    }}>
      <div className="ach-toast-icon">{current.icon}</div>
      <div className="ach-toast-body">
        <div className="ach-toast-title">🏆 Achievement unlocked!</div>
        <div className="ach-toast-name">{current.title}</div>
        <div className="ach-toast-desc">{current.desc}</div>
        <div className="ach-toast-xp">+{current.xpReward} XP</div>
      </div>
      {achievements.length > 1 && (
        <div className="ach-toast-counter">{idx + 1}/{achievements.length}</div>
      )}
    </div>
  )
}
