import dotenv from "dotenv";
dotenv.config();
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import * as bcrypt from "bcryptjs";
import UserModel from "./schema/User.model";
import VenueModel from "./schema/Venue.model";
import BookingModel from "./schema/Booking.model";
import ReviewModel from "./schema/Review.model";
import FavoriteModel from "./schema/Favorite.model";
import MessageModel from "./schema/Message.model";
import ReviewService from "./models/Review.service";
import { UserRole } from "./libs/enums/user.enum";
import { VenueType } from "./libs/enums/venue.enum";
import { BookingStatus } from "./libs/enums/booking.enum";

/**
 * Demo data for the portfolio site.
 *   npm run seed         adds demo users, venues, bookings, reviews (skips what exists)
 *   npm run seed:reset   removes the demo data first, then adds it again
 * Only records tagged as demo (@seed.golfy.dev emails and the venue names below) are touched.
 */

const SEED_DOMAIN = "@seed.golfy.dev";
const SEED_EMAIL_REGEX = /@seed\.golfy\.dev$/;
const ADMIN_EMAIL = `admin${SEED_DOMAIN}`;
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Admin123!";
const USER_PASSWORD = "Password123!";
const DAY = 24 * 3600 * 1000;

// small deterministic random generator: same demo data on every run
const makeRandom = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const rand = makeRandom(20260101);
const randInt = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T>(list: T[]): T => list[Math.floor(rand() * list.length)];

const USERS = [
  ["Olivia Bennett", "olivia"],
  ["Marcus Lee", "marcus"],
  ["Sofia Alvarez", "sofia"],
  ["Daniel Okafor", "daniel"],
  ["Emma Johansson", "emma"],
  ["Liam Carter", "liam"],
  ["Priya Nair", "priya"],
  ["Noah Fischer", "noah"],
];

const VENUES: {
  name: string;
  location: string;
  price: number;
  type: VenueType;
  desc: string;
}[] = [
  { name: "Emerald Ridge Golf Club", location: "Austin, TX", price: 95, type: VenueType.COURSE, desc: "18 holes through rolling hill country with fast greens and a relaxed clubhouse terrace." },
  { name: "Harborview Links", location: "Seattle, WA", price: 120, type: VenueType.COURSE, desc: "A links-style course along the water. Wind, views and firm fairways." },
  { name: "Pine Hollow Country Club", location: "Atlanta, GA", price: 85, type: VenueType.COURSE, desc: "Tree-lined classic layout, well kept and friendly to every handicap." },
  { name: "Sunset Dunes Golf Resort", location: "Scottsdale, AZ", price: 140, type: VenueType.COURSE, desc: "Desert course with dramatic elevation changes and sunset tee times." },
  { name: "Maple Creek Municipal", location: "Denver, CO", price: 45, type: VenueType.COURSE, desc: "Honest public course with generous fairways. Great value for a weekend round." },
  { name: "Cliffside Greens", location: "Monterey, CA", price: 160, type: VenueType.COURSE, desc: "Ocean cliffs on nine holes. Bring a camera and an extra sleeve of balls." },
  { name: "Birdie Lab Indoor Golf", location: "Chicago, IL", price: 55, type: VenueType.SIMULATOR, desc: "Four launch-monitor bays with 60 famous courses to play, whatever the weather." },
  { name: "Par 72 Simulator Lounge", location: "New York, NY", price: 70, type: VenueType.SIMULATOR, desc: "Private bays with food and drinks service. Ideal for groups and after-work rounds." },
  { name: "Eagle Eye Studio", location: "Boston, MA", price: 60, type: VenueType.SIMULATOR, desc: "Swing analysis, club fitting and a simulator you can book by the hour." },
  { name: "Fairway Loft", location: "Portland, OR", price: 50, type: VenueType.SIMULATOR, desc: "Cozy two-bay loft with a coach on site for quick lessons." },
  { name: "Driving Range Co.", location: "Dallas, TX", price: 25, type: VenueType.RANGE, desc: "Covered and open bays, floodlit until late. Buckets included in the hourly price." },
  { name: "Longshot Practice Park", location: "Orlando, FL", price: 30, type: VenueType.RANGE, desc: "Large short-game area with a bunker practice zone and putting green." },
  { name: "Tee Time Academy", location: "San Diego, CA", price: 35, type: VenueType.RANGE, desc: "Beginner-friendly range with group clinics and rental clubs." },
  { name: "Swing Yard", location: "Nashville, TN", price: 28, type: VenueType.RANGE, desc: "Relaxed outdoor range with target greens at 50, 100 and 150 yards." },
];

