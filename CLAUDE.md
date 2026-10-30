# Golfy backend

Portfolio project: hourly golf-venue booking platform. This repo is the API for two apps:
player app `/Users/kenneth/Desktop/golfy-frontend` (talks to port 3011) and admin app `/Users/kenneth/golfy-admin` (port 3012).
See `README.md` for the endpoint table, env vars and demo logins.

## Commands
- `npm run start:dev` user API (3011) · `npm run start:admin:dev` admin API (3012)
- `npm run build` = `tsc` (type-check; there is no test suite)
- `npm run seed` / `npm run seed:reset` demo data (reset only removes demo-tagged records)
- Local DB without touching Atlas: `MONGO_URL=mongodb://127.0.0.1:27018/golfy npm run ...` (env vars override `.env`)

## Folder map
`src/controllers` HTTP · `src/models/*.service.ts` business logic · `src/schema` Mongoose · `src/libs` enums/types/utils · `src/seed.ts` · `scripts/seed-images.py`

## Hard rules
1. Do NOT change architecture or business logic (booking rules, pricing, statuses, auth flow, review rules). Backend work is additive only: new endpoints/fields/files; never change existing response shapes or routes in a breaking way.
2. Keep every existing route, feature and user flow working.
3. Never print or commit secrets or `.env` values.
4. Don't delete user data. The seed may only touch records it tagged as demo (`@seed.golfy.dev` emails, venue names listed in `src/seed.ts`).

## Out of scope for now
KST day boundaries, Toss Payments, AI features, Korean UI language, tests/CI/Docker, deployment.
