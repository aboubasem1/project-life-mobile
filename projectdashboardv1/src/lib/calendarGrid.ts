export type CalendarCell = {
  date: string
  inMonth: boolean
  isToday: boolean
  isSelected: boolean
  hasEntry: boolean
  score: number
}

function offsetDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`)
  d.setDate(d.getDate() + days)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function monthStart(year: number, monthIndex: number): string {
  const month = String(monthIndex + 1).padStart(2, '0')
  return `${year}-${month}-01`
}

/** Monday-first month grid (6 weeks). */
export function buildMonthGrid(input: {
  year: number
  monthIndex: number
  today: string
  selected: string
  entryDates: Set<string>
  scoresByDate?: Record<string, number>
}): CalendarCell[] {
  const first = monthStart(input.year, input.monthIndex)
  const firstDate = new Date(`${first}T12:00:00`)
  const mondayOffset = (firstDate.getDay() + 6) % 7 // 0 = Monday
  const gridStart = offsetDate(first, -mondayOffset)

  return Array.from({ length: 42 }, (_, index) => {
    const date = offsetDate(gridStart, index)
    const d = new Date(`${date}T12:00:00`)
    return {
      date,
      inMonth: d.getMonth() === input.monthIndex,
      isToday: date === input.today,
      isSelected: date === input.selected,
      hasEntry: input.entryDates.has(date),
      score: input.scoresByDate?.[date] ?? 0,
    }
  })
}

export function monthLabel(year: number, monthIndex: number): string {
  return new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' })
    .format(new Date(year, monthIndex, 1))
}
