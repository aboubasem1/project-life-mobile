export type LaborSearchHit = {
  id: string
  title: string
  source: string
  section: 'todos' | 'shopping' | 'lists' | 'stock' | 'medications' | 'goals' | 'finance'
  boardId?: string
  listId?: string
}

function matches(query: string, ...parts: Array<string | undefined | null>): boolean {
  const hay = parts.filter(Boolean).join(' ').toLowerCase()
  return hay.includes(query)
}

export function searchLabor(input: {
  query: string
  focusTodos: Array<{ id: string; title: string; tag?: string }>
  boards: Array<{ id: string; label: string; tasks: Array<{ id: string; title: string; tag?: string }> }>
  shopping: Array<{ id: string; name: string; note?: string }>
  lists: Array<{ id: string; title: string; items: Array<{ id: string; title: string; note?: string }> }>
  supplements?: Array<{ id: string; name: string; brand?: string }>
  medications?: Array<{ id: string; name: string; dosage?: string }>
  goals?: Array<{ id: string; title: string }>
  bills?: Array<{ id: string; name: string; subtitle?: string }>
}): LaborSearchHit[] {
  const query = input.query.trim().toLowerCase()
  if (!query) return []

  const hits: LaborSearchHit[] = []

  for (const task of input.focusTodos) {
    if (matches(query, task.title, task.tag)) {
      hits.push({ id: task.id, title: task.title, source: 'Fokus', section: 'todos' })
    }
  }

  for (const board of input.boards) {
    for (const task of board.tasks) {
      if (matches(query, task.title, task.tag, board.label)) {
        hits.push({
          id: task.id,
          title: task.title,
          source: board.label,
          section: 'todos',
          boardId: board.id,
        })
      }
    }
  }

  for (const item of input.shopping) {
    if (matches(query, item.name, item.note)) {
      hits.push({ id: item.id, title: item.name, source: 'Kaufliste', section: 'shopping' })
    }
  }

  for (const list of input.lists) {
    for (const item of list.items) {
      if (matches(query, item.title, item.note, list.title)) {
        hits.push({
          id: item.id,
          title: item.title,
          source: list.title,
          section: 'lists',
          listId: list.id,
        })
      }
    }
  }

  for (const item of input.supplements ?? []) {
    if (matches(query, item.name, item.brand)) {
      hits.push({ id: item.id, title: item.name, source: 'Bestände', section: 'stock' })
    }
  }

  for (const item of input.medications ?? []) {
    if (matches(query, item.name, item.dosage)) {
      hits.push({ id: item.id, title: item.name, source: 'Medis', section: 'medications' })
    }
  }

  for (const item of input.goals ?? []) {
    if (matches(query, item.title)) {
      hits.push({ id: item.id, title: item.title, source: 'Ziele', section: 'goals' })
    }
  }

  for (const item of input.bills ?? []) {
    if (matches(query, item.name, item.subtitle)) {
      hits.push({ id: item.id, title: item.name, source: 'Finanzen', section: 'finance' })
    }
  }

  return hits.slice(0, 40)
}
