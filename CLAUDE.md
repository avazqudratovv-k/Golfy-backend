# Golfy backend

Portfolio project: hourly golf-venue booking platform. This repo is the API for two apps:
player app `/Users/kenneth/Desktop/golfy-frontend` (talks to port 3011) and admin app `/Users/kenneth/golfy-admin` (port 3012).
See `README.md` for the endpoint table, env vars and demo logins.

## Commands
- `npm run start:dev` user API (3011) · `npm run start:admin:dev` admin API (3012)
- `npm run typecheck` · `npm run lint` · `npm run build` (= `tsc`) · `npm test` (Jest + supertest + in-memory MongoDB, no external DB; also run with `TZ=America/Los_Angeles` and `TZ=Asia/Seoul`)
- `docker compose up --build` local-only stack (Mongo + seed + both APIs); no hosting config exists or should be added
- `npm run seed` / `npm run seed:reset` demo data (reset only removes demo-tagged records)
- Local DB without touching Atlas: `MONGO_URL=mongodb://127.0.0.1:27018/golfy npm run ...` (env vars override `.env`)

## Folder map
`src/controllers` HTTP · `src/models/*.service.ts` business logic · `src/schema` Mongoose · `src/libs` enums/types/utils · `src/seed.ts` · `seed-assets/venues/` tracked WebP photos copied to git-ignored `uploads/` by the seed · `CREDITS.md` · `tests/` · `libs/utils/kst.ts`

## Hard rules
1. Do NOT change architecture or business logic (booking rules, pricing, statuses, auth flow, review rules). Backend work is additive only: new endpoints/fields/files; never change existing response shapes or routes in a breaking way.
2. Keep every existing route, feature and user flow working.
3. Never print or commit secrets or `.env` values.
4. Don't delete user data. The seed may only touch records it tagged as demo (`@seed.golfy.dev` emails, venue names listed in `src/seed.ts`).

## Logo
`docs/brand/` holds the SVG logo set (used in the README); the apps keep their own copy in `public/brand/` (same files). Do not add other logo variants.

## Conventions
- **KST:** the booking day is a KST calendar day stored as 00:00 KST; slot times are KST wall-clock. Use only `libs/utils/kst.ts` (`kstDayStart`, `parseKstDay`, ...) for day maths; never UTC-day helpers or the server's time zone. Dashboard grouping uses `timezone: "Asia/Seoul"`.
- **Auth:** httpOnly cookies via `authCookieOptions()` / `clearCookieOptions()` (env: `COOKIE_SAMESITE`, `COOKIE_SECURE`); the token is never returned in a body. CORS is an allow-list (`CORS_ORIGINS`); unknown origins get no CORS headers. Admin signup honours `ADMIN_SIGNUP_SECRET`; admins cannot block/delete themselves.
- **Prices are won.** Seed `price: 78` means ₩78,000. Error messages stay English (the apps translate them); add new ones to `Message` and to the apps' `apiMessages.ts`.
- Tests: add a supertest case for every new rule; use `tests/helpers/factory.ts` (`kstDay()` computes dates independently of the code under test).

## Out of scope
Deployment/hosting config, AI features, Toss Payments (payment stays simulated).
