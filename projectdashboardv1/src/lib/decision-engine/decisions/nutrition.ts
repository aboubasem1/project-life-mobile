import type { DecisionContext, DecisionEntities, RoutineMealRef } from '../types.js'

const DEFAULT_ALIASES: Record<string, string[]> = {
  'protein-shake': [
    'proteinshake',
    'protein shake',
    'shake',
    'mass gainer',
    'massgainer',
    'weider mass gainer',
    'weider mass',
    'weider_mass_gainer',
  ],
}

function compact(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9äöüß]+/g, '')
}

export function defaultRoutineMeals(): RoutineMealRef[] {
  return [{
    id: 'protein-shake',
    label: 'Proteinshake',
    aliases: DEFAULT_ALIASES['protein-shake'],
    proteinGrams: 30,
    calories: 180,
    fatGrams: 3,
    carbsGrams: 8,
    fiberGrams: 0,
  }]
}

export function matchRoutineMeal(text: string, meals: RoutineMealRef[] = defaultRoutineMeals()): RoutineMealRef | undefined {
  const hay = compact(text)
  if (!hay) return undefined
  const hits = meals.filter(meal => {
    const aliases = [meal.id, meal.label, ...(meal.aliases ?? []), ...(DEFAULT_ALIASES[meal.id] ?? [])]
    return aliases.some(alias => {
      const needle = compact(alias)
      return needle.length >= 4 && hay.includes(needle)
    })
  })
  if (hits.length === 1) return hits[0]
  const uniqueIds = new Set(hits.map(item => item.id))
  if (uniqueIds.size === 1) return hits[0]
  return undefined
}

export function mealEntities(meal: RoutineMealRef, product?: string): DecisionEntities {
  return {
    product: product || meal.aliases?.[0] || meal.label,
    mealId: meal.id,
    mealLabel: meal.label,
  }
}

export function nutritionFromMeal(meal: RoutineMealRef): Pick<RoutineMealRef, 'proteinGrams' | 'calories' | 'fatGrams' | 'carbsGrams' | 'fiberGrams'> {
  return {
    proteinGrams: meal.proteinGrams,
    calories: meal.calories,
    fatGrams: meal.fatGrams,
    carbsGrams: meal.carbsGrams,
    fiberGrams: meal.fiberGrams,
  }
}

export function resolveMealContext(context: DecisionContext): RoutineMealRef[] {
  return context.routineMeals && context.routineMeals.length > 0
    ? context.routineMeals
    : defaultRoutineMeals()
}
