import { describe, expect, it } from 'vitest';

import { isWebUrl, numberCitations, plainReply } from './citations';

const LAB = { id: 'lab-quezon-city-2019', title: 'Quezon City 2019' };
const ACCESS = { id: 'access-quezon-city', title: 'Mapped facilities' };
const METHOD = { id: 'method-ears', title: 'EARS method' };

describe('numberCitations', () => {
  it('numbers cited ids in order of first use and reuses a number', () => {
    const { text, cited } = numberCitations(
      'Cases rose [lab-quezon-city-2019]. Pharmacies are mapped [access-quezon-city]; see `lab-quezon-city-2019`.',
      [LAB, ACCESS]
    );
    expect(text).toBe('Cases rose [1]. Pharmacies are mapped [2]; see [1].');
    expect(cited).toEqual([LAB, ACCESS]);
  });

  it('leaves an id the server did not confirm as plain text', () => {
    const { text, cited } = numberCitations('Pasig rose [lab-pasig-city-2019] and QC [lab-quezon-city-2019].', [LAB]);
    expect(text).toBe('Pasig rose [lab-pasig-city-2019] and QC [1].');
    expect(cited).toEqual([LAB]);
  });

  it('does not match an id inside a longer id', () => {
    const { text } = numberCitations('See [lab-quezon-city-2019-extra].', [LAB]);
    expect(text).toBe('See [lab-quezon-city-2019-extra].');
  });

  it('still lists a confirmed source the text does not name, after the numbered ones', () => {
    const { cited } = numberCitations('Per [access-quezon-city].', [METHOD, ACCESS]);
    expect(cited).toEqual([ACCESS, METHOD]);
  });

  it('returns the reply unchanged with no citations', () => {
    expect(numberCitations('No sources.', [])).toEqual({ text: 'No sources.', cited: [] });
  });
});

describe('plainReply', () => {
  it('drops Markdown markers and keeps the words', () => {
    expect(plainReply('## What the data shows\n\n**Cases** rose in `2019`.\n- First point\n* Second point')).toBe(
      'What the data shows\n\nCases rose in 2019.\n• First point\n• Second point'
    );
  });

  it('keeps a link address', () => {
    expect(plainReply('See [the manual](https://doh.gov.ph/pidsr).')).toBe('See the manual (https://doh.gov.ph/pidsr).');
  });

  it('keeps citation markers', () => {
    expect(plainReply('Cases rose [1].')).toBe('Cases rose [1].');
  });
});

describe('isWebUrl', () => {
  it('opens only http(s) addresses', () => {
    expect(isWebUrl('https://data.humdata.org')).toBe(true);
    expect(isWebUrl('/analyze/lab')).toBe(false);
    expect(isWebUrl('javascript:alert(1)')).toBe(false);
    expect(isWebUrl(null)).toBe(false);
  });
});
