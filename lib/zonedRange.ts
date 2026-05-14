/**
 * Convert a wall-clock instant in an IANA time zone to a UTC Date (first matching instant).
 * Used for analytics month/quarter boundaries aligned with workspace.timezone.
 */
function zonedParts(utcMs: number, timeZone: string) {
  const d = new Date(utcMs);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  });
  const parts = fmt.formatToParts(d);
  const n = (t: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return {
    year: n("year"),
    month: n("month"),
    day: n("day"),
    hour: n("hour"),
    minute: n("minute"),
    second: n("second"),
  };
}

function cmpZoned(
  a: ReturnType<typeof zonedParts>,
  b: { year: number; month: number; day: number; hour: number; minute: number; second: number },
) {
  const keys: (keyof typeof b)[] = ["year", "month", "day", "hour", "minute", "second"];
  for (const k of keys) {
    if (a[k] !== b[k]) return a[k] - b[k];
  }
  return 0;
}

/** Smallest UTC time in [lo, hi) whose zoned parts are >= `target` (requires zoned(lo) < target <= zoned(hi)). */
function zonedWallClockToUtc(
  timeZone: string,
  target: { year: number; month: number; day: number; hour: number; minute: number; second: number },
  lo: number,
  hi: number,
): Date {
  let a = lo;
  let b = hi;
  while (a < b) {
    const mid = Math.floor((a + b) / 2);
    const p = zonedParts(mid, timeZone);
    if (cmpZoned(p, target) < 0) {
      a = mid + 1;
    } else {
      b = mid;
    }
  }
  return new Date(a);
}

export function startOfZonedMonth(timeZone: string, year: number, month1to12: number): Date {
  const target = { year, month: month1to12, day: 1, hour: 0, minute: 0, second: 0 };
  let lo = Date.UTC(year, month1to12 - 2, 1);
  let hi = Date.UTC(year, month1to12 + 1, 15);
  while (cmpZoned(zonedParts(lo, timeZone), target) >= 0) {
    lo -= 7 * 24 * 60 * 60 * 1000;
  }
  while (cmpZoned(zonedParts(hi, timeZone), target) < 0) {
    hi += 7 * 24 * 60 * 60 * 1000;
  }
  return zonedWallClockToUtc(timeZone, target, lo, hi);
}

export function startOfZonedNextMonth(timeZone: string, year: number, month1to12: number): Date {
  let y = year;
  let m = month1to12 + 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  return startOfZonedMonth(timeZone, y, m);
}

export function startOfZonedQuarter(timeZone: string, year: number, quarter1to4: number): Date {
  const month = (quarter1to4 - 1) * 3 + 1;
  return startOfZonedMonth(timeZone, year, month);
}

export function startOfZonedNextQuarter(timeZone: string, year: number, quarter1to4: number): Date {
  if (quarter1to4 === 4) {
    return startOfZonedMonth(timeZone, year + 1, 1);
  }
  const nextFirstMonth = quarter1to4 * 3 + 1;
  return startOfZonedMonth(timeZone, year, nextFirstMonth);
}
