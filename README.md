# Inventory & Sales Pro (Liquor Shop Management)

A full-stack inventory + sales management app with multi-outlet support and role-based access control.

## Features

- Role-based auth (JWT): `super_admin`, `admin`, `manager`, `user`, `terminal`
- Managers can create new outlet staff accounts with role `user` only
- Multi-outlet management (create/update/delete outlets)
- Products catalog (CRUD)
- Per-outlet inventory tracking + low-stock alerts (dashboard)
- Sales (creates a sale and decrements inventory in a DB transaction)
- Stock transfers between outlets (pending -> completed/cancelled)

## Tech Stack

- Frontend: React + Vite + Tailwind CSS (`frontend/`)
- Backend: Express (TypeScript) + Mongoose (`backend/`)
- Database: MongoDB
- Auth: JSON Web Tokens + bcrypt

## Getting Started

### Prerequisites

- Node.js 18+ (recommended)
- A MongoDB database (local or Atlas)

### Install

Install dependencies in both packages:

```bash
npm --prefix backend install
npm --prefix frontend install
```

### Environment Variables

Backend env lives in `backend/.env` (copy from `backend/.env.example`).

- `MONGO_URI`: Mongo connection string
- `JWT_SECRET`: secret used to sign auth tokens
- `PORT`: API port (default `3000`)

Frontend env (optional) lives in `frontend/.env` (copy from `frontend/.env.example`).

- `VITE_API_URL`: backend base URL (e.g. `https://api.example.com`). In dev you can omit it because Vite proxies `/api` to `http://localhost:3000`.

## Run (Dev)

In two terminals:

```bash
npm --prefix backend run dev
npm --prefix frontend run dev
```

- API: `http://localhost:3000`
- UI: `http://localhost:5173`

Or from the repo root (runs both):

```bash
npm install
npm run dev
```

## Build (Prod)

```bash
npm --prefix backend run build
npm --prefix frontend run build
```

- Backend output: `backend/dist/`
- Frontend output: `frontend/dist/`

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

## Notes

- Don’t commit `.env` files.
- If you hit a Windows `spawn EPERM` error from `esbuild` during `vite` builds, it can be related to file locking/AV/OneDrive sync. Re-try the build or move the repo out of a synced folder.
