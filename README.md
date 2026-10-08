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
│       │   ├── components/    # Design system UI components & overlays
│       │   │   └── ui/        # 21 typed, accessible components & tests
│       │   ├── hooks/         # useReducedMotion hook
│       │   ├── i18n/          # Translation scaffold (t helper)
│       │   ├── pages/         # BootHub, ComponentShowcase, Login
│       │   ├── portals/       # Lazy-loaded portal shells
│       │   │   ├── waiter/    # Phone bottom-nav / tablet rail
│       │   │   ├── kitchen/   # Full-screen KDS, live clock, Rush Mode
│       │   │   └── owner/     # Desktop sidebar / mobile summary tabs
│       │   ├── stores/        # Zustand stores (theme, connection, kitchen, toast)
│       │   ├── App.tsx        # Route tree with lazy portals & auth gate
│       │   ├── main.tsx       # Root entrypoint with TanStack Query provider
│       │   └── index.css      # Design tokens (4-pt grid, kitchen scale, dark mode)
│       ├── tailwind.config.ts # Tailwind CSS with semantic tokens
│       └── vite.config.ts     # Vite bundler with VitePWA plugin & dev proxy
├── e2e/                       # Playwright responsive (390/820/1440px) & Axe tests
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

### 📱 Portal Shells & Routes

- **`/`**: Portal Hub & diagnostics dashboard.
- **`/waiter`**: Mobile-first waiter station with bottom nav (phone) and left rail (tablet), table grid, item cards, and order sheets.
- **`/kitchen`**: KDS high-contrast dark mode with +25% typography scale, digital clock, live orders, bump buttons, and Rush Mode state toggle.
- **`/owner`**: Executive console with desktop sidebar and mobile summary tabs, revenue KPIs, AI insights, sortable data table, and export dialog.
- **`/dev/components`**: Interactive design system sandbox and documentation for all 21 components.
- **`/login`**: Static authentication screen with visible "Phase 2" placeholder note.

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

### 4. Run Database Migrations & Seed Initial Owner

Run the schema migrations (creates `restaurants`, `roles`, `permissions`, `role_permissions`, `users`, `refresh_tokens`, `audit_logs`, and `_migrations` tracking table):

```bash
pnpm db:migrate
```

Seed the default roles (`OWNER`, `WAITER`, `KITCHEN`, `MANAGER`, `CASHIER`), 25 system permissions, permission matrix, and the initial owner user:

```bash
# Set SEED_OWNER_USERNAME and SEED_OWNER_PASSWORD in your .env
pnpm --filter @restaurant-os/api db:seed
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

- **Web App**: [http://localhost:5173](http://localhost:5173) (Restaurant OS Diagnostics Boot Page & Portals)
- **API Server**: [http://localhost:4000](http://localhost:4000)
  - `GET /health` -> `{ status: "ok", db: "connected", timestamp: "...", uptime: 1.2 }`
  - `POST /auth/login` -> Password & quick PIN login with rotating refresh tokens
  - `GET /me` -> Current authenticated session details
  - `GET /staff`, `POST /staff`, `PATCH /staff/:id` -> Staff management with last-owner protection
  - `GET /audit-logs` -> Filterable audit event trail

---

## 🔐 Authentication, RBAC & Security Architecture

1. **Dual-Mode Credential Authentication**:
   - **Password Mode**: Owner and Manager accounts log in via username and password (hashed with memory-hard **Argon2id**).
   - **Quick PIN Mode**: Waiters and Kitchen staff authenticate using username and 4–6 digit PINs on shared touch terminals with large 3x4 `PinPad` components and optional haptic feedback.
   - **Lockout Protection**: Accounts are automatically locked for 10 minutes upon 5 consecutive failed login attempts to prevent brute-force attacks.

2. **Token Security**:
   - Short-lived Access Tokens (15 minutes) signed via JWT stored strictly in memory (`useAuthStore`).
   - Long-lived Rotating Refresh Tokens stored as SHA-256 hashes in PostgreSQL and transmitted via `httpOnly`, `Secure`, `SameSite=lax` cookies.
   - Non-destructive re-login modal allows staff to resume sessions upon token expiration without losing in-flight state.

3. **Backend Permission Guard & Default-Deny**:
   - Strict `requirePermission(permission)` middleware enforcing granular access rights.
   - Automated `tests/route-registry.test.ts` audit fails CI if any non-public endpoint lacks an explicit permission guard.
   - Role-permission matrix verified via test suite ensuring Waiter and Kitchen tokens receive HTTP `403 FORBIDDEN` when calling management endpoints.

4. **Dynamic Role Extensibility**:
   - `MANAGER` and `CASHIER` roles are seeded directly into the database. Adding custom permissions or creating new roles requires **inserting rows only** into `roles` and `role_permissions` without necessitating code refactoring or schema migrations:
     ```sql
     -- Example: Assigning discount.apply with 15% cap to CASHIER
     INSERT INTO role_permissions (role_id, permission_id, discount_cap_percent)
     SELECT r.id, p.id, 15
     FROM roles r, permissions p
     WHERE r.name = 'CASHIER' AND p.name = 'discount.apply';
     ```

5. **Data Shaping & Privacy**:
   - Per-role serializers (`serializeKitchenOrder`, `serializeOrderForRole`) strip customer PII and price data from kitchen views.

6. **Last-Owner Protection**:
   - Server-side guard prevents deactivating or demoting the last active `OWNER` of a restaurant.

---

## 🧪 Testing, Quality & CI

### Run Unit & Integration Tests

```bash
pnpm test
```

### Run Playwright Responsive & Accessibility Tests

```bash
pnpm test:e2e
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
