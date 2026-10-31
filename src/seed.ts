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
import { VenueStatus, VenueType } from "./libs/enums/venue.enum";
import { BookingStatus } from "./libs/enums/booking.enum";

/**
 * Demo data for the portfolio site.
 *   npm run seed         adds demo users, venues, bookings, reviews (skips what exists)
 *   npm run seed:reset   removes the demo data first, then adds it again
 * Only records tagged as demo (@seed.golfy.dev emails and the venue names below) are touched.
 * Deterministic: a seeded random generator, so every run builds the same picture
 * (dates are relative to "today").
 */

const SEED_DOMAIN = "@seed.golfy.dev";
const SEED_EMAIL_REGEX = /@seed\.golfy\.dev$/;
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
const weighted = <T>(items: T[], weights: number[]): T => {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
};

/** accounts **/

const ADMINS = [
  ["Golfy Admin", "admin"],
  ["Hana Seo", "admin.hana"],
];

// Korean and international players: [name, email handle]
const USERS: [string, string][] = [
  ["Kim Minjun", "minjun"], ["Lee Seoyeon", "seoyeon"], ["Park Jihoon", "jihoon"],
  ["Choi Yuna", "yuna"], ["Jung Hyunwoo", "hyunwoo"], ["Kang Soyeon", "soyeon"],
  ["Yoon Dohyun", "dohyun"], ["Lim Chaewon", "chaewon"], ["Han Seungmin", "seungmin"],
  ["Shin Haeun", "haeun"], ["Oh Junseo", "junseo"], ["Seo Jiwoo", "jiwoo"],
  ["Bae Taeyang", "taeyang"], ["Song Minseo", "minseo"], ["Hwang Jaeho", "jaeho"],
  ["Ahn Nayeon", "nayeon"], ["Jang Woojin", "woojin"], ["Kwon Sua", "sua"],
  ["Moon Kyungsoo", "kyungsoo"], ["Yang Eunji", "eunji"], ["Baek Sunwoo", "sunwoo"],
  ["Nam Harin", "harin"], ["Ryu Gunwoo", "gunwoo"], ["Hong Yejin", "yejin"],
  ["Olivia Bennett", "olivia"], ["Marcus Lee", "marcus"], ["Sofia Alvarez", "sofia"],
  ["Daniel Okafor", "daniel"], ["Emma Johansson", "emma"], ["Liam Carter", "liam"],
  ["Priya Nair", "priya"], ["Noah Fischer", "noah"], ["Aiko Tanaka", "aiko"],
  ["Lucas Moreau", "lucas"], ["Chloe Nguyen", "chloe"], ["Ethan Brooks", "ethan"],
  ["Mia Rossi", "mia"], ["Arjun Mehta", "arjun"], ["Hannah Weber", "hannah"],
  ["Jack Sullivan", "jack"],
];

/** venues (fictional names, real districts) **/

type SeedVenue = {
  name: string;
  slug: string;
  location: string;
  price: number;
  type: VenueType;
  status?: VenueStatus;
  pop: number; // relative demand, 1 = quiet, 10 = always full
  desc: string;
};
const C = VenueType.COURSE, S = VenueType.SIMULATOR, R = VenueType.RANGE;

