import mongoose from "mongoose";
import request from "supertest";
import appAdmin from "../src/appAdmin";
import BookingModel from "../src/schema/Booking.model";
import { clearDb, startDb, stopDb } from "./helpers/db";
import { PASSWORD, kstDay, kstMidnight, makeAdmin, makeVenue } from "./helpers/factory";

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

it("groups dashboard days and months in KST (00:30 KST belongs to that KST day, not the UTC day before)", async () => {
  const admin = await makeAdmin();
  const venue = await makeVenue();
  const day = kstDay(-1);
  const createdAt = new Date(kstMidnight(day) + 30 * 60000); // 00:30 KST = 15:30 UTC two calendar days earlier in UTC terms
  await BookingModel.collection.insertOne({
    userId: new mongoose.Types.ObjectId(),
    venueId: venue._id,
    bookingDate: new Date(kstMidnight(day)),
    startTime: "10:00",
    endTime: "11:00",
    price: 30,
    status: "CONFIRMED",
    createdAt,
    updatedAt: createdAt,
  });

  const agent = request.agent(appAdmin);
  await agent.post("/login").send({ email: admin.email, password: PASSWORD }).expect(200);
  const res = await agent.get("/dashboard").expect(200);

  const row = res.body.bookingsByDay.find((d: any) => d.date === day);
  expect(row).toEqual({ date: day, bookings: 1, revenue: 30 });
  expect(res.body.bookingsByDay).toHaveLength(30);
  expect(res.body.bookingsByDay[29].date).toBe(kstDay(0));
  const month = day.slice(0, 7);
  expect(res.body.revenueByMonth).toHaveLength(6);
  expect(res.body.revenueByMonth.find((m: any) => m.month === month).bookings).toBe(1);
});
