import request from "supertest";
import app from "../../src/app";
import UserModel from "../../src/schema/User.model";
import VenueModel from "../../src/schema/Venue.model";
import { UserRole } from "../../src/libs/enums/user.enum";

let counter = 0;
export const PASSWORD = "Password123!";

/** a venue straight in the database (ACTIVE by default) */
export async function makeVenue(over: Record<string, unknown> = {}) {
  counter++;
  return VenueModel.create({
    venueName: `Test Venue ${counter}`,
    venueLocation: "Seoul",
    venueType: "SIMULATOR",
    pricePerHour: 30,
    ...over,
  });
}

/** sign a player up through the API and return a logged-in supertest agent (cookie jar) */
export async function signupPlayer(name = "Test Player") {
  counter++;
  const email = `player${counter}@test.dev`;
  const body = { name, email, phone: `010-0000-${String(counter).padStart(4, "0")}`, password: PASSWORD };
  const agent = request.agent(app);
  await agent.post("/user/signup").send(body).expect(201);
  const login = await agent.post("/user/login").send({ email, password: PASSWORD }).expect(200);
  return { agent, email, user: login.body.user, body };
}

/** an admin created directly in the database (the admin signup route is locked in production) */
export async function makeAdmin(email = "admin@test.dev") {
  const bcrypt = require("bcryptjs");
  return UserModel.create({
    name: "Admin",
    email,
    phone: `010-9999-${String(++counter).padStart(4, "0")}`,
    password: await bcrypt.hash(PASSWORD, 4),
    role: UserRole.ADMIN,
  });
}

/** "YYYY-MM-DD" of a KST day computed with Intl, independent of src/libs/utils/kst.ts */
export const kstDay = (offsetDays = 0): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(Date.now() + offsetDays * 86400000)
  );

/** the instant of 00:00 KST of a "YYYY-MM-DD" day */
export const kstMidnight = (day: string): number => Date.parse(`${day}T00:00:00+09:00`);