const VENUES: SeedVenue[] = [
  { name: "Namhansan Hills Country Club", slug: "namhansan-hills", location: "Gwangju, Gyeonggi", price: 78, type: C, pop: 7, desc: "Eighteen holes folded into the Namhansan foothills. Fast bentgrass greens, tree-lined fairways and a clubhouse terrace that is worth the drive on its own." },
  { name: "Haeundae Ocean Links", slug: "haeundae-ocean-links", location: "Haeundae, Busan", price: 92, type: C, pop: 9, desc: "A links-style course on the Busan coast. The sea breeze decides every club choice, and the last three holes finish with a view of Haeundae Beach." },
  { name: "Jeju Hallasan Golf Resort", slug: "jeju-hallasan", location: "Seogwipo, Jeju", price: 95, type: C, pop: 8, desc: "Volcanic island golf below Hallasan: wide fairways, black-rock hazards and tangerine groves behind the 14th. Tee times run until sunset." },
  { name: "Pangyo Greenfield Golf Club", slug: "pangyo-greenfield", location: "Pangyo, Seongnam", price: 72, type: C, pop: 6, desc: "A short, sharp parkland course twenty minutes from the Pangyo tech valley. Popular for early-morning rounds before the office." },
  { name: "Incheon Bayside Links", slug: "incheon-bayside", location: "Songdo, Incheon", price: 68, type: C, pop: 5, desc: "Flat, windy and honest. Great value for a weekend round with views across Songdo's skyline and the tidal flats." },
  { name: "Daegu Palgongsan Country Club", slug: "daegu-palgongsan", location: "Dong-gu, Daegu", price: 64, type: C, pop: 4, desc: "Mountain course with generous landing areas and a tough par-3 over water. Friendly to every handicap." },
  { name: "Gapyeong Lakeview Golf Club", slug: "gapyeong-lakeview", location: "Gapyeong, Gyeonggi", price: 70, type: C, status: VenueStatus.INACTIVE, pop: 3, desc: "Lakeside nine holes in the Gapyeong valley. Closed for greens renovation, reopening next season." },
  { name: "Yongin Maple Valley Golf", slug: "yongin-maple-valley", location: "Yongin, Gyeonggi", price: 60, type: C, pop: 5, desc: "Autumn is the season here: the back nine is lined with maples. Good practice facilities and a relaxed pace of play." },

  { name: "Gangnam Skyline Golf Lounge", slug: "gangnam-skyline", location: "Gangnam, Seoul", price: 38, type: S, pop: 10, desc: "Private bays on the 22nd floor with launch-monitor accuracy and 80 courses to play. Food and drinks served to your bay." },
  { name: "Seongsu Swing Lab", slug: "seongsu-swing-lab", location: "Seongsu, Seoul", price: 32, type: S, pop: 9, desc: "A converted factory in Seongsu with six bays, a coaching corner and slow-roast coffee. Swing analysis is included." },
  { name: "Hongdae Birdie Bay", slug: "hongdae-birdie-bay", location: "Hongdae, Seoul", price: 28, type: S, pop: 8, desc: "Late-night simulator bays in the middle of Hongdae. Open until 2 a.m. and built for groups." },
  { name: "Pangyo Tee Studio", slug: "pangyo-tee-studio", location: "Pangyo, Seongnam", price: 34, type: S, pop: 6, desc: "Quiet studio for focused practice. Four bays, club fitting on request and a putting mat in every room." },
  { name: "Yeouido Eagle Room", slug: "yeouido-eagle-room", location: "Yeouido, Seoul", price: 36, type: S, pop: 7, desc: "After-work rounds for the Yeouido finance crowd. Corporate packages and a private lounge for eight." },
  { name: "Haeundae Indoor Fairway", slug: "haeundae-indoor-fairway", location: "Haeundae, Busan", price: 26, type: S, pop: 5, desc: "Rainy day? Play Pebble Beach instead. Six bays two minutes from Haeundae station." },
  { name: "Daegu Dongseongro Screen Golf", slug: "daegu-dongseongro", location: "Jung-gu, Daegu", price: 22, type: S, status: VenueStatus.INACTIVE, pop: 3, desc: "Compact screen-golf rooms in downtown Daegu. Temporarily closed while the bays are upgraded." },
  { name: "Itaewon Par Three Bar", slug: "itaewon-par-three", location: "Itaewon, Seoul", price: 33, type: S, pop: 6, desc: "Simulator bays with a craft beer list. Weekend nights are lively, so reserve early." },

  { name: "Seoul Forest Driving Range", slug: "seoul-forest-range", location: "Seongdong, Seoul", price: 16, type: R, pop: 8, desc: "Heated, covered bays beside Seoul Forest. Balls are included and the staff reset your mat between sessions." },
  { name: "Jamsil Riverside Range", slug: "jamsil-riverside", location: "Songpa, Seoul", price: 19, type: R, pop: 7, desc: "Floodlit range on the Han River with 60 bays and a short-game area. A favourite for evening sessions." },
  { name: "Ilsan Lake Park Range", slug: "ilsan-lake-park", location: "Goyang, Gyeonggi", price: 14, type: R, pop: 5, desc: "Open bays overlooking Ilsan Lake Park. Beginner clinics run every Saturday morning." },
  { name: "Incheon Songdo Tee Deck", slug: "songdo-tee-deck", location: "Songdo, Incheon", price: 17, type: R, pop: 4, desc: "Three-storey tee deck with a rooftop putting green. Quiet on weekdays." },
  { name: "Busan Gwangalli Night Range", slug: "gwangalli-night-range", location: "Suyeong, Busan", price: 15, type: R, pop: 6, desc: "Hit balls under the Gwangan Bridge lights. Open late and popular after dinner." },
  { name: "Jeju Aewol Sunset Range", slug: "aewol-sunset-range", location: "Aewol, Jeju", price: 13, type: R, pop: 4, desc: "An open-air range on the island's west coast. The sunset over the water is part of the package." },
  { name: "Suwon Gwanggyo Range", slug: "gwanggyo-range", location: "Yeongtong, Suwon", price: 14, type: R, status: VenueStatus.INACTIVE, pop: 2, desc: "Neighbourhood range near Gwanggyo Lake. Paused for net repairs." },
  { name: "Daejeon Expo Range", slug: "daejeon-expo-range", location: "Yuseong, Daejeon", price: 12, type: R, pop: 3, desc: "Straightforward practice bays with rental clubs and lessons from a resident pro." },
];

