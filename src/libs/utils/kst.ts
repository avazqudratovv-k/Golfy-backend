// Korea Standard Time helpers: Asia/Seoul is UTC+9 all year (no DST), so plain arithmetic is exact.
// A booking date is a KST calendar day, stored as the instant of that day's 00:00 KST (= 15:00 UTC the
// day before). Slot times ("HH:MM") are KST wall-clock. Nothing here depends on the machine time zone.

export const KST_TIME_ZONE = "Asia/Seoul";
export const KST_OFFSET_MS = 9 * 3600 * 1000;
export const DAY_MS = 24 * 3600 * 1000;

/** instant of 00:00 KST of the KST calendar day that contains `date` */
export const kstDayStart = (date: Date): Date =>
  new Date(Math.floor((date.getTime() + KST_OFFSET_MS) / DAY_MS) * DAY_MS - KST_OFFSET_MS);

/** instant of 00:00 KST of the next KST day (exclusive end of the day) */
export const kstDayEnd = (date: Date): Date => new Date(kstDayStart(date).getTime() + DAY_MS);

/** "YYYY-MM-DD" of the KST calendar day */
export const kstDateString = (date: Date): string =>
  new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);

/** "YYYY-MM" of the KST calendar month */
export const kstMonthString = (date: Date): string => kstDateString(date).slice(0, 7);

/** 0 = Sunday ... 6 = Saturday, in KST */
export const kstWeekday = (date: Date): number => new Date(date.getTime() + KST_OFFSET_MS).getUTCDay();

/** instant of 00:00 KST on the 1st of the KST month that is `monthsBack` months before `date`'s month */
export const kstMonthStart = (date: Date, monthsBack = 0): Date => {
  const k = new Date(date.getTime() + KST_OFFSET_MS);
  return new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth() - monthsBack, 1) - KST_OFFSET_MS);
};

// date-time without any zone designator, e.g. "2026-11-03T20:30"
const ZONELESS_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

/**
 * Reads an API date as an instant. "YYYY-MM-DD" and ISO strings with an offset/Z mean exactly what they say;
 * an ISO date-time WITHOUT a zone is read as KST wall-clock (not the server's local zone).
 * Returns null when it is not a valid date.
 */
export const parseApiDate = (input: unknown): Date | null => {
  if (input === undefined || input === null || input === "") return null;
  let value: any = input;
  if (typeof value === "string") {
    value = value.trim();
    if (ZONELESS_DATE_TIME.test(value)) value += "+09:00";
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
};

/** the KST calendar day (as its 00:00 KST instant) an API date refers to, or null when invalid */
export const parseKstDay = (input: unknown): Date | null => {
  const d = parseApiDate(input);
  return d ? kstDayStart(d) : null;
};
