# Golfy backend

API for **Golfy**, an hourly golf-venue booking platform (courses, simulator bays and driving ranges).
One TypeScript codebase serves two apps:

| Server | Entry | Default port | Used by |
| --- | --- | --- | --- |
| User API | `src/server.ts` | `3011` | player app ([golfy-frontend](../golfy-frontend)) |
| Admin API | `src/serverAdmin.ts` | `3012` | admin app ([golfy-admin](../../golfy-admin)) |

Stack: Node, Express 4, TypeScript, MongoDB + Mongoose 6, JWT (httpOnly-less cookie + bearer), bcrypt, multer.

## Architecture

```
src/
  server.ts / serverAdmin.ts   boot + DB connection
  app.ts / appAdmin.ts         express setup (CORS, parsers, uploads, /health)
  router.ts / routerAdmin.ts   route tables
  controllers/                 HTTP layer: parse request, call a service, shape the response
  models/                      services: all business logic (named *.service.ts)
  schema/                      Mongoose models + indexes
  libs/                        enums, types, utils (config, errors, rate limit, uploads, booking time maths)
  seed.ts                      demo data (see below)
scripts/seed-images.py         generates the demo venue pictures
```

Business rules worth knowing:

- **Pricing is server-side**: `price = pricePerHour x hours`; the client never sends a price.
- **Booking state machine**: `PENDING -> CONFIRMED -> FINISHED`, and `PENDING|CONFIRMED -> CANCELLED`.
- **60-minute hold**: an unpaid `PENDING` booking blocks its slot for 60 minutes, then the slot is free again.
- **No overlaps**: `CONFIRMED`, `FINISHED` and live `PENDING` bookings reject overlapping slots (races are re-checked after insert).
- **Reviews**: one per booking, only for your own booking that is `FINISHED` (or `CONFIRMED` and already played). Venue `avgRating`/`reviewCount` are recomputed on every review.
- Days are stored as UTC dates (KST day boundaries are not handled yet).
- The demo "payment" simply sets the booking to `CONFIRMED`.

## Setup

```bash
npm install
cp .env.example .env     # fill MONGO_URL and SECRET_TOKEN
npm run start:dev        # user API  -> http://localhost:3011
npm run start:admin:dev  # admin API -> http://localhost:3012
npm run build            # tsc type-check / compile to dist/
```

### Environment variables

| Name | Required | Purpose |
| --- | --- | --- |
| `MONGO_URL` | yes | MongoDB connection string |
| `SECRET_TOKEN` | yes | JWT signing secret |
| `PORT` / `ADMIN_PORT` | no | server ports (3011 / 3012) |
| `CORS_ORIGINS` | no | comma separated allowed origins. Unset = any origin. Set it in production. |
| `ADMIN_SIGNUP_SECRET` | no | If set, `POST /signup` on the admin API must send it as the `x-admin-secret` header (or `adminSecret` body field). If unset, anyone who can reach the admin API can create an admin, so always set it outside local development. |
| `SEED_ADMIN_PASSWORD` | no | password for the demo admins (default `Admin123!`) |

## Demo data

```bash
npm run seed         # adds demo data, skips what already exists
npm run seed:reset   # removes ONLY demo data (see below), then recreates it
```

Creates 24 venues (Gangnam, Seongsu, Pangyo, Hongdae, Busan, Jeju, Daegu, Incheon ...), 40 players, 2 admins, about 250 bookings
over the last 90 days plus upcoming ones, about 150 reviews, favourites and contact messages. It is deterministic (seeded RNG) and idempotent.
Demo records are recognised by `@seed.golfy.dev` emails and the venue names in `src/seed.ts`; nothing else is touched.
Venue pictures are generated illustrations (`scripts/seed-images.py`, needs `python3` + Pillow) written to `uploads/venues/seed/`.

Demo logins:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@seed.golfy.dev` | `Admin123!` (or `SEED_ADMIN_PASSWORD`) |
| Admin | `admin.hana@seed.golfy.dev` | same |
| Player | `minjun@seed.golfy.dev` | `Password123!` |
| Player | `olivia@seed.golfy.dev` | `Password123!` |

## Endpoints

### User API (port 3011)

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/health` | - | liveness + DB state |
| GET | `/stats` | - | totals for the home page |
| POST | `/user/signup`, `/user/login`, `/user/logout` | - / - / user | rate limited |
| GET, POST | `/user/profile` | user | POST accepts multipart `avatar` |
| GET | `/venue/all` | - | `page, limit, sort(cheap/expensive/popular/rating), search, minPrice, maxPrice, minRating, type`; total in `X-Total-Count` |
| GET | `/venue/top` | - | top 4 by bookings |
| GET | `/venue/:id` | - | |
| GET | `/venue/:id/availability?date=YYYY-MM-DD` | - | hourly slots |
| GET | `/venue/:id/similar` | - | up to 4 |
| GET | `/venue/:id/rating-breakdown` | - | `{ total, average, counts: {1..5} }` |
| POST | `/booking/create` | user | `{ venueId, bookingDate, startTime, endTime }` |
| GET | `/booking/my`, `/booking/:id` | user | `?page&limit&status` |
| POST | `/booking/update` | user | `{ bookingId, status }` |
| POST | `/favorite/toggle` | user | |
| GET | `/favorite/my`, `/favorite/ids` | user | |
| POST | `/review/create` | user | |
| GET | `/review/recent` | - | `?venueId&page&limit` |
| POST | `/message/create` | - | contact form, rate limited |

### Admin API (port 3012)

All routes except signup/login need an admin cookie/token.
List endpoints return a plain array. They are only paged when `page` and/or `limit` is sent, and then the total is in `X-Total-Count`.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health` | |
| POST | `/signup`, `/login`, `/logout` | signup honours `ADMIN_SIGNUP_SECRET` |
| GET | `/dashboard` | KPIs, daily/monthly series, status mix, top venues, latest bookings |
| GET | `/users` | `page, limit, search, role, status` |
| POST | `/users/status` | `{ _id, status }` |
| GET | `/venues` | `page, limit, search, type, status` |
| POST | `/venues/create` | multipart, up to 5 `venueImages` |
| POST | `/venues/update/:id` | multipart; images untouched unless `keepImages`/files are sent |
| POST | `/venues/:id/status` | `{ venueStatus: "ACTIVE" \| "INACTIVE" }`, no re-upload needed |
| GET | `/bookings` | `page, limit, status, venueId, from, to, search` |
| DELETE | `/bookings/:id` | |
| GET | `/messages` | contact inbox, `page, limit, unread=true`; `X-Total-Count`, `X-Unread-Count` |
| POST | `/messages/:id/read` | `{ isRead?: boolean }` (default true) |
| POST | `/messages/read-all` | |

## Not included yet

Korea-time (KST) day boundaries, Toss Payments, tests/CI, Docker, deployment, OpenAPI/Swagger.
