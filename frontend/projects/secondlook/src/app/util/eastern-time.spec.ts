import { dayLabel, easternToUtc, timeLabel, utcToEastern } from './eastern-time';

describe('Eastern Time helpers', () => {
  it('converts summer times (UTC-4) to UTC and back', () => {
    expect(easternToUtc('2031-05-05', '14:00')).toBe('2031-05-05T18:00:00.000Z');
    expect(utcToEastern('2031-05-05T18:00:00.000Z')).toEqual({ day: '2031-05-05', time: '14:00' });
  });

  it('converts winter times (UTC-5) to UTC', () => {
    expect(easternToUtc('2031-01-15', '09:30')).toBe('2031-01-15T14:30:00.000Z');
  });

  it('handles a window across the spring clock change', () => {
    // 2031-03-09 is the second Sunday of March: 02:00 EST jumps to 03:00 EDT.
    expect(easternToUtc('2031-03-09', '01:00')).toBe('2031-03-09T06:00:00.000Z');
    expect(easternToUtc('2031-03-09', '04:00')).toBe('2031-03-09T08:00:00.000Z');
  });

  it('formats labels in Eastern Time', () => {
    expect(dayLabel('2031-05-05T18:00:00.000Z')).toBe('Mon 5 May 2031');
    expect(timeLabel('2031-05-05T18:00:00.000Z')).toBe('2:00 PM');
    expect(timeLabel('2031-05-05T14:00:00.000Z')).toBe('10:00 AM');
  });

  it('returns null for missing input', () => {
    expect(easternToUtc('', '14:00')).toBeNull();
    expect(easternToUtc('2031-05-05', '')).toBeNull();
  });
});
