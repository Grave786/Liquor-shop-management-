# Inventory & Sales Pro (Liquor Shop Management)

A full-stack inventory + sales management app with multi-outlet support and role-based access control.

## Features

- Role-based auth (JWT): `super_admin`, `admin`, `manager`, `user`, `terminal`
- Multi-outlet management (create/update/delete outlets)
- Products catalog (CRUD)
- Per-outlet inventory tracking + low-stock alerts (dashboard)
- Sales (creates a sale and decrements inventory in a DB transaction)
- Stock transfers between outlets (pending -> completed/cancelled)

## Tech Stack

- Frontend: React + Vite + Tailwind CSS
- Backend: Express (TypeScript) + Mongoose
- Database: MongoDB
- Auth: JSON Web Tokens + bcrypt

## Getting Started

### Prerequisites

- Node.js 18+ (recommended)
- A MongoDB database (local or Atlas)

### Setup

1) Install dependencies:

```bash
npm install
```

2) Create your `.env` file:

```bash
copy .env.example .env
```

3) Update `.env` values (especially `MONGO_URI` and `JWT_SECRET`).

### Run (Dev)

Starts the Express API and runs Vite in middleware mode on the same server.

```bash
npm run dev
```

Then open `http://localhost:3000`.

## Environment Variables

See `.env.example` for the full list.

- `MONGO_URI`: Mongo connection string
- `JWT_SECRET`: secret used to sign auth tokens
- `PORT`: server port (default `3000`)
- `NODE_ENV`: `development` or `production`
- `GEMINI_API_KEY`: optional (wired in `vite.config.ts`, not required unless you add Gemini features)

## Default Roles / First Admin

During `/api/auth/register`, the email `chungledurgeshchungle@gmail.com` is automatically assigned the `super_admin` role. Everyone else registers as `user` by default.

## API (Quick Reference)

All routes are under `/api` and (except auth) require `Authorization: Bearer <token>`.

- Auth
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `GET /api/auth/me`
- Users
  - `GET /api/users`
  - `POST /api/users`
  - `PATCH /api/users/:id`
- Outlets
  - `GET /api/outlets`
  - `POST /api/outlets`
  - `PATCH /api/outlets/:id`
  - `DELETE /api/outlets/:id`
- Products
  - `GET /api/products`
  - `POST /api/products`
  - `PATCH /api/products/:id`
  - `DELETE /api/products/:id`
- Inventory
  - `GET /api/inventory` (optional `?outletId=...`)
  - `POST /api/inventory`
- Sales
  - `GET /api/sales` (optional `?outletId=...`)
  - `POST /api/sales`
- Transfers
  - `GET /api/transfers`
  - `POST /api/transfers`
  - `PATCH /api/transfers/:id`

## Scripts

- `npm run dev`: start the app (API + UI)
- `npm run build`: build the frontend to `dist/`
- `npm run preview`: preview the frontend build
- `npm run lint`: TypeScript typecheck
- `npm run clean`: delete `dist/`

## Notes

- Don’t commit `.env` files. This repo’s `.gitignore` is configured to ignore `.env*` and keep `.env.example`.