// legacy demo venues from the first version of this script (removed on reset)
const LEGACY_VENUE_NAMES = [
  "Emerald Ridge Golf Club", "Harborview Links", "Pine Hollow Country Club", "Sunset Dunes Golf Resort",
  "Maple Creek Municipal", "Cliffside Greens", "Birdie Lab Indoor Golf", "Par 72 Simulator Lounge",
  "Eagle Eye Studio", "Fairway Loft", "Driving Range Co.", "Longshot Practice Park", "Tee Time Academy", "Swing Yard",
];
const SEED_VENUE_NAMES = [...VENUES.map((v) => v.name), ...LEGACY_VENUE_NAMES];

/** review text **/

const REVIEWS: Record<string, { good: string[]; ok: string[]; low: string[] }> = {
  COURSE: {
    good: [
      "Beautifully kept fairways and greens that rolled true. The tee-time flow was perfect.",
      "코스 관리가 정말 잘 되어 있고 직원분들도 친절했어요. 또 올게요!",
      "Great views on the back nine and a relaxed pace. Worth every won.",
      "그린 상태가 훌륭했습니다. 클럽하우스 식사도 만족스러웠어요.",
      "Booked in two minutes and the starter had our group out right on time.",
      "Lovely course for a weekend round with friends. The par-3s are memorable.",
      "날씨도 좋고 코스도 좋고, 최고의 라운딩이었습니다.",
    ],
    ok: [
      "Good course, but the pace of play slowed down around the turn.",
      "코스는 좋은데 주말엔 사람이 많아서 조금 기다렸어요.",
      "Solid value. A few bunkers could use more sand.",
    ],
    low: [
      "Greens were a bit patchy after the rain. Fine for the price, not more.",
      "예약 시간보다 조금 늦게 시작해서 아쉬웠습니다.",
    ],
  },
  SIMULATOR: {
    good: [
      "Launch monitor numbers felt accurate and the bay was spotless. Great for a quick session after work.",
      "시설이 깔끔하고 화면이 선명해서 정말 좋았어요. 친구들이랑 재밌게 쳤습니다.",
      "Loved the atmosphere. Drinks arrived at the bay without us asking twice.",
      "스윙 분석 기능이 유용했어요. 다음에도 예약할게요.",
      "Easy to book, easy to walk in. The staff helped us set up the course in seconds.",
      "Perfect for a rainy evening. We played three rounds in two hours.",
      "분위기도 좋고 룸도 넓어서 단체로 오기 좋아요.",
    ],
    ok: [
      "Nice bays, but the screen calibration was off for the first ten minutes.",
      "가격은 괜찮은데 피크 시간엔 좀 시끄러워요.",
      "Good simulator, limited course list compared to other places.",
    ],
    low: [
      "The mat was worn and the sensor missed a couple of shots.",
      "에어컨이 약해서 조금 더웠어요. 그래도 직원분은 친절했습니다.",
    ],
  },
  RANGE: {
    good: [
      "Clean mats, good balls and a quiet bay at night. Exactly what I wanted.",
      "연습하기 좋은 환경이에요. 조명도 밝고 타석도 넓습니다.",
      "Great value for the hourly price. The yardage markers are easy to read.",
      "초보자도 편하게 칠 수 있었어요. 직원분이 자세도 봐주셨어요.",
      "Booked a slot after work and had the bay ready on arrival. Smooth.",
      "Perfect for short-game practice. I'll be back every week.",
    ],
    ok: [
      "Decent range, a bit crowded on Saturday afternoon.",
      "타석은 좋은데 공이 조금 낡았어요.",
    ],
    low: [
      "Too windy up on the top deck, and a few mats were worn out.",
    ],
  },
};

