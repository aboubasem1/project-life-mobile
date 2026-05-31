import type { SyncStatus } from '../../hooks/useEntries'

interface SyncStatusProps {
  status: SyncStatus | 'loading'
}

const CONFIGS: Record<string, { icon: string; text: string; cls: string }> = {
  idle:    { icon: '◈',  text: 'LOKAL',           cls: 'idle'    },
  syncing: { icon: '↓',  text: 'SPEICHERT...',    cls: 'syncing' },
  loading: { icon: '↻',  text: 'LÄDT...',         cls: 'syncing' },
  synced:  { icon: '✓',  text: 'LOKAL GESPEICHERT', cls: 'synced'  },
  error:   { icon: '⚠',  text: 'FEHLER',          cls: 'error'   },
  offline: { icon: '⊠',  text: 'OFFLINE',         cls: 'offline' },
}

export function SyncStatusBadge({ status }: SyncStatusProps) {
  const cfg = CONFIGS[status] ?? CONFIGS.idle
  return (
    <div className={`sync-pill status-${cfg.cls}`}>
      <span className="sync-icon">{cfg.icon}</span>
      <span>{cfg.text}</span>
    </div>
  )
}
