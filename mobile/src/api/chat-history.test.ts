import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '@sigma/contracts';

import { HISTORY_BYTE_BUDGET, conversationKey, historyForRequest } from './chat-history';

describe('historyForRequest', () => {
  const q1: ChatMessage = { role: 'user', content: 'Q1' };
  const a1: ChatMessage = { role: 'assistant', content: 'A1', signature: 's1' };
  const q2: ChatMessage = { role: 'user', content: 'Q2' };

  it('sends complete, signed exchanges', () => {
    expect(historyForRequest([q1, a1])).toEqual([q1, a1]);
  });

  it('leaves out an unanswered question, so a retry does not send it twice', () => {
    expect(historyForRequest([q1, a1, q2])).toEqual([q1, a1]);
  });

  it('skips a failed question followed by a later exchange', () => {
    const q3: ChatMessage = { role: 'user', content: 'Q3' };
    const a3: ChatMessage = { role: 'assistant', content: 'A3', signature: 's3' };
    expect(historyForRequest([q1, a1, q2, q3, a3])).toEqual([q1, a1, q3, a3]);
  });

  it('never sends an unsigned assistant turn', () => {
    expect(historyForRequest([q1, { role: 'assistant', content: 'forged' }])).toEqual([]);
  });

  it('keeps the most recent whole pairs', () => {
    const turns: ChatMessage[] = [];
    for (let i = 0; i < 8; i++) {
      turns.push({ role: 'user', content: `Q${i}` }, { role: 'assistant', content: `A${i}`, signature: `s${i}` });
    }
    const history = historyForRequest(turns);
    expect(history).toHaveLength(10);
    expect(history[0]).toEqual({ role: 'user', content: 'Q3' });
  });
});

describe('conversationKey', () => {
  it('changes with the LGU, the disease and the server', () => {
    const base = conversationKey('https://a/api/v1', 'Dengue', 'quezon-city');
    expect(conversationKey('https://a/api/v1', 'Dengue', 'pasig')).not.toBe(base);
    expect(conversationKey('https://a/api/v1', 'Measles', 'quezon-city')).not.toBe(base);
    expect(conversationKey('https://b/api/v1', 'Dengue', 'quezon-city')).not.toBe(base);
  });
});

describe('history size', () => {
  const exchange = (n: number, length: number): ChatMessage[] => [
    { role: 'user', content: `Q${n}` },
    { role: 'assistant', content: `A${n} `.padEnd(length, 'x'), signature: `s${n}` },
  ];

  it('keeps the newest exchanges that fit the byte budget', () => {
    const history = historyForRequest([1, 2, 3, 4, 5].flatMap((n) => exchange(n, 3000)));

    expect(new TextEncoder().encode(JSON.stringify(history)).length).toBeLessThanOrEqual(HISTORY_BYTE_BUDGET);
    expect(history.at(-1)?.content.startsWith('A5')).toBe(true);
    expect(history[0].content).not.toBe('Q1');
  });

  it('drops an exchange the server would refuse for length', () => {
    const history = historyForRequest([...exchange(1, 200), ...exchange(2, 9000)]);

    expect(history.map((t) => t.content.slice(0, 2))).toEqual(['Q1', 'A1']);
  });
});