const MESSAGES: [string, string, string, boolean][] = [
  ["Hannah Cole", `hannah${SEED_DOMAIN}`, "Do you offer group discounts for corporate events at the Yeouido simulator?", false],
  ["박지민", `jimin${SEED_DOMAIN}`, "단체 예약(8명) 시 룸 두 개를 나란히 예약할 수 있을까요?", false],
  ["Tom Rivera", `tom${SEED_DOMAIN}`, "Is there a beginner lesson option at the practice ranges?", true],
  ["Aisha Khan", `aisha${SEED_DOMAIN}`, "Loved my first round in Jeju, thanks! Are you planning more venues in Busan?", true],
  ["Peter Novak", `peter${SEED_DOMAIN}`, "Can I change my booking date after it has been confirmed?", false],
  ["이수민", `sumin${SEED_DOMAIN}`, "결제 후 취소하면 환불은 어떻게 되나요?", false],
];

const startOfUtcDay = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const hhmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

// venue photos: real photographs from Wikimedia Commons, 3 per venue, named <slug>-1..3.jpg (see CREDITS.md)
const IMAGES_PER_VENUE = 3;
const ensureImages = (): void => {
  const dir = path.join(process.cwd(), "uploads/venues/seed");
  const missing = VENUES.filter((v) => !fs.existsSync(path.join(dir, `${v.slug}-${IMAGES_PER_VENUE}.jpg`)));
  if (missing.length)
    console.warn(`Photos missing in uploads/venues/seed for ${missing.length} venues (e.g. ${missing[0].slug}); they will be created with fewer or no pictures.`);
};
const imagesFor = (v: SeedVenue): string[] => {
  return Array.from({ length: IMAGES_PER_VENUE }, (_, i) => `uploads/venues/seed/${v.slug}-${i + 1}.jpg`).filter((p) =>
    fs.existsSync(path.join(process.cwd(), p))
  );
};

// keep the attribution list next to the photos it describes
const writeCredits = () => {
  const src = path.join(process.cwd(), "CREDITS.md");
  const dest = path.join(process.cwd(), "uploads/venues/seed/CREDITS.md");
  if (fs.existsSync(src) && fs.existsSync(path.dirname(dest))) fs.copyFileSync(src, dest);
};

