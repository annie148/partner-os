import type { Confidence, Opportunity } from '@/types'

export const CONFIDENCE_WEIGHTS: Record<Confidence, number> = {
  1: 0.10,
  2: 0.45,
  3: 0.90,
}

export function forecastAmount(
  opp: Pick<Opportunity, 'projectedAmount' | 'confidence'>
): number {
  const projected = Number(opp.projectedAmount)
  const weight = CONFIDENCE_WEIGHTS[opp.confidence]
  if (!Number.isFinite(projected) || !weight) return 0
  return projected * weight
}
