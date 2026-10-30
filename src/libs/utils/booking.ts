// "HH:MM" -> minutes since midnight. Returns null when malformed.
// asEnd: "24:00" and "00:00" are accepted as the end of the day.
export const parseTimeToMinutes = (value: any, asEnd = false): number | null => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(typeof value === "string" ? value.trim() : "");
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (m > 59) return null;
  if (h === 24 && m === 0 && asEnd) return 1440;
  if (h > 23) return null;
  const minutes = h * 60 + m;
  return asEnd && minutes === 0 ? 1440 : minutes;
};

export const startOfUtcDay = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

export const rangesOverlap = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  aStart < bEnd && aEnd > bStart;

// moment the booked slot is over
export const bookingHasEnded = (booking: { bookingDate: Date; endTime: string }): boolean => {
  const end = parseTimeToMinutes(booking.endTime, true);
  if (end === null) return false;
  return Date.now() >= new Date(booking.bookingDate).getTime() + end * 60000;
};
