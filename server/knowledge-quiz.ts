import { randomUUID } from 'node:crypto'
import { SyncHttpError, readSyncJson, syncJson } from './sync-core.js'
import { getRoom } from './sync-store.js'

export type KnowledgeQuizChoiceQuestion = {
  id: string
  prompt: string
  choices: string[]
  correctIndex: number
  explanation: string
}

export type KnowledgeQuizPayload = {
  quizId: string
  knowledgeId?: string
  questions: KnowledgeQuizChoiceQuestion[]
  generatedAt: string
}

type OpenAiJson = (input: {
  system: string
  user: unknown
  model?: string
  timeoutMs?: number
}, fetchImpl: typeof fetch) => Promise<unknown>

function env(name: string): string {
  return process.env[name]?.trim().replace(/^['"]|['"]$/g, '').trim() ?? ''
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

async function defaultOpenAiJson(input: {
  system: string
  user: unknown
  model?: string
  timeoutMs?: number
}, fetchImpl: typeof fetch): Promise<unknown> {
  const apiKey = env('OPENAI_API_KEY') || env('LLM_API_KEY')
  if (!apiKey) throw new SyncHttpError(503, 'Quiz-Generierung ist ohne OPENAI_API_KEY nicht verfügbar.')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 60_000)
  try {
    const response = await fetchImpl(env('LLM_API_URL') || 'https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: input.model || env('KNOWLEDGE_QUIZ_MODEL') || env('REEL_ANALYSIS_MODEL') || env('LLM_MODEL') || 'gpt-4o-mini',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: input.system },
          { role: 'user', content: JSON.stringify(input.user) },
        ],
      }),
      signal: controller.signal,
    })
    if (!response.ok) throw new SyncHttpError(502, 'Quiz-Generierung ist gerade nicht erreichbar.')
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    const content = payload.choices?.[0]?.message?.content
    if (!content) throw new SyncHttpError(502, 'Quiz-Generierung lieferte kein Ergebnis.')
    return JSON.parse(content) as unknown
  } catch (error) {
    if (error instanceof SyncHttpError) throw error
    if (error instanceof Error && error.name === 'AbortError') throw new SyncHttpError(504, 'Quiz-Generierung hat zu lange gedauert.')
    throw new SyncHttpError(502, 'Quiz-Generierung lieferte ein ungültiges Ergebnis.')
  } finally {
    clearTimeout(timer)
  }
}

function normalizeQuestions(raw: unknown): KnowledgeQuizChoiceQuestion[] {
  const root = record(raw)
  const list = Array.isArray(root.questions) ? root.questions : []
  const questions: KnowledgeQuizChoiceQuestion[] = []
  for (const entry of list) {
    const item = record(entry)
    const prompt = text(item.prompt, 280)
    const choices = Array.isArray(item.choices)
      ? [...new Set(item.choices.map(choice => text(choice, 160)).filter(Boolean))].slice(0, 4)
      : []
    const correctIndex = Math.floor(Number(item.correctIndex))
    if (!prompt || choices.length < 2 || !Number.isFinite(correctIndex) || correctIndex < 0 || correctIndex >= choices.length) continue
    questions.push({
      id: text(item.id, 64) || randomUUID(),
      prompt,
      choices,
      correctIndex,
      explanation: text(item.explanation, 400),
    })
    if (questions.length >= 6) break
  }
  return questions
}

export async function generateKnowledgeQuiz(input: {
  title: string
  summary: string
  content: string
  takeaways?: string[]
  knowledgeId?: string
}, fetchImpl: typeof fetch = fetch, openAiJson: OpenAiJson = defaultOpenAiJson): Promise<KnowledgeQuizPayload> {
  const title = input.title.trim()
  const summary = input.summary.trim()
  const content = input.content.trim()
  if (!title || (!summary && !content)) {
    throw new SyncHttpError(422, 'Für ein Quiz braucht es Titel und Inhalt.')
  }
  const raw = await openAiJson({
    system: [
      'Create a short multiple-choice quiz in German from the provided knowledge card.',
      'Return JSON only: {"questions":[{"id":"q1","prompt":"...","choices":["A","B","C","D"],"correctIndex":0,"explanation":"..."}]}',
      'Use 3 to 5 questions. Exactly 4 choices when possible, never fewer than 2.',
      'correctIndex is 0-based. Do not invent facts absent from the source. Prefer actionable comprehension checks.',
    ].join(' '),
    user: {
      title: title.slice(0, 160),
      summary: summary.slice(0, 2000),
      content: content.slice(0, 6000),
      takeaways: (input.takeaways ?? []).slice(0, 8),
    },
    timeoutMs: 90_000,
  }, fetchImpl)
  const questions = normalizeQuestions(raw)
  if (questions.length === 0) throw new SyncHttpError(502, 'Quiz konnte nicht erzeugt werden.')
  return {
    quizId: randomUUID(),
    knowledgeId: input.knowledgeId?.trim() || undefined,
    questions,
    generatedAt: new Date().toISOString(),
  }
}

