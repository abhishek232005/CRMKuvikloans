# Kuvik Loans CRM

Kuvik Loans is a DSA and loan-distribution CRM. The foundation uses React/Vite/TypeScript and an Express/TypeScript/MySQL/TypeORM API. Phase 2 provides the complete relational data model, migration, and development seed data.

## Setup

1. Create a MySQL database named `kuvik_crm`.
2. Copy `backend/.env.example` to `backend/.env`, then set database credentials, JWT secrets, a 32+ character field-encryption key, and local seed-admin credentials.
3. Copy `frontend/.env.example` to `frontend/.env` if the default API address differs.
4. Run `npm install` from this `crm` directory.
5. Apply the schema and seed the development reference data before starting the API.
6. Run `npm run dev` to start the frontend at `http://localhost:5173` and API at `http://localhost:5000`.

## Commands

- `npm run build` — build both workspaces
- `npm run dev --workspace=@kuvik/frontend` — run frontend
- `npm run dev --workspace=@kuvik/backend` — run API
- `npm run migration:generate --workspace=@kuvik/backend` — generate a TypeORM migration
- `npm run migration:run --workspace=@kuvik/backend` — apply migrations
- `npm run seed --workspace=@kuvik/backend` — idempotently create roles, permissions, Super Admin, products, sources, lender mapping, policy, and commission rule
- `npm run test --workspace=@kuvik/backend` — run foundation utility tests

Create the database first with `CREATE DATABASE kuvik_crm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`. The initial migration creates the full Phase 2 schema. `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` control the development Super Admin and must be changed for any shared environment. Sensitive PAN and bank values are encrypted at rest; Aadhaar is represented only by verification metadata.
