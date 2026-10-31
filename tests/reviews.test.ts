import request from "supertest";
import app from "../src/app";
import VenueModel from "../src/schema/Venue.model";
import { clearDb, startDb, stopDb } from "./helpers/db";
import { kstDay, makeVenue, signupPlayer } from "./helpers/factory";

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

/** a booking by `who` that has been played (yesterday, CONFIRMED) */
async function playedBooking(who: any, venue: any, hour = "10") {
  const created = await who.agent
    .post("/booking/create")
    .send({ venueId: String(venue._id), bookingDate: kstDay(-1), startTime: `${hour}:00`, endTime: `${Number(hour) + 1}:00` })
    .expect(201);
  await who.agent.post("/booking/update").send({ bookingId: created.body._id, status: "CONFIRMED" }).expect(200);
  return created.body._id as string;
}
const review = (who: any, bookingId: string, rating: number, comment = "Great place") =>
  who.agent.post("/review/create").send({ bookingId, rating, comment });

// the rating on the venue is recomputed in the background
async function venueStats(id: any, expectCount: number) {
  for (let i = 0; i < 40; i++) {
    const v = await VenueModel.findById(id).lean();
    if (v!.reviewCount === expectCount) return v!;
    await new Promise((r) => setTimeout(r, 50));
  }
  return (await VenueModel.findById(id).lean())!;
}

describe("who may review", () => {
  it("only after the slot has been played", async () => {
    const venue = await makeVenue();
    const a = await signupPlayer();
    // pending
    const pending = await a.agent.post("/booking/create").send({ venueId: String(venue._id), bookingDate: kstDay(-1), startTime: "08:00", endTime: "09:00" }).expect(201);
    await review(a, pending.body._id, 5).expect(403);
    // confirmed but in the future
    const future = await a.agent.post("/booking/create").send({ venueId: String(venue._id), bookingDate: kstDay(3), startTime: "08:00", endTime: "09:00" }).expect(201);
    await a.agent.post("/booking/update").send({ bookingId: future.body._id, status: "CONFIRMED" }).expect(200);
    await review(a, future.body._id, 5).expect(403);
    // confirmed and ended
    const played = await playedBooking(a, venue, "12");
    await review(a, played, 5).expect(201);
  });

  it("not on somebody else's booking", async () => {
    const venue = await makeVenue();
    const a = await signupPlayer();
    const b = await signupPlayer();
    const booking = await playedBooking(a, venue);
    await review(b, booking, 4).expect(403);
  });

  it("one review per booking", async () => {
    const venue = await makeVenue();
    const a = await signupPlayer();
    const booking = await playedBooking(a, venue);
    await review(a, booking, 5).expect(201);
    const again = await review(a, booking, 3).expect(400);
    expect(again.body.message).toMatch(/already reviewed/i);
  });

  it("validates rating and comment", async () => {
    const venue = await makeVenue();
    const a = await signupPlayer();
    const booking = await playedBooking(a, venue);
    await review(a, booking, 0).expect(400);
    await review(a, booking, 6).expect(400);
    await review(a, booking, 3, "   ").expect(400);
    await a.agent.post("/review/create").send({ bookingId: booking, comment: "no rating" }).expect(400);
    await review(a, booking, 3).expect(201);
  });
});

describe("ratings", () => {
  it("recomputes the venue average and count, and the breakdown endpoint matches", async () => {
    const venue = await makeVenue();
    const a = await signupPlayer();
    const b = await signupPlayer();
    const c = await signupPlayer();
    await review(a, await playedBooking(a, venue, "08"), 5).expect(201);
    await review(b, await playedBooking(b, venue, "10"), 4).expect(201);
    let stats = await venueStats(venue._id, 2);
    expect(stats.reviewCount).toBe(2);
    expect(stats.avgRating).toBe(4.5);

    await review(c, await playedBooking(c, venue, "12"), 2).expect(201);
    stats = await venueStats(venue._id, 3);
    expect(stats.avgRating).toBe(3.7); // (5 + 4 + 2) / 3 = 3.666... rounded to one decimal

    const breakdown = await request(app).get(`/venue/${venue._id}/rating-breakdown`).expect(200);
    expect(breakdown.body.total).toBe(3);
    expect(breakdown.body.counts).toEqual({ "1": 0, "2": 1, "3": 0, "4": 1, "5": 1 });
    expect(breakdown.body.average).toBe(3.7);
  });

  it("recent reviews are public and can be limited to a venue", async () => {
    const venue = await makeVenue();
    const other = await makeVenue();
    const a = await signupPlayer();
    await review(a, await playedBooking(a, venue, "08"), 5, "Loved it").expect(201);
    await review(a, await playedBooking(a, other, "10"), 3, "Fine").expect(201);
    const all = await request(app).get("/review/recent").query({ limit: 10 }).expect(200);
    expect(all.body).toHaveLength(2);
    const one = await request(app).get("/review/recent").query({ venueId: String(venue._id), limit: 10 }).expect(200);
    expect(one.body).toHaveLength(1);
    expect(one.body[0].comment).toBe("Loved it");
  });
});
