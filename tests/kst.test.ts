import { bookingHasEnded } from "../src/libs/utils/booking";
import {
  kstDateString,
  kstDayEnd,
  kstDayStart,
  kstMonthStart,
  kstMonthString,
  kstWeekday,
  parseApiDate,
  parseKstDay,
} from "../src/libs/utils/kst";

const iso = (d: Date | null) => (d ? d.toISOString() : null);

describe("KST day boundaries", () => {
  it("23:30 KST (14:30 UTC) is still the same KST day", () => {
    const d = new Date("2026-11-03T14:30:00Z");
    expect(kstDateString(d)).toBe("2026-11-03");
    expect(iso(kstDayStart(d))).toBe("2026-11-02T15:00:00.000Z");
    expect(iso(kstDayEnd(d))).toBe("2026-11-03T15:00:00.000Z");
  });

  it("the instant 15:00 UTC is already the next KST day", () => {
    expect(kstDateString(new Date("2026-11-03T14:59:59.999Z"))).toBe("2026-11-03");
    expect(kstDateString(new Date("2026-11-03T15:00:00.000Z"))).toBe("2026-11-04");
    expect(iso(kstDayStart(new Date("2026-11-03T15:00:00.000Z")))).toBe("2026-11-03T15:00:00.000Z");
  });

  it("rolls over month and year boundaries in KST", () => {
    expect(kstDateString(new Date("2026-10-31T14:59:59Z"))).toBe("2026-10-31");
    expect(kstDateString(new Date("2026-10-31T15:00:00Z"))).toBe("2026-11-01");
    expect(kstMonthString(new Date("2026-10-31T15:00:00Z"))).toBe("2026-11");
    expect(kstDateString(new Date("2026-12-31T15:00:00Z"))).toBe("2027-01-01");
    expect(kstDateString(new Date("2028-02-28T15:00:00Z"))).toBe("2028-02-29"); // leap day
  });

  it("starts of the month are 00:00 KST on the 1st", () => {
    const now = new Date("2026-11-15T03:00:00Z");
    expect(iso(kstMonthStart(now))).toBe("2026-10-31T15:00:00.000Z");
    expect(iso(kstMonthStart(now, 5))).toBe("2026-05-31T15:00:00.000Z"); // 1 June KST
    expect(kstMonthString(kstMonthStart(now, 5))).toBe("2026-06");
    expect(kstMonthString(kstMonthStart(new Date("2026-01-10T00:00:00Z"), 2))).toBe("2025-11");
  });

  it("weekday is the KST weekday", () => {
    expect(kstWeekday(new Date("2026-11-03T00:00:00Z"))).toBe(2); // Tuesday
    expect(kstWeekday(new Date("2026-11-02T15:00:00Z"))).toBe(2); // 00:00 KST Tuesday
    expect(kstWeekday(new Date("2026-11-02T14:59:00Z"))).toBe(1); // Monday evening KST
  });
});

describe("API date parsing", () => {
  it("YYYY-MM-DD is a KST calendar day", () => {
    expect(iso(parseKstDay("2026-11-03"))).toBe("2026-11-02T15:00:00.000Z");
    expect(iso(parseKstDay("2026-03-01"))).toBe("2026-02-28T15:00:00.000Z");
  });

  it("ISO strings with an offset keep their meaning", () => {
    expect(iso(parseKstDay("2026-11-03T00:00:00+09:00"))).toBe("2026-11-02T15:00:00.000Z");
    expect(iso(parseKstDay("2026-11-03T14:30:00Z"))).toBe("2026-11-02T15:00:00.000Z"); // 23:30 KST
    expect(iso(parseKstDay("2026-11-03T15:30:00Z"))).toBe("2026-11-03T15:00:00.000Z"); // 00:30 KST on the 4th
  });

  it("a date-time without a zone is KST wall-clock, never the machine zone", () => {
    expect(iso(parseApiDate("2026-11-03T20:30"))).toBe("2026-11-03T11:30:00.000Z");
    expect(iso(parseApiDate("2026-11-03T20:30:15"))).toBe("2026-11-03T11:30:15.000Z");
  });

  it("old data stored at UTC midnight still maps to the same calendar day", () => {
    expect(kstDateString(new Date("2026-11-03T00:00:00Z"))).toBe("2026-11-03");
  });

  it("rejects garbage", () => {
    expect(parseKstDay("nope")).toBeNull();
    expect(parseKstDay("")).toBeNull();
    expect(parseKstDay(undefined)).toBeNull();
    expect(parseKstDay(null)).toBeNull();
  });
});

describe("bookingHasEnded (KST wall-clock end time)", () => {
  const booking = { bookingDate: new Date("2026-11-02T15:00:00Z"), endTime: "18:00" }; // 3 Nov KST

  it("ends exactly at 18:00 KST", () => {
    expect(bookingHasEnded(booking, Date.parse("2026-11-03T08:59:59.999Z"))).toBe(false);
    expect(bookingHasEnded(booking, Date.parse("2026-11-03T09:00:00.000Z"))).toBe(true);
  });

  it("24:00 means midnight KST at the end of that day", () => {
    const late = { bookingDate: booking.bookingDate, endTime: "24:00" };
    expect(bookingHasEnded(late, Date.parse("2026-11-03T14:59:59Z"))).toBe(false);
    expect(bookingHasEnded(late, Date.parse("2026-11-03T15:00:00Z"))).toBe(true);
  });

  it("a record stored the old way (UTC midnight) is read as the same KST day", () => {
    const legacy = { bookingDate: new Date("2026-11-03T00:00:00Z"), endTime: "18:00" };
    expect(bookingHasEnded(legacy, Date.parse("2026-11-03T08:59:59Z"))).toBe(false);
    expect(bookingHasEnded(legacy, Date.parse("2026-11-03T09:00:00Z"))).toBe(true);
  });

  it("is false for malformed end times", () => {
    expect(bookingHasEnded({ bookingDate: booking.bookingDate, endTime: "soon" }, Date.now())).toBe(false);
  });
});
