import { loadSyncCredentials } from './deviceSync'

export type KnowledgeQuizQuestion = {
  id: string
  prompt: string
  choices: string[]
  correctIndex: number
  explanation: string
}

export type KnowledgeQuiz = {
  quizId: string
  knowledgeId?: string
  questions: KnowledgeQuizQuestion[]
  generatedAt: string
}

export type KnowledgeQuizGrade = {
  score: number
  total: number
  results: Array<{
    id: string
    correct: boolean
    selectedIndex: number | null
    correctIndex: number
    explanation: string
  }>
}

function authHeaders(): Record<string, string> {
  const credentials = loadSyncCredentials()
  if (!credentials) throw new Error('Quiz benötigt einen gekoppelten Geräte-Sync.')
  return {
    Authorization: `Bearer ${credentials.deviceToken}`,
    'X-Life-Os-Room': credentials.roomId,
  }
}

async function quizJson<T>(path: string, body: unknown, timeoutMs = 90_000): Promise<T> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const result = await response.json().catch(() => ({})) as T & { error?: string }
    if (!response.ok) throw new Error(result.error || `Quiz-API nicht erreichbar (${response.status}).`)
    return result
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Quiz-Anfrage hat zu lange gedauert.')
    }
    throw error
  } finally {
    window.clearTimeout(timer)
  }
}

export async function generateKnowledgeQuiz(input: {
  knowledgeId: string
  title: string
  summary: string
  content: string
  takeaways?: string[]
}): Promise<KnowledgeQuiz> {
  const result = await quizJson<{ quiz: KnowledgeQuiz }>('/api/knowledge/quiz', input)
  if (!result.quiz?.questions?.length) throw new Error('Quiz konnte nicht erzeugt werden.')
  return result.quiz
}

export async function gradeKnowledgeQuiz(input: {
  questions: KnowledgeQuizQuestion[]
  answers: Record<string, number>
}): Promise<KnowledgeQuizGrade> {
  const result = await quizJson<KnowledgeQuizGrade>('/api/knowledge/quiz/grade', input, 20_000)
  if (!Number.isFinite(result.total)) throw new Error('Quiz-Auswertung fehlgeschlagen.')
  return result
}

export function quizStorageKey(knowledgeId: string): string {
  return `lifeos.knowledge.quiz.${knowledgeId}`
}

export function loadStoredQuiz(knowledgeId: string): {
  quiz: KnowledgeQuiz
  answers: Record<string, number>
  grade: KnowledgeQuizGrade | null
} | null {
  try {
    const raw = sessionStorage.getItem(quizStorageKey(knowledgeId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as {
      quiz?: KnowledgeQuiz
      answers?: Record<string, number>
      grade?: KnowledgeQuizGrade | null
    }
    if (!parsed.quiz?.questions?.length) return null
    return {
      quiz: parsed.quiz,
      answers: parsed.answers ?? {},
      grade: parsed.grade ?? null,
    }
  } catch {
    return null
  }
}

export function saveStoredQuiz(
  knowledgeId: string,
  payload: { quiz: KnowledgeQuiz; answers: Record<string, number>; grade: KnowledgeQuizGrade | null },
): void {
  try {
    sessionStorage.setItem(quizStorageKey(knowledgeId), JSON.stringify(payload))
  } catch {
    /* ignore quota */
  }
}
