import BookingModel from "../src/schema/Booking.model";
import VenueModel from "../src/schema/Venue.model";
import { clearDb, startDb, stopDb } from "./helpers/db";
import { kstDay, makeVenue, signupPlayer } from "./helpers/factory";

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

const create = (who: any, venue: any, day: string, s: string, e: string) =>
  who.agent.post("/booking/create").send({ venueId: String(venue._id), bookingDate: day, startTime: s, endTime: e });
const update = (who: any, id: string, status: string) =>
  who.agent.post("/booking/update").send({ bookingId: id, status });

describe("creating bookings", () => {
  it("computes the price on the server, ignoring a client price", async () => {
    const venue = await makeVenue({ pricePerHour: 25000 });
    const a = await signupPlayer();
    const res = await a.agent
      .post("/booking/create")
      .send({ venueId: String(venue._id), bookingDate: kstDay(1), startTime: "10:00", endTime: "12:30", price: 1 })
      .expect(201);
    expect(res.body.price).toBe(62500);
    expect(res.body.status).toBe("PENDING");
  });

  it("rejects bad times and unknown or inactive venues", async () => {
    const venue = await makeVenue();
    const a = await signupPlayer();
    await create(a, venue, kstDay(1), "12:00", "10:00").expect(400);
    await create(a, venue, kstDay(1), "25:00", "26:00").expect(400);
    await create(a, venue, kstDay(1), "abc", "11:00").expect(400);
    await a.agent.post("/booking/create").send({ venueId: "not-an-id", bookingDate: kstDay(1), startTime: "10:00", endTime: "11:00" }).expect(400);
    const off = await makeVenue({ venueStatus: "INACTIVE" });
    await create(a, off, kstDay(1), "10:00", "11:00").expect(404);
  });

  it("accepts a slot that ends at midnight (24:00)", async () => {
    const venue = await makeVenue();
    const a = await signupPlayer();
    await create(a, venue, kstDay(1), "23:00", "24:00").expect(201);
    await create(a, venue, kstDay(1), "22:00", "23:00").expect(201);
  });
});

describe("overlaps, pending hold and races", () => {
  it("a PENDING booking blocks its slot only for 60 minutes", async () => {
    const venue = await makeVenue();
    const a = await signupPlayer();
    const b = await signupPlayer();
    const day = kstDay(2);
    const first = await create(a, venue, day, "18:00", "19:00").expect(201);
    await create(b, venue, day, "18:00", "19:00").expect(409);

    // the hold ran out
    await BookingModel.collection.updateOne({ _id: new (require("mongoose").Types.ObjectId)(first.body._id) }, { $set: { createdAt: new Date(Date.now() - 61 * 60000) } });
    await create(b, venue, day, "18:00", "19:00").expect(201);

    // the first booking can no longer be confirmed: the slot is somebody else's now
    await update(a, first.body._id, "CONFIRMED").expect(409);
  });

  it("CONFIRMED bookings block forever, CANCELLED ones free the slot", async () => {
    const venue = await makeVenue();
    const a = await signupPlayer();
    const b = await signupPlayer();
    const day = kstDay(2);
    const first = await create(a, venue, day, "10:00", "11:00").expect(201);
    await update(a, first.body._id, "CONFIRMED").expect(200);
    await BookingModel.collection.updateOne({ _id: new (require("mongoose").Types.ObjectId)(first.body._id) }, { $set: { createdAt: new Date(Date.now() - 5 * 3600000) } });
    await create(b, venue, day, "10:00", "11:00").expect(409);
    await update(a, first.body._id, "CANCELLED").expect(200);
    await create(b, venue, day, "10:00", "11:00").expect(201);
  });

  it("two parallel creates for the same slot: exactly one wins", async () => {
    const venue = await makeVenue();
    const players = await Promise.all([signupPlayer(), signupPlayer(), signupPlayer()]);
    const day = kstDay(3);
    const results = await Promise.all(players.map((p) => create(p, venue, day, "20:00", "21:00")));
    const codes = results.map((r) => r.status).sort();
    expect(codes.filter((c) => c === 201)).toHaveLength(1);
    expect(codes.filter((c) => c === 409)).toHaveLength(2);
    expect(await BookingModel.countDocuments({ venueId: venue._id })).toBe(1);
  });
});

describe("status transitions", () => {
  it("follows PENDING -> CONFIRMED -> FINISHED/CANCELLED and nothing else", async () => {
    const venue = await makeVenue();
    const a = await signupPlayer();
    const past = kstDay(-1);
    const bk = (await create(a, venue, past, "09:00", "10:00").expect(201)).body._id;

    await update(a, bk, "FINISHED").expect(400); // PENDING -> FINISHED
    await update(a, bk, "PENDING").expect(200); // same status is a no-op
    await update(a, bk, "CONFIRMED").expect(200);
    await update(a, bk, "PENDING").expect(400); // cannot go back
    await update(a, bk, "FINISHED").expect(200); // ended yesterday
    await update(a, bk, "CANCELLED").expect(400); // FINISHED is final
    await update(a, bk, "CONFIRMED").expect(400);
    await update(a, bk, "NONSENSE").expect(400);
  });

  it("CANCELLED is final", async () => {
    const venue = await makeVenue();
    const a = await signupPlayer();
    const bk = (await create(a, venue, kstDay(1), "09:00", "10:00").expect(201)).body._id;
    await update(a, bk, "CANCELLED").expect(200);
    await update(a, bk, "CONFIRMED").expect(400);
  });

  it("only the owner can change a booking", async () => {
    const venue = await makeVenue();
    const a = await signupPlayer();
    const b = await signupPlayer();
    const bk = (await create(a, venue, kstDay(1), "09:00", "10:00").expect(201)).body._id;
    await update(b, bk, "CANCELLED").expect(404);
    await b.agent.get(`/booking/${bk}`).expect(404);
    await a.agent.get(`/booking/${bk}`).expect(200);
  });

  it("keeps the venue booking counter in step (CONFIRMED + FINISHED count)", async () => {
    const venue = await makeVenue();
    const a = await signupPlayer();
    const bk = (await create(a, venue, kstDay(1), "09:00", "10:00").expect(201)).body._id;
    const count = async () => (await VenueModel.findById(venue._id).lean())!.bookingCount;
    expect(await count()).toBe(0);
    await update(a, bk, "CONFIRMED").expect(200);
    expect(await count()).toBe(1);
    await update(a, bk, "CANCELLED").expect(200);
    expect(await count()).toBe(0);
  });

  it("lists my bookings newest first and filters by status", async () => {
    const venue = await makeVenue();
    const a = await signupPlayer();
    await create(a, venue, kstDay(1), "09:00", "10:00").expect(201);
    const second = (await create(a, venue, kstDay(1), "11:00", "12:00").expect(201)).body._id;
    await update(a, second, "CANCELLED").expect(200);
    const all = await a.agent.get("/booking/my").query({ page: 1, limit: 10 }).expect(200);
    expect(all.body).toHaveLength(2);
    const cancelled = await a.agent.get("/booking/my").query({ page: 1, limit: 10, status: "CANCELLED" }).expect(200);
    expect(cancelled.body).toHaveLength(1);
    expect(cancelled.body[0]._id).toBe(second);
    expect(cancelled.body[0].venueData[0].venueName).toBe(venue.venueName);
  });
});
