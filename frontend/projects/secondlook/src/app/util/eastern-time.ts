/** SecondLook serves Ontario: availability is entered and shown in Eastern Time and stored in UTC (ADR 0005). */
export const ZONE = 'America/Toronto';

const parts = (ms: number, options: Intl.DateTimeFormatOptions) =>
  Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, hourCycle: 'h23', ...options })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value]),
  );

/** Minutes the zone is ahead of UTC at the given instant (negative in Ontario). */
function offsetMinutes(ms: number): number {
  const p = parts(ms, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });
  const asUtc = Date.UTC(
    +p['year'],
    +p['month'] - 1,
    +p['day'],
    +p['hour'],
    +p['minute'],
    +p['second'],
  );
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
}

/** "2031-05-05" and "14:00" entered in Eastern Time to a UTC ISO string, or null when either is missing. */
export function easternToUtc(day: string, time: string): string | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!d || !t) return null;
  const local = Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2]);
  let utc = local - offsetMinutes(local) * 60000;
  utc = local - offsetMinutes(utc) * 60000; // second pass settles the daylight-saving edge
  return new Date(utc).toISOString();
}

/** Day and time inputs ("2031-05-05", "14:00") for a UTC instant, in Eastern Time. */
export function utcToEastern(iso: string): { day: string; time: string } {
  const p = parts(Date.parse(iso), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  return { day: `${p['year']}-${p['month']}-${p['day']}`, time: `${p['hour']}:${p['minute']}` };
}

/** "Mon 5 May 2031". */
export function dayLabel(iso: string): string {
  const p = parts(Date.parse(iso), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return `${p['weekday']} ${p['day']} ${p['month']} ${p['year']}`;
}

/** "2:00 PM". */
export function timeLabel(iso: string): string {
  const p = parts(Date.parse(iso), {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    hourCycle: undefined,
  });
  return `${p['hour']}:${p['minute']} ${String(p['dayPeriod']).toUpperCase().replace(/\./g, '')}`;
}
