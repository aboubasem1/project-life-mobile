import { describe, expect, it, vi } from 'vitest'
import { generateKnowledgeQuiz, gradeKnowledgeQuiz } from './knowledge-quiz.js'

describe('knowledge quiz', () => {
  it('normalizes LLM multiple-choice questions', async () => {
    const openAiJson = vi.fn(async () => ({
      questions: [
        {
          id: 'q1',
          prompt: 'Was ist Creatine?',
          choices: ['Aminosäure-Derivat', 'Vitamin', 'Mineral', 'Enzym'],
          correctIndex: 0,
          explanation: 'Creatine ist ein Aminosäure-Derivat.',
        },
        {
          prompt: 'Ungültig ohne choices',
          choices: [],
          correctIndex: 0,
        },
      ],
    }))

    const quiz = await generateKnowledgeQuiz({
      title: 'Creatine',
      summary: 'Hilft bei Kraft.',
      content: 'Creatine speichert Energie in Muskeln.',
      knowledgeId: 'k1',
    }, fetch, openAiJson)

    expect(quiz.questions).toHaveLength(1)
    expect(quiz.questions[0]?.correctIndex).toBe(0)
    expect(quiz.knowledgeId).toBe('k1')
  })

  it('grades answers on the server without inventing scores', () => {
    const grade = gradeKnowledgeQuiz({
      questions: [
        { id: 'q1', prompt: 'A?', choices: ['1', '2'], correctIndex: 1, explanation: 'Zwei' },
        { id: 'q2', prompt: 'B?', choices: ['x', 'y'], correctIndex: 0, explanation: 'X' },
      ],
      answers: { q1: 1, q2: 1 },
    })
    expect(grade.score).toBe(1)
    expect(grade.total).toBe(2)
    expect(grade.results[0]?.correct).toBe(true)
    expect(grade.results[1]?.correct).toBe(false)
  })
})