export function gradeKnowledgeQuiz(input: {
  questions: KnowledgeQuizChoiceQuestion[]
  answers: Record<string, number>
}): {
  score: number
  total: number
  results: Array<{ id: string; correct: boolean; selectedIndex: number | null; correctIndex: number; explanation: string }>
} {
  const results = input.questions.map(question => {
    const selectedRaw = input.answers[question.id]
    const selectedIndex = Number.isFinite(Number(selectedRaw)) ? Math.floor(Number(selectedRaw)) : null
    const correct = selectedIndex === question.correctIndex
    return {
      id: question.id,
      correct,
      selectedIndex,
      correctIndex: question.correctIndex,
      explanation: question.explanation,
    }
  })
  const score = results.filter(item => item.correct).length
  return { score, total: results.length, results }
}

async function authorizeRoom(request: Request): Promise<string> {
  const roomId = request.headers.get('x-life-os-room')?.trim() ?? ''
  const header = request.headers.get('authorization') ?? ''
  const deviceToken = header.toLowerCase().startsWith('bearer ')
    ? header.slice(7).trim()
    : (request.headers.get('x-life-os-token')?.trim() || '')
  if (!roomId || !deviceToken) throw new SyncHttpError(401, 'Raum und Token sind nötig.')
  const room = await getRoom(roomId)
  if (!room) throw new SyncHttpError(404, 'Sync-Raum nicht gefunden.')
  if (!room.deviceTokens.includes(deviceToken)) throw new SyncHttpError(403, 'Gerät nicht mit diesem Sync verbunden.')
  return roomId
}

export async function handleKnowledgeQuizRequest(request: Request, fetchImpl: typeof fetch = fetch): Promise<Response> {
  if (request.method === 'OPTIONS') return syncJson({ ok: true })
  await authorizeRoom(request)
  const url = new URL(request.url)
  const pathname = url.pathname.replace(/\/$/, '')

  if (pathname.endsWith('/api/knowledge/quiz') && request.method === 'POST') {
    const body = await readSyncJson<{
      title?: unknown
      summary?: unknown
      content?: unknown
      takeaways?: unknown
      knowledgeId?: unknown
    }>(request)
    const quiz = await generateKnowledgeQuiz({
      title: text(body.title, 160),
      summary: text(body.summary, 3000),
      content: text(body.content, 8000),
      takeaways: Array.isArray(body.takeaways) ? body.takeaways.map(item => text(item, 200)).filter(Boolean) : [],
      knowledgeId: text(body.knowledgeId, 80) || undefined,
    }, fetchImpl)
    return syncJson({ ok: true, quiz })
  }

  if (pathname.endsWith('/api/knowledge/quiz/grade') && request.method === 'POST') {
    const body = await readSyncJson<{
      questions?: unknown
      answers?: unknown
    }>(request)
    const questions = normalizeQuestions({ questions: body.questions })
    if (questions.length === 0) throw new SyncHttpError(422, 'Keine gültigen Quizfragen übergeben.')
    const answersRaw = body.answers && typeof body.answers === 'object' ? body.answers as Record<string, unknown> : {}
    const answers: Record<string, number> = {}
    for (const [key, value] of Object.entries(answersRaw)) {
      const index = Math.floor(Number(value))
      if (Number.isFinite(index)) answers[key] = index
    }
    return syncJson({ ok: true, ...gradeKnowledgeQuiz({ questions, answers }) })
  }

  return syncJson({ error: 'Not found' }, 404)
}