const GOOD_COMMENTS = [
  "Fantastic experience, the staff were friendly and the place was spotless.",
  "Booking was easy and the slot was ready exactly on time. Will be back.",
  "Great value for the price. We played with friends and had a blast.",
  "Beautiful setting and well maintained. Highly recommended.",
  "Perfect for a quick session after work. Everything just worked.",
  "Loved the atmosphere, and the facilities are top class.",
  "Came for a lesson and left with a better swing. Fantastic coach.",
  "Smooth check-in and a lovely place to spend an afternoon.",
];
const OK_COMMENTS = [
  "Good overall, a little busy during peak hours but nothing major.",
  "Nice place. Could use a few more spots to rest between holes.",
  "Solid experience. The price is fair for what you get.",
];
const LOW_COMMENTS = [
  "It was fine, but the equipment felt a bit worn.",
  "Decent venue, though we waited longer than expected at the start.",
];
const MESSAGES = [
  ["Hannah Cole", "hannah@seed.golfy.dev", "Do you offer group discounts for corporate events?"],
  ["Tom Rivera", "tom@seed.golfy.dev", "Is there a beginner lesson option at the practice ranges?"],
  ["Aisha Khan", "aisha@seed.golfy.dev", "Loved my first round, thanks! Are you planning more simulator venues?"],
  ["Peter Novak", "peter@seed.golfy.dev", "Can I change my booking date after confirming?"],
];

const startOfUtcDay = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const hhmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

// venue photos: reuse the real images already uploaded to uploads/venues
const loadImages = (): string[] => {
  const dir = path.join(process.cwd(), "uploads/venues");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .filter((f) => !/tiger woods|screenshot/i.test(f))
    .sort()
    .map((f) => `uploads/venues/${f}`);
};

async function reset() {
  const seedUsers = await UserModel.find({ email: SEED_EMAIL_REGEX })
    .select("_id")
    .lean();
  const userIds = seedUsers.map((u: any) => u._id);
  const seedVenues = await VenueModel.find({ venueName: { $in: VENUES.map((v) => v.name) } })
    .select("_id")
    .lean();
  const venueIds = seedVenues.map((v: any) => v._id);

  await ReviewModel.deleteMany({ $or: [{ userId: { $in: userIds } }, { venueId: { $in: venueIds } }] });
  await FavoriteModel.deleteMany({ $or: [{ userId: { $in: userIds } }, { venueId: { $in: venueIds } }] });
  await BookingModel.deleteMany({ $or: [{ userId: { $in: userIds } }, { venueId: { $in: venueIds } }] });
  await MessageModel.deleteMany({ email: SEED_EMAIL_REGEX });
  await VenueModel.deleteMany({ _id: { $in: venueIds } });
  await UserModel.deleteMany({ _id: { $in: userIds } });
  console.log("Removed previous demo data.");
}

