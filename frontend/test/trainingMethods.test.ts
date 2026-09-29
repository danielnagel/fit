import { describe, expect, it } from 'vitest';
import {
  REST_FORMULA_LABELS,
  SCOPE_LABELS,
  STOP_CONDITION_LABELS,
  TIMING_FAMILY_LABELS,
  type RestFormula,
  type Scope,
  type StopCondition,
  type TimingFamily,
} from '../src/trainingMethods';

describe('label maps', () => {
  it('has a label for every scope', () => {
    const scopes: Scope[] = ['single', 'pair', 'all'];
    for (const scope of scopes) expect(SCOPE_LABELS[scope]).toBeTruthy();
  });

  it('has a label for every timing family', () => {
    const families: TimingFamily[] = ['fixed-window-remainder', 'fixed-work-rest', 'self-paced'];
    for (const family of families) expect(TIMING_FAMILY_LABELS[family]).toBeTruthy();
  });

  it('has a label for every rest formula', () => {
    const formulas: RestFormula[] = ['proportional', 'fixed'];
    for (const formula of formulas) expect(REST_FORMULA_LABELS[formula]).toBeTruthy();
  });

  it('has a label for every stop condition', () => {
    const conditions: StopCondition[] = ['fixed-count', 'time-budget', 'all-exercises-done'];
    for (const condition of conditions) expect(STOP_CONDITION_LABELS[condition]).toBeTruthy();
  });
});
