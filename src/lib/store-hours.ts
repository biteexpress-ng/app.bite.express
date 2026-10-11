import type { StoreSchedule } from "@/lib/api/store-detail";

/**
 * Schedule rows are wall-clock times in the platform's business timezone,
 * and the API decides `open` against that clock. The countdown has to read
 * the same clock, whatever zone the customer's browser is set to.
 */
const STORE_TIME_ZONE = "Africa/Lagos";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const SECONDS_PER_DAY = 24 * 60 * 60;

let clockFormat: Intl.DateTimeFormat | undefined;

function storeClock(now: Date): { day: number; seconds: number } {
  clockFormat ??= new Intl.DateTimeFormat("en-US", {
    timeZone: STORE_TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts: Record<string, string> = {};
  for (const p of clockFormat.formatToParts(now)) parts[p.type] = p.value;
  return {
    day: WEEKDAY_INDEX[parts.weekday] ?? 0,
    seconds:
      Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second),
  };
}

/** "16:00:00" → seconds since midnight. Null for anything unparseable. */
function toSeconds(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(time);
  if (!m) return null;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3] ?? 0);
}

type Window = { day: number; opens: number; closes: number };

function windows(schedules: StoreSchedule[]): Window[] {
  const out: Window[] = [];
  for (const s of schedules) {
    const opens = toSeconds(s.opening_time);
    const closes = toSeconds(s.closing_time);
    // The API's open check is opening < now < closing, so a row that
    // closes at or before it opens never opens at all.
    if (opens === null || closes === null || closes <= opens) continue;
    out.push({ day: s.day, opens, closes });
  }
  return out;
}

function formatClock(secondsOfDay: number): string {
  const minutes = Math.floor(secondsOfDay / 60);
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h24 < 12 ? "am" : "pm";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, "0")}${suffix}`;
}

type StoreHoursInput = {
  open?: 0 | 1;
  active?: boolean | 0 | 1;
  schedules?: StoreSchedule[] | null;
};

/**
 * The vendor switched the store off by hand. The API still computes `open`
 * from the schedule alone, so such a store can arrive with `open: 1`.
 */
export function isTemporarilyClosed(store: StoreHoursInput): boolean {
  return store.active === false || store.active === 0;
}

/**
 * The line under a closed store's "Closed" badge: "Opens in 25 min",
 * "Opens at 4:15pm", "Opens tomorrow at 9am" or "Opens Monday at 9am".
 *
 * Null when there is nothing honest to say: the store is open, the vendor
 * has switched it off by hand (`active` false, so the schedule says nothing
 * about when they return), it has no usable schedule, or `now` already
 * falls inside a window, meaning the store opened after the list loaded.
 */
export function opensLabel(
  store: StoreHoursInput,
  now: Date,
): string | null {
  if (store.open !== 0 || isTemporarilyClosed(store)) return null;
  const rows = windows(store.schedules ?? []);
  if (rows.length === 0) return null;

  const { day, seconds } = storeClock(now);

  if (rows.some((w) => w.day === day && w.opens < seconds && seconds < w.closes)) {
    return null;
  }

  let best: { wait: number; offset: number; opens: number } | null = null;
  // Offset 7 is the same weekday next week, for a store that only opens
  // today and has already closed.
  for (let offset = 0; offset <= 7; offset++) {
    const target = (day + offset) % 7;
    for (const w of rows) {
      if (w.day !== target) continue;
      const wait = offset * SECONDS_PER_DAY + w.opens - seconds;
      if (wait <= 0) continue;
      if (!best || wait < best.wait) best = { wait, offset, opens: w.opens };
    }
    if (best) break;
  }
  if (!best) return null;

  const minutes = Math.ceil(best.wait / 60);
  if (minutes < 60) return `Opens in ${minutes} min`;

  const at = formatClock(best.opens);
  if (best.offset === 0) return `Opens at ${at}`;
  if (best.offset === 1) return `Opens tomorrow at ${at}`;
  if (best.offset === 7) return `Opens next ${DAY_NAMES[day]} at ${at}`;
  return `Opens ${DAY_NAMES[(day + best.offset) % 7]} at ${at}`;
}