async function run() {
  await mongoose.connect(process.env.MONGO_URL as string);
  console.log("Connected to MongoDB");

  if (process.argv.includes("--reset")) await reset();

  /** users **/
  const hash = await bcrypt.hash(USER_PASSWORD, 10);
  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  let admin: any = await UserModel.findOne({ email: ADMIN_EMAIL });
  if (!admin)
    admin = await UserModel.create({
      role: UserRole.ADMIN,
      name: "Golfy Admin",
      email: ADMIN_EMAIL,
      phone: "+1 555 010 0000",
      password: adminHash,
    });

  const users: any[] = [];
  for (let i = 0; i < USERS.length; i++) {
    const [name, handle] = USERS[i];
    const email = `${handle}${SEED_DOMAIN}`;
    let user: any = await UserModel.findOne({ email });
    if (!user)
      user = await UserModel.create({
        name,
        email,
        phone: `+1 555 010 ${String(100 + i).padStart(4, "0")}`,
        password: hash,
      });
    users.push(user);
  }

  /** venues **/
  const images = loadImages();
  const venues: any[] = [];
  for (let i = 0; i < VENUES.length; i++) {
    const v = VENUES[i];
    let venue: any = await VenueModel.findOne({ venueName: v.name });
    if (!venue) {
      const venueImages = images.length
        ? [0, 1, 2].map((k) => images[(i * 3 + k) % images.length])
        : [];
      venue = await VenueModel.create({
        venueName: v.name,
        venueLocation: v.location,
        pricePerHour: v.price,
        venueType: v.type,
        venueDesc: v.desc,
        venueImages,
      });
    }
    venues.push(venue);
  }
  console.log(`Users: ${users.length + 1}, venues: ${venues.length}, images in use: ${images.length}`);

  /** bookings, reviews, favourites, messages (only once) **/
  const userIds = users.map((u) => u._id);
  const existing = await BookingModel.countDocuments({ userId: { $in: userIds } });
  if (existing > 0) {
    console.log("Demo bookings already exist. Run `npm run seed:reset` to rebuild them.");
  } else {
    const now = new Date();
    const today = startOfUtcDay(now);
    const taken = new Map<string, Set<number>>(); // venue|day -> occupied hours
    const bookings: any[] = [];
    let pendingLeft = 3;

    for (let attempt = 0; attempt < 700 && bookings.length < 320; attempt++) {
      // busier venues first, so "popular" and top-venue charts look natural
      const venue = venues[Math.min(venues.length - 1, Math.floor(Math.pow(rand(), 1.6) * venues.length))];
      const offset = randInt(-90, 14);
      const hours = randInt(1, 3);
      const startHour = randInt(7, 20 - hours + 1);

      const day = new Date(today.getTime() + offset * DAY);
      const key = `${venue._id}|${day.toISOString().slice(0, 10)}`;
      const used = taken.get(key) ?? new Set<number>();
      let free = true;
      for (let h = startHour; h < startHour + hours; h++) if (used.has(h)) free = false;
      if (!free) continue;
      for (let h = startHour; h < startHour + hours; h++) used.add(h);
      taken.set(key, used);

      const isPast = offset < 0;
      let status: BookingStatus;
      let createdAt: Date;
      if (isPast) {
        status = rand() < 0.88 ? BookingStatus.FINISHED : BookingStatus.CANCELLED;
        createdAt = new Date(day.getTime() - randInt(1, 7) * DAY + randInt(0, 20) * 3600 * 1000);
      } else {
        const r = rand();
        status = r < 0.85 ? BookingStatus.CONFIRMED : BookingStatus.CANCELLED;
        if (status === BookingStatus.CONFIRMED && pendingLeft > 0 && offset > 0 && rand() < 0.1) {
          status = BookingStatus.PENDING;
          pendingLeft--;
        }
        createdAt =
          status === BookingStatus.PENDING
            ? new Date(now.getTime() - randInt(1, 20) * 60000) // fresh hold
            : new Date(now.getTime() - randInt(0, 12 * 24) * 3600 * 1000);
      }
      if (createdAt > now) createdAt = now;

      bookings.push({
        _id: new mongoose.Types.ObjectId(),
        userId: pick(users)._id,
        venueId: venue._id,
        bookingDate: day,
        startTime: hhmm(startHour * 60),
        endTime: hhmm((startHour + hours) * 60),
        price: venue.pricePerHour * hours,
        status,
        createdAt,
        updatedAt: createdAt,
      });
    }
    // raw insert keeps the spread-out createdAt dates (the charts need them)
    await BookingModel.collection.insertMany(bookings);

    // venue booking counters
    for (const venue of venues) {
      const count = await BookingModel.countDocuments({
        venueId: venue._id,
        status: { $in: [BookingStatus.CONFIRMED, BookingStatus.FINISHED] },
      });
      await VenueModel.updateOne({ _id: venue._id }, { bookingCount: count });
    }

    // reviews for about two thirds of finished bookings
    const reviews: any[] = [];
    for (const b of bookings) {
      if (b.status !== BookingStatus.FINISHED || rand() > 0.66) continue;
      const roll = rand();
      const rating = roll < 0.6 ? 5 : roll < 0.85 ? 4 : roll < 0.95 ? 3 : 2;
      const comment = rating >= 4 ? pick(GOOD_COMMENTS) : rating === 3 ? pick(OK_COMMENTS) : pick(LOW_COMMENTS);
      let createdAt = new Date(b.bookingDate.getTime() + (24 + randInt(0, 96)) * 3600 * 1000);
      if (createdAt > now) createdAt = now;
      reviews.push({
        _id: new mongoose.Types.ObjectId(),
        bookingId: b._id,
        userId: b.userId,
        venueId: b.venueId,
        rating,
        comment,
        createdAt,
        updatedAt: createdAt,
      });
    }
    if (reviews.length) await ReviewModel.collection.insertMany(reviews);

    // favourites
    const favorites: any[] = [];
    for (const user of users) {
      const chosen = new Set<number>();
      while (chosen.size < randInt(2, 4)) chosen.add(randInt(0, venues.length - 1));
      chosen.forEach((i) =>
        favorites.push({
          _id: new mongoose.Types.ObjectId(),
          userId: user._id,
          venueId: venues[i]._id,
          createdAt: now,
          updatedAt: now,
        })
      );
    }
    await FavoriteModel.collection.insertMany(favorites);

    // contact messages
    await MessageModel.insertMany(MESSAGES.map(([name, email, message]) => ({ name, email, message })));

    console.log(`Bookings: ${bookings.length}, reviews: ${reviews.length}, favourites: ${favorites.length}`);
  }

  // ratings on every venue (also fixes venues that existed before ratings were added)
  const reviewService = new ReviewService();
  for (const venue of await VenueModel.find().select("_id").lean())
    await reviewService.recomputeVenueRating((venue as any)._id);
  console.log("Ratings updated.");

  console.log("\nDemo logins:");
  console.log(`  admin  ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}   (admin server)`);
  console.log(`  user   ${USERS[0][1]}${SEED_DOMAIN} / ${USER_PASSWORD}`);

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("Seed failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