async function reset() {
  const seedUsers = await UserModel.find({ email: SEED_EMAIL_REGEX }).select("_id").lean();
  const userIds = seedUsers.map((u: any) => u._id);
  const seedVenues = await VenueModel.find({ venueName: { $in: SEED_VENUE_NAMES } }).select("_id").lean();
  const venueIds = seedVenues.map((v: any) => v._id);
  const scope = { $or: [{ userId: { $in: userIds } }, { venueId: { $in: venueIds } }] };

  await ReviewModel.deleteMany(scope);
  await FavoriteModel.deleteMany(scope);
  await BookingModel.deleteMany(scope);
  await MessageModel.deleteMany({ email: SEED_EMAIL_REGEX });
  await VenueModel.deleteMany({ _id: { $in: venueIds } });
  await UserModel.deleteMany({ _id: { $in: userIds } });
  console.log(`Removed previous demo data (${userIds.length} users, ${venueIds.length} venues and their bookings).`);
}

async function run() {
  await mongoose.connect(process.env.MONGO_URL as string);
  console.log("Connected to MongoDB");

  if (process.argv.includes("--reset")) await reset();

  const now = new Date();
  const today = startOfUtcDay(now);

  /** users **/
  const hash = await bcrypt.hash(USER_PASSWORD, 10);
  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const admins: any[] = [];
  for (let i = 0; i < ADMINS.length; i++) {
    const [name, handle] = ADMINS[i];
    const email = `${handle}${SEED_DOMAIN}`;
    let admin: any = await UserModel.findOne({ email });
    if (!admin)
      admin = await UserModel.create({
        role: UserRole.ADMIN,
        name,
        email,
        phone: `+82 10-9000-${String(i).padStart(4, "0")}`,
        password: adminHash,
        createdAt: new Date(now.getTime() - 120 * DAY),
      });
    admins.push(admin);
  }

  const users: any[] = [];
  for (let i = 0; i < USERS.length; i++) {
    const [name, handle] = USERS[i];
    const email = `${handle}${SEED_DOMAIN}`;
    let user: any = await UserModel.findOne({ email });
    // sign-ups spread over the last ~110 days, a little denser recently
    const joined = new Date(now.getTime() - Math.floor(110 * Math.pow(rand(), 1.4)) * DAY - randInt(0, 20) * 3600 * 1000);
    if (!user) {
      const phone =
        i < 24
          ? `+82 10-${String(2000 + i * 37).padStart(4, "0")}-${String(1000 + i * 113).padStart(4, "0")}`
          : `+1 555 010 ${String(100 + i).padStart(4, "0")}`;
      user = await UserModel.create({ name, email, phone, password: hash, createdAt: joined, updatedAt: joined });
    }
    users.push(user);
  }

  /** venues **/
  ensureImages();
  writeCredits();
  const venues: any[] = [];
  for (let i = 0; i < VENUES.length; i++) {
    const v = VENUES[i];
    let venue: any = await VenueModel.findOne({ venueName: v.name });
    if (!venue)
      venue = await VenueModel.create({
        venueName: v.name,
        venueLocation: v.location,
        pricePerHour: v.price,
        venueType: v.type,
        venueStatus: v.status ?? VenueStatus.ACTIVE,
        venueDesc: v.desc,
        venueImages: imagesFor(v),
        createdAt: new Date(now.getTime() - (100 + i) * DAY),
      });
    venues.push(venue);
  }
  console.log(`Users: ${users.length + admins.length}, venues: ${venues.length}`);

  /** bookings, reviews, favourites, messages (only once) **/
  const userIds = users.map((u) => u._id);
  const existing = await BookingModel.countDocuments({ userId: { $in: userIds } });
  let bookingsTotal = 0, reviewsTotal = 0, favoritesTotal = 0;
  const byStatus: Record<string, number> = {};

  if (existing > 0) {
    console.log("Demo bookings already exist. Run `npm run seed:reset` to rebuild them.");
  } else {
    const taken = new Map<string, Set<number>>(); // venue|day -> occupied hours (non-cancelled only)
    const bookings: any[] = [];
    let pendingLeft = 4;
    const DOW_WEIGHT = [1.5, 0.8, 0.8, 0.9, 1.0, 1.7, 2.0]; // Sun..Sat
    const popularity = venues.map((_, i) => Math.pow(VENUES[i].pop, 1.5));
    const TARGET = 250;

    for (let attempt = 0; attempt < 6000 && bookings.length < TARGET; attempt++) {
      const vi = weighted(venues.map((_, i) => i), popularity);
      const venue = venues[vi];
      const def = VENUES[vi];
      const inactive = def.status === VenueStatus.INACTIVE;

      // more recent days are busier (growth), inactive venues only have history
      const maxOffset = inactive ? -10 : 14;
      const offset = rand() < 0.76 || inactive ? -1 - Math.floor(90 * Math.pow(rand(), 1.25)) : randInt(1, maxOffset);
      if (offset > maxOffset && !inactive) continue;
      const day = new Date(today.getTime() + offset * DAY);
      if (rand() > DOW_WEIGHT[day.getUTCDay()] / 2) continue;

      let hours: number, startHour: number;
      if (def.type === C) {
        hours = weighted([3, 4], [3, 2]);
        startHour = weighted([6, 7, 8, 9, 10, 12, 13], [3, 5, 5, 3, 2, 2, 1]);
      } else if (def.type === S) {
        hours = weighted([1, 2, 3], [4, 4, 1]);
        startHour = weighted([10, 12, 14, 16, 17, 18, 19, 20, 21], [1, 2, 2, 3, 5, 7, 7, 5, 3]);
      } else {
        hours = weighted([1, 2], [5, 2]);
        startHour = weighted([7, 9, 12, 15, 17, 18, 19, 20], [2, 2, 1, 3, 5, 6, 5, 3]);
      }
      if (startHour + hours > 24) continue;

      const isPast = offset < 0;
      let status: BookingStatus;
      let createdAt: Date;
      if (isPast) {
        status = rand() < 0.9 ? BookingStatus.FINISHED : BookingStatus.CANCELLED;
        createdAt = new Date(day.getTime() - randInt(1, 9) * DAY + randInt(0, 20) * 3600 * 1000);
      } else {
        status = rand() < 0.9 ? BookingStatus.CONFIRMED : BookingStatus.CANCELLED;
        if (status === BookingStatus.CONFIRMED && pendingLeft > 0 && rand() < 0.2) {
          status = BookingStatus.PENDING;
          pendingLeft--;
        }
        createdAt =
          status === BookingStatus.PENDING
            ? new Date(now.getTime() - randInt(3, 40) * 60000) // fresh hold, still blocking
            : new Date(now.getTime() - randInt(1, 12 * 24) * 3600 * 1000);
      }
      if (createdAt > now) createdAt = now;

      // cancelled bookings free their slot; everything else must not overlap
      if (status !== BookingStatus.CANCELLED) {
        const key = `${venue._id}|${day.toISOString().slice(0, 10)}`;
        const used = taken.get(key) ?? new Set<number>();
        let free = true;
        for (let h = startHour; h < startHour + hours; h++) if (used.has(h)) free = false;
        if (!free) continue;
        for (let h = startHour; h < startHour + hours; h++) used.add(h);
        taken.set(key, used);
      }

      bookings.push({
        _id: new mongoose.Types.ObjectId(),
        userId: pick(users)._id,
        venueId: venue._id,
        bookingDate: day,
        startTime: hhmm(startHour * 60),
        endTime: hhmm((startHour + hours) * 60),
        price: Math.round(venue.pricePerHour * hours * 100) / 100,
        status,
        createdAt,
        updatedAt: createdAt,
      });
    }
    // raw insert keeps the spread-out createdAt dates (the charts need them)
    await BookingModel.collection.insertMany(bookings);
    bookingsTotal = bookings.length;
    for (const b of bookings) byStatus[b.status] = (byStatus[b.status] ?? 0) + 1;

    // venue booking counters (same rule as the booking service: CONFIRMED + FINISHED)
    for (const venue of venues) {
      const count = await BookingModel.countDocuments({
        venueId: venue._id,
        status: { $in: [BookingStatus.CONFIRMED, BookingStatus.FINISHED] },
      });
      await VenueModel.updateOne({ _id: venue._id }, { bookingCount: count });
    }

    // reviews on finished bookings only, about 150
    const venueType = new Map<string, string>(venues.map((v, i) => [String(v._id), VENUES[i].type]));
    const finished = bookings.filter((b) => b.status === BookingStatus.FINISHED);
    const reviews: any[] = [];
    const chance = Math.min(1, 150 / Math.max(1, finished.length));
    for (const b of finished) {
      if (reviews.length >= 150 || rand() > chance) continue;
      const roll = rand();
      const rating = roll < 0.55 ? 5 : roll < 0.82 ? 4 : roll < 0.94 ? 3 : roll < 0.98 ? 2 : 1;
      const pool = REVIEWS[venueType.get(String(b.venueId)) ?? "COURSE"];
      const comment = rating >= 4 ? pick(pool.good) : rating === 3 ? pick(pool.ok) : pick(pool.low);
      let createdAt = new Date(b.bookingDate.getTime() + (12 + randInt(0, 96)) * 3600 * 1000);
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
    reviewsTotal = reviews.length;

    // favourites: popular venues are saved more often
    const favorites: any[] = [];
    const activeIdx = venues.map((_, i) => i).filter((i) => VENUES[i].status !== VenueStatus.INACTIVE);
    for (const user of users) {
      const chosen = new Set<number>();
      const wanted = randInt(0, 6);
      while (chosen.size < wanted) chosen.add(weighted(activeIdx, activeIdx.map((i) => VENUES[i].pop)));
      chosen.forEach((i) =>
        favorites.push({
          _id: new mongoose.Types.ObjectId(),
          userId: user._id,
          venueId: venues[i]._id,
          createdAt: new Date(now.getTime() - randInt(1, 60) * DAY),
          updatedAt: now,
        })
      );
    }
    if (favorites.length) await FavoriteModel.collection.insertMany(favorites);
    favoritesTotal = favorites.length;

    // contact messages (newest first in the inbox)
    await MessageModel.collection.insertMany(
      MESSAGES.map(([name, email, message, isRead], i) => {
        const at = new Date(now.getTime() - (i * 2 + 1) * DAY);
        return { _id: new mongoose.Types.ObjectId(), name, email, message, isRead, createdAt: at, updatedAt: at };
      })
    );
  }

  // ratings on every venue, through the same service the app uses
  const reviewService = new ReviewService();
  for (const venue of venues) await reviewService.recomputeVenueRating(venue._id);

  const activeVenues = VENUES.filter((v) => v.status !== VenueStatus.INACTIVE).length;
  console.log("\n=== Seed summary ===");
  console.log(`Venues:     ${venues.length} (${activeVenues} active, ${venues.length - activeVenues} inactive)`);
  console.log(`Users:      ${users.length} players, ${admins.length} admins`);
  console.log(`Bookings:   ${bookingsTotal} ${JSON.stringify(byStatus)}`);
  console.log(`Reviews:    ${reviewsTotal}`);
  console.log(`Favourites: ${favoritesTotal}`);
  console.log(`Messages:   ${MESSAGES.length}`);

  console.log("\nDemo logins:");
  console.log(`  admin   admin${SEED_DOMAIN} / ${ADMIN_PASSWORD}   (admin app, port 3012 API)`);
  console.log(`  admin   admin.hana${SEED_DOMAIN} / ${ADMIN_PASSWORD}`);
  console.log(`  player  minjun${SEED_DOMAIN} / ${USER_PASSWORD}`);
  console.log(`  player  olivia${SEED_DOMAIN} / ${USER_PASSWORD}`);

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("Seed failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
