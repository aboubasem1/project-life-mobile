import { useState } from 'react'
import {
  CONNECTOR_CATALOG,
  redactConfig,
  type ConnectorInstance,
  type DomainEventType,
  type OutboundWebhook,
  type WebhookLog,
} from '../../lib/lifeos'
import { Field, LifeOsEmpty, LifeOsPage } from './lifeosUi'

const EVENT_OPTIONS: DomainEventType[] = [
  'task.completed',
  'project.updated',
  'goal.updated',
  'decision.created',
  'decision.review_due',
  'signal.recorded',
  'knowledge.created',
  'review.completed',
  'life_area.assigned',
  'life_area.changed',
]

export function IntegrationsView({
  instances,
  outbound,
  logs,
  onConnect,
  onDisconnect,
  onConfigure,
  onAddOutbound,
  onToggleOutbound,
}: {
  instances: ConnectorInstance[]
  outbound: OutboundWebhook[]
  logs: WebhookLog[]
  onConnect: (connectorId: string, secret?: string) => void
  onDisconnect: (instanceId: string) => void
  onConfigure: (instanceId: string, configuration: Record<string, string>) => void
  onAddOutbound: (url: string, events: DomainEventType[]) => void
  onToggleOutbound: (id: string, enabled: boolean) => void
}) {
  const [secret, setSecret] = useState('')
  const [outUrl, setOutUrl] = useState('')
  const [events, setEvents] = useState<DomainEventType[]>(['review.completed'])

  return (
    <LifeOsPage eyebrow="Einstellungen" title="Integrationen">
      <section className="card">
        <p className="lifeos-body">
          Connectoren sind die Steckdose. Externe Apps bleiben austauschbar. n8n ist optionaler Transport, nicht das Gehirn.
        </p>
        {CONNECTOR_CATALOG.map(definition => {
          const instance = instances.find(item => item.connectorId === definition.id)
          return (
            <div key={definition.id} className="lifeos-connector">
              <div>
                <strong>{definition.provider}</strong>
                <p className="field-hint">{definition.description}</p>
                <p className="field-hint">
                  Auth: {definition.authentication} · {definition.capabilities.join(', ')}
                  {instance ? ` · ${instance.status}` : ' · nicht verbunden'}
                  {instance?.lastSyncAt ? ` · Sync ${new Date(instance.lastSyncAt).toLocaleString('de-DE')}` : ''}
                </p>
                {instance?.lastError && <p className="lifeos-error">{instance.lastError}</p>}
                {instance && <p className="field-hint">Config: {JSON.stringify(redactConfig(instance.configuration))}</p>}
              </div>
              <div className="lifeos-actions">
                {definition.authentication === 'webhook' && (
                  <input
                    className="dashboard-plus-input"
                    value={secret}
                    onChange={event => setSecret(event.target.value)}
                    placeholder="Webhook-Secret (wird gehasht)"
                  />
                )}
                {instance?.status === 'connected' ? (
                  <button type="button" className="secondary-button" onClick={() => instance && onDisconnect(instance.id)}>Trennen</button>
                ) : (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      onConnect(definition.id, secret || undefined)
                      setSecret('')
                    }}
                  >
                    Verbinden
                  </button>
                )}
                {instance && definition.id !== 'manual' && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => onConfigure(instance.id, { note: 'webhook' })}
                  >
                    Speichern
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </section>

      <section className="card">
        <span className="eyebrow">Outbound</span>
        <h3>Events nach außen</h3>
        <Field label="Webhook URL">
          <input value={outUrl} onChange={event => setOutUrl(event.target.value)} placeholder="https://" />
        </Field>
        <div className="lifeos-chip-row">
          {EVENT_OPTIONS.map(item => (
            <button
              key={item}
              type="button"
              className={events.includes(item) ? 'choice-button is-active' : 'choice-button'}
              onClick={() => setEvents(current => current.includes(item) ? current.filter(value => value !== item) : [...current, item])}
            >
              {item}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            if (!outUrl.trim()) return
            onAddOutbound(outUrl.trim(), events)
            setOutUrl('')
          }}
        >
          Target hinzufügen
        </button>
        {outbound.length === 0 && <p className="field-hint">Noch keine Outbound-Targets.</p>}
        {outbound.map(item => (
          <label key={item.id} className="lifeos-check-row">
            <input type="checkbox" checked={item.enabled} onChange={event => onToggleOutbound(item.id, event.target.checked)} />
            <span>{item.url} · {item.events.join(', ')}</span>
          </label>
        ))}
      </section>

      <section className="card">
        <span className="eyebrow">Logs</span>
        {logs.length === 0 ? (
          <LifeOsEmpty title="Keine Webhook-Logs" text="Inbound-Requests erscheinen hier ohne Secrets." />
        ) : (
          [...logs].reverse().slice(0, 20).map(item => (
            <div key={item.id} className="lifeos-list-item">
              <strong>{item.direction} {item.connectorId} · {item.status}</strong>
              <span>{item.message}</span>
            </div>
          ))
        )}
      </section>
    </LifeOsPage>
  )
}
