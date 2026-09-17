import { SCORING_TABLE } from '../../../shared/types.js';
import type { ResultStatus } from '../../../shared/types.js';

export function positionToPoints(position: number | null, status: ResultStatus): number {
  if (status === 'DNF') return 0;
  if (position === null) return 0;
  return SCORING_TABLE[position] ?? 0;
}

export interface MapResultInput {
  participantId: string;
  position: number | null;
  status: ResultStatus;
}

export interface ValidatedMapResult extends MapResultInput {
  points: number;
}

export interface ValidationError {
  field: string;
  message: string;
}

export function validateAndScoreMapResults(
  results: MapResultInput[],
  eligibleParticipantIds: string[]
): { valid: true; scored: ValidatedMapResult[] } | { valid: false; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  if (results.length !== 10) {
    errors.push({ field: 'results', message: `Expected 10 results, got ${results.length}` });
  }

  const participantIds = results.map(r => r.participantId);
  const uniqueIds = new Set(participantIds);
  if (uniqueIds.size !== participantIds.length) {
    errors.push({ field: 'participantId', message: 'Duplicate participant in results' });
  }

  const eligibleSet = new Set(eligibleParticipantIds);
  for (const r of results) {
    if (!eligibleSet.has(r.participantId)) {
      errors.push({ field: 'participantId', message: `Participant ${r.participantId} is not eligible for this match` });
    }
  }

  const finishedPositions: number[] = [];
  for (const r of results) {
    if (r.status === 'FINISHED') {
      if (r.position === null) {
        errors.push({ field: 'position', message: `FINISHED participant ${r.participantId} must have a position` });
      } else if (r.position < 1 || r.position > 10 || !Number.isInteger(r.position)) {
        errors.push({ field: 'position', message: `Invalid position ${r.position} for participant ${r.participantId}` });
      } else {
        finishedPositions.push(r.position);
      }
    } else if (r.status === 'DNF') {
      if (r.position !== null) {
        errors.push({ field: 'position', message: `DNF participant ${r.participantId} must not have a position` });
      }
    }
  }

  const uniquePositions = new Set(finishedPositions);
  if (uniquePositions.size !== finishedPositions.length) {
    errors.push({ field: 'position', message: 'Duplicate finished positions' });
  }

  if (errors.length > 0) return { valid: false, errors };

  const scored: ValidatedMapResult[] = results.map(r => ({
    ...r,
    points: positionToPoints(r.position, r.status),
  }));

  return { valid: true, scored };
}
