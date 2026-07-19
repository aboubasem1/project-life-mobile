import { useState } from 'react'
import { Plus } from 'lucide-react'

interface Props {
  onCapture: (text: string) => void
}

export function QuickCapture({ onCapture }: Props) {
  const [text, setText] = useState('')

  const submit = () => {
    const t = text.trim()
    if (!t) return
    onCapture(t)
    setText('')
  }

  return (
    <div className="quick-capture">
      <input
        className="quick-capture-input"
        placeholder="Gedanke, Task, Idee…"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        aria-label="Schnellerfassung"
        maxLength={200}
      />
      <button
        className="quick-capture-btn"
        onClick={submit}
        aria-label="Erfassen"
        disabled={!text.trim()}
      >
        <Plus size={18} aria-hidden="true" />
      </button>
    </div>
  )
}
