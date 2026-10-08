# Restaurant OS — Monorepo

Production-grade foundation for the Restaurant Operating System monorepo, built with Fastify, Vite + React PWA, Drizzle ORM, and PostgreSQL.

---

## 🏗️ Architecture & Folder Map

```
restaurant-os/
├── .github/
│   └── workflows/
│       └── ci.yml             # GitHub Actions CI (lint, typecheck, test, build)
├── .husky/
│   └── pre-commit             # Git pre-commit hook (lint-staged + typecheck)
├── apps/
│   ├── api/                   # Fastify backend service
│   │   ├── src/
│   │   │   ├── config/        # Zod environment variable validation
│   │   │   ├── db/            # Drizzle ORM connection, schema, and migrations
│   │   │   ├── plugins/       # CORS, Helmet, Rate Limiting, Error Handling
│   │   │   ├── routes/        # GET /health, GET /version
│   │   │   ├── server.ts      # Fastify instance builder with Pino logger
│   │   │   └── index.ts       # Entrypoint with graceful shutdown
│   │   ├── tests/             # Vitest API test suite
│   │   ├── Dockerfile         # Multi-stage production container
│   │   └── drizzle.config.ts  # Drizzle Kit CLI configuration
│   └── web/                   # Vite + React + PWA frontend
│       ├── public/            # Static assets, Web App Manifest & SW stub
│       ├── src/
│       │   ├── api/           # Typed API fetch client
│       │   ├── stores/        # Zustand application store scaffolding
│       │   ├── App.tsx        # Restaurant OS boot & diagnostics page
│       │   ├── main.tsx       # Root entrypoint with TanStack Query provider
│       │   └── index.css      # Accessible, high-contrast dashboard styling
│       ├── index.html         # HTML template
│       └── vite.config.ts     # Vite bundler with VitePWA plugin & dev proxy
├── packages/
│   └── shared/                # Universal code shared across api and web
│       └── src/
│           ├── errors/        # AppError class, standardized ErrorCodes & types
│           ├── id/            # RFC 9562 UUIDv7 generator, validator, extractor
│           ├── money/         # Paise <-> INR conversions, en-IN formatting
│           ├── permissions/   # Granular permission constants
│           └── schemas/       # Zod schemas for restaurants, users, audit logs
├── docker-compose.yml         # Local PostgreSQL 16 container definition
├── playwright.config.ts       # End-to-end testing configuration
├── pnpm-workspace.yaml        # Workspace configuration
└── tsconfig.base.json         # Base TypeScript configuration (Strict Mode)
```

---

## ⚡ Quick Start

### 1. Prerequisites

- **Node.js**: `v20.x` or higher
- **pnpm**: `v12.x` or higher (`corepack enable && corepack prepare pnpm@latest --activate`)
- **PostgreSQL**: Local PostgreSQL running or Docker Compose (`docker compose up -d`)

### 2. Environment Setup

Copy the environment file:

```bash
cp .env.example .env
```

Ensure your `DATABASE_URL` in `.env` is set correctly:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/restaurant_os
```

### 3. Install Dependencies

```bash
pnpm install
```

### 4. Run Database Migrations

Run the initial schema migration (creates `restaurants`, `users`, `audit_logs`, and `_migrations` tracking table):

```bash
pnpm db:migrate
```

To revert the latest migration:

```bash
pnpm db:migrate:down
```

### 5. Start Development Servers

Run both API and Web concurrently:

```bash
pnpm dev
```

- **Web App**: [http://localhost:5173](http://localhost:5173) (Restaurant OS Diagnostics Boot Page)
- **API Server**: [http://localhost:4000](http://localhost:4000)
  - `GET /health` -> `{ status: "ok", db: "connected", timestamp: "...", uptime: 1.2 }`
  - `GET /version` -> `{ name: "@restaurant-os/api", version: "0.1.0", environment: "development", uptime: 1.2 }`

---

## 🧪 Testing, Quality & CI

### Run Unit & Integration Tests

```bash
pnpm test
```

### Type Checking (Strict Mode across all workspaces)

```bash
pnpm typecheck
```

### Linting & Formatting

```bash
pnpm lint
pnpm format:check
# Auto-fix:
pnpm lint:fix
pnpm format
```

### Build Everything

```bash
pnpm build
```

---

## 📋 Core Architectural Conventions

1. **Monetary Values**:
   - All currency values in the database, API payloads, and state are integers representing **paise** (1 INR = 100 paise).
   - Never store or calculate money in floating-point rupees.
   - Use `formatPaiseToRupeeString(paise)` from `@restaurant-os/shared` for locale-aware Indian Rupee formatting (`₹1,23,456.78`).

2. **Primary Keys & Identifiers**:
   - Time-ordered **UUIDv7** (`RFC 9562`) is used for primary keys across all tables, ensuring sequential B-tree indexing performance with distributed generation capability.
   - Use `generateUuidV7()` from `@restaurant-os/shared`.

3. **Error Handling**:
   - Central Fastify error handler uniformly catches and returns `{ error: { code, message, requestId, details? } }`.
   - Zod validation errors automatically map to HTTP `400` with code `VALIDATION_ERROR`.
   - All requests receive an `x-request-id` header (either propagated or generated via UUIDv7) for end-to-end tracing.

4. **Security & Performance**:
   - Helmet headers pre-configured for CSP and modern transport security.
   - Conservative rate limiter active by default (100 req/min).
   - Graceful shutdown handles `SIGINT` and `SIGTERM` by draining connections cleanly.
