import { describe, expect, it } from 'vitest';

import { shareLabel } from './format';

describe('shareLabel', () => {
  it('formats a real share', () => {
    expect(shareLabel(3, 4, 'none')).toBe('75%');
    expect(shareLabel(0, 4, 'none')).toBe('0%');
  });

  it('never shows 0 of 0 as 0%', () => {
    expect(shareLabel(0, 0, 'No searches this week')).toBe('No searches this week');
  });
});
