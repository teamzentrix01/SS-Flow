# SS-Steel-Flow

Steel manufacturing ERP for one plant: sales-driven utensil orders, MRP, purchasing, inventory ledger, production jobs, quality, and dispatch. Domain logic lives under `src/modules/` (modular monolith).

## Stack

Next.js, TypeScript, Tailwind, PostgreSQL, Prisma. The app runs with `npm run dev` against the local database `SS-Flow`.

## Setup

1. PostgreSQL must already be running locally.
2. Copy `.env.example` to `.env` and set the password if your `postgres` user has one:

```text
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/SS-Flow"
```

3. Install, migrate, and seed:

```text
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Open http://localhost:3000.

## Demo logins

Every seeded user uses the password `SteelFlow#2026`.

- admin@ssflow.local
- sales@ssflow.local
- purchase@ssflow.local
- supervisor@ssflow.local
- operator@ssflow.local
- qc@ssflow.local

Demo rows are flagged `is_demo`.

## Golden path

1. Purchase desk creates a purchase order and approves it.
2. Receive the coil. It lands in QC hold.
3. Quality passes the incoming inspection. Stock becomes available.
4. Production creates an order for slit coil and releases it. The source coil is reserved.
5. Supervisor assigns the slitting job to the operator, Slitter 1, and the die.
6. Operator starts, enters quantities, and submits.
7. Quality passes the in-process inspection.
8. Supervisor approves. Output, scrap, and the parent-child batch link are posted.
9. Quality passes the final inspection. Finished stock can be dispatched.

A second finish job stays locked until the slitting job is approved.

## Tests

```text
npm test
```
