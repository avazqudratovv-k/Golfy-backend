import mongoose from "mongoose";
import request from "supertest";
import app from "../src/app";
import BookingModel from "../src/schema/Booking.model";
import { clearDb, startDb, stopDb } from "./helpers/db";
import { kstDay, kstMidnight, makeVenue, signupPlayer } from "./helpers/factory";

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

describe(`booking flow on KST days (machine TZ=${process.env.TZ ?? "system default"})`, () => {
  it("stores bookingDate as 00:00 KST and reports the KST date in availability", async () => {
    const venue = await makeVenue();
    const { agent } = await signupPlayer();
    const day = kstDay(1);

    const created = await agent
      .post("/booking/create")
      .send({ venueId: String(venue._id), bookingDate: day, startTime: "20:00", endTime: "22:00" })
      .expect(201);
    expect(created.body.status).toBe("PENDING");
    expect(created.body.price).toBe(60);
    expect(new Date(created.body.bookingDate).getTime()).toBe(kstMidnight(day));

    const avail = await request(app).get(`/venue/${venue._id}/availability`).query({ date: day }).expect(200);
    expect(avail.body.date).toBe(day);
    const free = avail.body.slots.filter((s: any) => s.available).map((s: any) => s.startTime);
    expect(free).not.toContain("20:00");
    expect(free).not.toContain("21:00");
    expect(free).toContain("19:00");
    expect(free).toContain("22:00");
  });

  it("a full ISO instant inside the KST day (23:30 KST) lands on that same KST day", async () => {
    const venue = await makeVenue();
    const { agent } = await signupPlayer();
    const day = kstDay(2);
    const lateEvening = new Date(kstMidnight(day) + (23 * 60 + 30) * 60000).toISOString(); // 23:30 KST

    const res = await agent
      .post("/booking/create")
      .send({ venueId: String(venue._id), bookingDate: lateEvening, startTime: "10:00", endTime: "11:00" })
      .expect(201);
    expect(new Date(res.body.bookingDate).getTime()).toBe(kstMidnight(day));
    const avail = await request(app).get(`/venue/${venue._id}/availability`).query({ date: lateEvening }).expect(200);
    expect(avail.body.date).toBe(day);
  });

  it("rejects overlapping bookings on the same KST day but allows the next day", async () => {
    const venue = await makeVenue();
    const a = await signupPlayer();
    const b = await signupPlayer();
    const day = kstDay(3);
    const book = (who: any, d: string, s: string, e: string) =>
      who.agent.post("/booking/create").send({ venueId: String(venue._id), bookingDate: d, startTime: s, endTime: e });

    await book(a, day, "18:00", "20:00").expect(201);
    await book(b, day, "19:00", "21:00").expect(409);
    await book(b, day, "20:00", "21:00").expect(201); // touching ends do not overlap
    await book(b, kstDay(4), "18:00", "20:00").expect(201);
  });

  it("FINISHED only after the KST end time has passed", async () => {
    const venue = await makeVenue();
    const { agent } = await signupPlayer();

    // tomorrow: cannot finish
    const future = await agent
      .post("/booking/create")
      .send({ venueId: String(venue._id), bookingDate: kstDay(1), startTime: "10:00", endTime: "11:00" })
      .expect(201);
    await agent.post("/booking/update").send({ bookingId: future.body._id, status: "CONFIRMED" }).expect(200);
    await agent.post("/booking/update").send({ bookingId: future.body._id, status: "FINISHED" }).expect(400);

    // yesterday: can finish
    const past = await agent
      .post("/booking/create")
      .send({ venueId: String(venue._id), bookingDate: kstDay(-1), startTime: "10:00", endTime: "11:00" })
      .expect(201);
    await agent.post("/booking/update").send({ bookingId: past.body._id, status: "CONFIRMED" }).expect(200);
    const fin = await agent.post("/booking/update").send({ bookingId: past.body._id, status: "FINISHED" }).expect(200);
    expect(fin.body.status).toBe("FINISHED");
  });

  it("a legacy booking stored at UTC midnight still blocks its calendar day", async () => {
    const venue = await makeVenue();
    const { agent, user } = await signupPlayer();
    const day = kstDay(5);
    await BookingModel.collection.insertOne({
      userId: new mongoose.Types.ObjectId(user._id),
      venueId: venue._id,
      bookingDate: new Date(`${day}T00:00:00Z`),
      startTime: "12:00",
      endTime: "14:00",
      price: 60,
      status: "CONFIRMED",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await agent
      .post("/booking/create")
      .send({ venueId: String(venue._id), bookingDate: day, startTime: "13:00", endTime: "15:00" })
      .expect(409);
    const avail = await request(app).get(`/venue/${venue._id}/availability`).query({ date: day }).expect(200);
    expect(avail.body.slots.find((s: any) => s.startTime === "12:00").available).toBe(false);
    expect(avail.body.slots.find((s: any) => s.startTime === "14:00").available).toBe(true);
  });

  it("rejects a missing or invalid date", async () => {
    const venue = await makeVenue();
    const { agent } = await signupPlayer();
    await agent.post("/booking/create").send({ venueId: String(venue._id), bookingDate: "nope", startTime: "10:00", endTime: "11:00" }).expect(400);
    await request(app).get(`/venue/${venue._id}/availability`).expect(400);
  });
});
