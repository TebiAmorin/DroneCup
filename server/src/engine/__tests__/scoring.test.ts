import { describe, it, expect } from 'vitest';
import { positionToPoints, validateAndScoreMapResults } from '../scoring.js';

describe('positionToPoints', () => {
  it('returns correct points for all 10 positions', () => {
    expect(positionToPoints(1, 'FINISHED')).toBe(25);
    expect(positionToPoints(2, 'FINISHED')).toBe(18);
    expect(positionToPoints(3, 'FINISHED')).toBe(15);
    expect(positionToPoints(4, 'FINISHED')).toBe(12);
    expect(positionToPoints(5, 'FINISHED')).toBe(10);
    expect(positionToPoints(6, 'FINISHED')).toBe(8);
    expect(positionToPoints(7, 'FINISHED')).toBe(6);
    expect(positionToPoints(8, 'FINISHED')).toBe(4);
    expect(positionToPoints(9, 'FINISHED')).toBe(2);
    expect(positionToPoints(10, 'FINISHED')).toBe(1);
  });

  it('returns 0 for DNF', () => {
    expect(positionToPoints(null, 'DNF')).toBe(0);
  });

  it('returns 0 for DNF even if position is somehow provided', () => {
    expect(positionToPoints(1, 'DNF')).toBe(0);
  });

  it('returns 0 for invalid positions', () => {
    expect(positionToPoints(0, 'FINISHED')).toBe(0);
    expect(positionToPoints(11, 'FINISHED')).toBe(0);
    expect(positionToPoints(-1, 'FINISHED')).toBe(0);
    expect(positionToPoints(null, 'FINISHED')).toBe(0);
  });
});

describe('validateAndScoreMapResults', () => {
  const eligible = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10'];

  function makeResults(overrides?: Partial<{ participantId: string; position: number | null; status: 'FINISHED' | 'DNF' }>[]) {
    return eligible.map((id, i) => ({
      participantId: id,
      position: (i + 1) as number | null,
      status: 'FINISHED' as const,
      ...(overrides?.[i] ?? {}),
    }));
  }

  it('validates and scores a correct set of 10 results', () => {
    const results = makeResults();
    const out = validateAndScoreMapResults(results, eligible);
    expect(out.valid).toBe(true);
    if (out.valid) {
      expect(out.scored).toHaveLength(10);
      expect(out.scored[0].points).toBe(25);
      expect(out.scored[9].points).toBe(1);
    }
  });

  it('scores DNF as 0 points', () => {
    const results = makeResults();
    results[9] = { participantId: 'p10', position: null, status: 'DNF' };
    // Shift positions: p1-p9 get positions 1-9
    for (let i = 0; i < 9; i++) results[i].position = i + 1;

    const out = validateAndScoreMapResults(results, eligible);
    expect(out.valid).toBe(true);
    if (out.valid) {
      const dnf = out.scored.find(s => s.participantId === 'p10');
      expect(dnf?.points).toBe(0);
      expect(dnf?.position).toBeNull();
    }
  });

  it('rejects wrong number of results', () => {
    const results = makeResults().slice(0, 9);
    const out = validateAndScoreMapResults(results, eligible);
    expect(out.valid).toBe(false);
    if (!out.valid) {
      expect(out.errors.some(e => e.message.includes('Expected 10'))).toBe(true);
    }
  });

  it('rejects duplicate participants', () => {
    const results = makeResults();
    results[9] = { participantId: 'p1', position: 10, status: 'FINISHED' };
    const out = validateAndScoreMapResults(results, eligible);
    expect(out.valid).toBe(false);
    if (!out.valid) {
      expect(out.errors.some(e => e.message.includes('Duplicate participant'))).toBe(true);
    }
  });

  it('rejects ineligible participants', () => {
    const results = makeResults();
    results[0] = { participantId: 'unknown', position: 1, status: 'FINISHED' };
    const out = validateAndScoreMapResults(results, eligible);
    expect(out.valid).toBe(false);
    if (!out.valid) {
      expect(out.errors.some(e => e.message.includes('not eligible'))).toBe(true);
    }
  });

  it('rejects duplicate finished positions', () => {
    const results = makeResults();
    results[1].position = 1; // two participants with position 1
    const out = validateAndScoreMapResults(results, eligible);
    expect(out.valid).toBe(false);
    if (!out.valid) {
      expect(out.errors.some(e => e.message.includes('Duplicate finished positions'))).toBe(true);
    }
  });

  it('rejects FINISHED without position', () => {
    const results = makeResults();
    results[0].position = null;
    const out = validateAndScoreMapResults(results, eligible);
    expect(out.valid).toBe(false);
    if (!out.valid) {
      expect(out.errors.some(e => e.message.includes('must have a position'))).toBe(true);
    }
  });

  it('rejects DNF with position', () => {
    const results = makeResults();
    results[0] = { participantId: 'p1', position: 1, status: 'DNF' };
    const out = validateAndScoreMapResults(results, eligible);
    expect(out.valid).toBe(false);
    if (!out.valid) {
      expect(out.errors.some(e => e.message.includes('must not have a position'))).toBe(true);
    }
  });

  it('rejects invalid position values', () => {
    const results = makeResults();
    results[0].position = 0;
    const out = validateAndScoreMapResults(results, eligible);
    expect(out.valid).toBe(false);
    if (!out.valid) {
      expect(out.errors.some(e => e.message.includes('Invalid position'))).toBe(true);
    }
  });

  it('rejects position > 10', () => {
    const results = makeResults();
    results[0].position = 11;
    const out = validateAndScoreMapResults(results, eligible);
    expect(out.valid).toBe(false);
  });

  it('allows multiple DNFs', () => {
    const results = eligible.map((id, i) => {
      if (i < 5) return { participantId: id, position: i + 1, status: 'FINISHED' as const };
      return { participantId: id, position: null, status: 'DNF' as const };
    });
    const out = validateAndScoreMapResults(results, eligible);
    expect(out.valid).toBe(true);
    if (out.valid) {
      const dnfs = out.scored.filter(s => s.status === 'DNF');
      expect(dnfs).toHaveLength(5);
      dnfs.forEach(d => expect(d.points).toBe(0));
    }
  });
});
