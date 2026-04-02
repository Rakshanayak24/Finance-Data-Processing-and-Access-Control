# Finance Dashboard Backend

A production-grade REST API for a multi-role finance dashboard system, built with **Node.js**, **Express**, and **SQLite** (via `better-sqlite3`).

> **API Docs (local):** `http://localhost:3000/api/v1/docs` — fully interactive Swagger UI after running the server.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Tech Stack & Decisions](#tech-stack--decisions)
- [Project Structure](#project-structure)
- [Role & Permission Model](#role--permission-model)
- [API Reference](#api-reference)
- [Design Decisions & Tradeoffs](#design-decisions--tradeoffs)
- [Known Limitations](#known-limitations)
- [Testing](#testing)
- [Assumptions](#assumptions)

---

## Quick Start

### Prerequisites
- Node.js ≥ 18
- npm ≥ 9

### Installation & Run

```bash
# 1. Enter directory
cd finance-dashboard

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Defaults work out of the box — no changes needed for local dev

# 4. Seed the database with test data
npm run seed

# 5. Start dev server (auto-restarts on file changes)
npm run dev

# 6. Run tests
npm test
```

Server starts at **http://localhost:3000**

### Key URLs (no frontend needed — all JSON API)

| URL | What it does |
|-----|-------------|
| `GET http://localhost:3000/health` | Server health check |
| `GET http://localhost:3000/api/v1` | Lists all route groups |
| `GET http://localhost:3000/api/v1/docs` | **Interactive Swagger UI — try all endpoints here** |
| `POST http://localhost:3000/api/v1/auth/login` | Get your access token |
| All other endpoints | Require `Authorization: Bearer <token>` header |

### Test Credentials (after seeding)

| Role     | Email                  | Password       |
|----------|------------------------|----------------|
| Admin    | admin@example.com      | Admin@1234     |
| Analyst  | analyst@example.com    | Analyst@1234   |
| Viewer   | viewer@example.com     | Viewer@1234    |

### How to Use Swagger UI

1. Open `http://localhost:3000/api/v1/docs` in your browser
2. Expand **POST /auth/login** → click **Try it out** → enter credentials → **Execute**
3. Copy the `accessToken` from the response
4. Click the **Authorize 🔒** button (top right) → paste `Bearer <your_token>` → **Authorize**
5. All 🔒 endpoints are now unlocked — click **Try it out** → **Execute** on any route

### Quick Test (PowerShell)

```powershell
# Login and save token
$r = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/login" `
  -Method POST -ContentType "application/json" `
  -Body '{"email":"admin@example.com","password":"Admin@1234"}'
$TOKEN = $r.data.accessToken

# Hit the dashboard
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/dashboard/overview" `
  -Headers @{Authorization="Bearer $TOKEN"} | ConvertTo-Json -Depth 5
```

### Quick Test (curl / bash)

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin@1234"}' \
  | jq -r .data.accessToken)

# Hit the dashboard
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/dashboard/overview | jq .
```

---

## Architecture

```
Request → Express Middleware Stack
             ↓
         Rate Limiter → Helmet → CORS → Body Parser
             ↓
         Route → Auth Middleware (JWT verify)
             ↓
         Authorization Middleware (role + permission check)
             ↓
         Validation Middleware (express-validator)
             ↓
         Controller (thin — only req/res handling)
             ↓
         Service Layer (all business logic lives here)
             ↓
         Database (better-sqlite3, synchronous)
             ↓
         Audit Logger (non-blocking, failure-isolated)
```

The application follows a clean **layered architecture**:

- **Routes** — declare HTTP method + path + middleware chain only
- **Middleware** — auth, authorization, validation, rate limiting
- **Controllers** — parse request, call service, send response (thin by design)
- **Services** — all business logic, DB queries, access rules
- **Config** — database init, constants, permission matrix, environment

Controllers have zero business logic — they are glue between HTTP and the service layer. All decisions (who can do what, what data to return) live in services.

---

## Tech Stack & Decisions

| Concern | Choice | Why |
|---|---|---|
| Runtime | Node.js 20 | Fast I/O, great ecosystem |
| Framework | Express | Minimal, well-understood, easy to test |
| Database | SQLite (better-sqlite3) | Zero setup, synchronous API, WAL mode for reads |
| Auth | JWT access + refresh tokens | Stateless, scalable, refresh rotation for security |
| Passwords | bcryptjs (12 rounds) | Industry-standard adaptive hashing |
| Validation | express-validator | Declarative, composable rule sets |
| Testing | Jest + Supertest | In-memory DB per suite, isolated, fast |
| Security | helmet, cors, rate-limit | Production essentials applied from day one |
| API Docs | OpenAPI 3.0 + Swagger UI | Interactive, self-documenting, try-it-out capable |

---

## Project Structure

```
finance-dashboard/
├── src/
│   ├── app.js                  # Express app setup (no port binding — testable)
│   ├── server.js               # Entry point: DB init + listen + graceful shutdown
│   ├── config/
│   │   ├── database.js         # SQLite init, WAL mode, all migrations
│   │   └── constants.js        # Roles, PERMISSIONS matrix, categories, pagination
│   ├── middleware/
│   │   ├── auth.js             # authenticate(), authorize(), selfOrAdmin()
│   │   ├── validators.js       # All express-validator rule sets
│   │   ├── rateLimiter.js      # General API + strict auth limiter
│   │   └── errorHandler.js     # Global error handler + 404 handler
│   ├── services/               # ALL business logic lives here
│   │   ├── authService.js      # Register (role enforcement), login, refresh, logout
│   │   ├── userService.js      # User CRUD + role/status enforcement
│   │   ├── recordService.js    # Financial record CRUD + dynamic filtering
│   │   ├── dashboardService.js # All aggregation + analytics queries
│   │   └── auditService.js     # Audit log writes + reads
│   ├── controllers/            # Thin — request parsing + response sending only
│   │   ├── authController.js
│   │   ├── userController.js
│   │   ├── recordController.js
│   │   ├── dashboardController.js
│   │   └── auditController.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── userRoutes.js
│   │   ├── recordRoutes.js
│   │   ├── dashboardRoutes.js
│   │   ├── auditRoutes.js
│   │   └── docsRoutes.js       # Swagger UI served at /api/v1/docs
│   └── utils/
│       ├── response.js         # sendSuccess(), sendError(), pagination helpers
│       └── logger.js           # Structured JSON logger
├── tests/
│   ├── helpers.js              # In-memory DB setup, user/record factories
│   ├── auth.test.js            # 14 tests: register, login, refresh, me
│   ├── users.test.js           # 13 tests: CRUD, role access, self vs admin
│   ├── records.test.js         # 18 tests: CRUD, filters, soft delete, restore
│   └── dashboard.test.js       # 11 tests: analytics, role gating
├── scripts/
│   └── seed.js                 # Realistic 200-record seed dataset (3 users)
├── docs/
│   └── openapi.yaml            # Full OpenAPI 3.0 spec (also served at /api/v1/docs)
├── data/                       # SQLite DB files (auto-created on first run)
├── .env.example                # Environment variable template — copy to .env
└── package.json
```

> **Note on `data/` directory:** The `data/finance.db` file is git-ignored in production. It is auto-created when you run `npm run seed`. The directory is included in the repo so the folder exists, but the database file itself should never be committed.

---

## Role & Permission Model

Three roles with a clear, centrally-enforced permission matrix defined in `src/config/constants.js`:

| Permission             | Viewer | Analyst | Admin |
|------------------------|:------:|:-------:|:-----:|
| View records           | ✅     | ✅      | ✅    |
| View dashboard         | ✅     | ✅      | ✅    |
| View recent activity   | ✅     | ✅      | ✅    |
| View analytics/trends  | ❌     | ✅      | ✅    |
| Create records         | ❌     | ✅      | ✅    |
| Update records         | ❌     | ✅      | ✅    |
| Delete/restore records | ❌     | ❌      | ✅    |
| List all users         | ❌     | ❌      | ✅    |
| Manage users           | ❌     | ❌      | ✅    |
| View audit logs        | ❌     | ❌      | ✅    |
| Edit own profile       | ✅     | ✅      | ✅    |

Permissions are enforced via the `authorize(permission)` middleware which checks the `PERMISSIONS` map in `constants.js`. Adding a new role or changing a permission is a **single-line change** in one file — no `if (role === 'admin')` scattered across controllers.

**Data scoping:** Admins see data for all users in dashboard queries. Analysts and Viewers see only their own records. This is enforced in `dashboardService.resolveUserScope()`.

**Registration security:** Public registration always assigns `role = 'viewer'`, regardless of what is sent in the body. Only an authenticated admin can create accounts with elevated roles. This prevents privilege escalation via the API.

---

## API Reference

All responses use a consistent envelope:

```json
{
  "success": true,
  "message": "Human-readable message",
  "data": { ... },
  "meta": { "pagination": { "page": 1, "limit": 20, "total": 150, "totalPages": 8, "hasNextPage": true } }
}
```

Error responses:
```json
{
  "success": false,
  "message": "What went wrong",
  "errors": [ { "field": "email", "message": "Must be valid", "value": "bad-input" } ]
}
```

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/register` | Public | Create account (role always defaults to viewer) |
| POST | `/api/v1/auth/login` | Public | Returns accessToken + refreshToken |
| POST | `/api/v1/auth/refresh` | Public | Rotate refresh token, get new pair |
| GET  | `/api/v1/auth/me` | 🔒 Any | Current user profile |
| POST | `/api/v1/auth/logout` | 🔒 Any | Revoke current refresh token |
| POST | `/api/v1/auth/logout-all` | 🔒 Any | Revoke all sessions |

**Login response:**
```json
{
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": { "id": "...", "name": "Alice Admin", "role": "admin" }
  }
}
```

### Users

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET    | `/api/v1/users` | 🔒 Admin | List users — query: `page, limit, role, status, search` |
| GET    | `/api/v1/users/:id` | 🔒 Self/Admin | Get user by ID |
| PATCH  | `/api/v1/users/:id` | 🔒 Self/Admin | Update name/password (role/status: Admin only) |
| DELETE | `/api/v1/users/:id` | 🔒 Admin | Soft-delete user (cannot delete self) |

### Financial Records

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET    | `/api/v1/records` | 🔒 All | Paginated + filtered list |
| GET    | `/api/v1/records/:id` | 🔒 All | Single record |
| POST   | `/api/v1/records` | 🔒 Analyst/Admin | Create record |
| PATCH  | `/api/v1/records/:id` | 🔒 Analyst/Admin | Update record |
| DELETE | `/api/v1/records/:id` | 🔒 Admin | Soft delete |
| POST   | `/api/v1/records/:id/restore` | 🔒 Admin | Restore soft-deleted record |

**Record filters (query params):** `type`, `category`, `startDate`, `endDate`, `minAmount`, `maxAmount`, `search`, `tags`, `sortBy`, `order`, `page`, `limit`

**Create body:**
```json
{
  "amount": 4500.00,
  "type": "expense",
  "category": "food",
  "date": "2024-06-15",
  "description": "Team lunch",
  "tags": ["work", "food"]
}
```

### Dashboard & Analytics

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/dashboard/overview` | 🔒 All | Full dashboard in one call |
| GET | `/api/v1/dashboard/summary` | 🔒 All | Totals + net balance |
| GET | `/api/v1/dashboard/recent-activity` | 🔒 All | Latest N transactions |
| GET | `/api/v1/dashboard/categories` | 🔒 Analyst/Admin | Category breakdown with income/expense split |
| GET | `/api/v1/dashboard/trends/monthly` | 🔒 Analyst/Admin | Monthly income vs expense trends |
| GET | `/api/v1/dashboard/trends/weekly` | 🔒 Analyst/Admin | Weekly income vs expense trends |
| GET | `/api/v1/dashboard/top-categories` | 🔒 Analyst/Admin | Top spending categories |

**Overview response shape:**
```json
{
  "summary": { "totalIncome": 50000, "totalExpenses": 7000, "netBalance": 43000, "totalRecords": 42 },
  "categoryBreakdown": [ { "category": "food", "expense": { "total": 5000, "count": 12 } } ],
  "monthlyTrends": [ { "month": "2024-06", "income": 50000, "expense": 7000, "netBalance": 43000 } ],
  "topCategories": [ { "category": "food", "total": 5000, "count": 12 } ],
  "recentActivity": [ { "amount": 1200, "type": "expense", "category": "transport", "date": "2024-06-14" } ],
  "dailyAverages": { "avgDailyIncome": 1666.67, "avgDailyExpense": 233.33 }
}
```

### Audit Logs

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/audit` | 🔒 Admin | Paginated logs with user info — query: `userId, resource, action` |

**Sample log entry:**
```json
{
  "id": "...",
  "user_name": "Alice Admin",
  "action": "CREATE_RECORD",
  "resource": "financial_records",
  "details": { "amount": 4500, "type": "expense", "category": "food" },
  "ip_address": "::1",
  "created_at": "2024-06-15T10:30:00.000Z"
}
```

---

## Design Decisions & Tradeoffs

**SQLite over Postgres/MySQL** — Zero setup, synchronous API, WAL mode for concurrent reads. For production with many concurrent writers, the service layer abstracts the DB so migrating to Postgres would be a schema migration, not a rewrite.

**Soft Delete for records and users** — Records and users are soft-deleted (`is_deleted = 1`) rather than hard-deleted. This preserves the financial audit trail, allows restoration, and is standard practice in financial systems. Deleting a user no longer cascades to their financial records.

**JWT Refresh Token Rotation** — Every refresh rotates the token: the old one is revoked immediately. This limits the damage window if a token is stolen. All tokens are stored in the DB so `logout-all` is possible.

**Permission Matrix over scattered role checks** — A central `PERMISSIONS` map in `constants.js` owns all access decisions. `authorize('records:create')` in the route is the only place a permission is referenced. Adding a new role means one object change — no controller edits needed.

**Audit log failure isolation** — Audit writes are wrapped in try/catch. A logging failure logs an error but never fails the request. A logging outage should never break a financial transaction.

**Admin data scope in service layer** — `dashboardService.resolveUserScope()` is the single function that decides whether a user sees all data or just their own. Business rules belong in services, not controllers.

**Composite DB indexes** — Three composite indexes cover the real query patterns: `(user_id, is_deleted, date)` for user + date range filters, `(is_deleted, type)` for dashboard aggregations, and `(is_deleted, category)` for category breakdowns. These eliminate full table scans on the most expensive queries.

**Swagger UI served at runtime** — The OpenAPI spec at `docs/openapi.yaml` is served interactively at `/api/v1/docs`. No separate documentation step needed — start the server and the docs are live.

---

## Known Limitations

- **Single-process only** — `better-sqlite3` is synchronous and not suited for multi-process deployments. Migrate to Postgres for horizontal scaling.
- **No email verification** — registration is open; production would require email confirmation before activation.
- **In-process rate limiting** — `express-rate-limit` state is in-memory and resets on restart. Use Redis for distributed rate limiting in production.
- **JWT secret in .env** — ensure `JWT_SECRET` is set to a long random value in production and never committed to version control.
- **Single currency** — no multi-currency support. All amounts are assumed to share the same unit.

---

## Testing

```bash
npm test               # Run all 56 tests
npm run test:coverage  # With coverage report
```

Tests use an **in-memory SQLite database** — each suite gets a fresh isolated DB via `beforeEach`. No network calls, no filesystem side effects, no test order dependencies.

**Test coverage:**
- `auth.test.js` — register, login, refresh tokens, me endpoint, token edge cases (14 tests)
- `users.test.js` — list, get, update, delete, role-based access, self vs admin (13 tests)
- `records.test.js` — CRUD, filtering, soft delete, restore, permission enforcement (18 tests)
- `dashboard.test.js` — all analytics endpoints, role gating (11 tests)

**Result: 56/56 passing**

---

## Assumptions

1. **Positive amounts only** — `type` (`income`/`expense`) determines direction. A refund is recorded as `income` in the relevant category.
2. **Single currency** — no multi-currency support. All amounts share the same unit.
3. **Transaction date vs record date** — `date` is when the transaction happened; `created_at` is when it was recorded in the system.
4. **Admin sees all data** in dashboard queries; non-admins see only their own records.
5. **Free-text categories** — not restricted to a fixed enum. Predefined suggestions exist in `constants.js` but any string ≤ 50 chars is accepted.
6. **Email is immutable** — email changes are not supported via API (would require re-verification in production).
7. **Soft deletes only via API** — only admins can restore deleted records or users. No hard-delete HTTP endpoint is exposed.
8. **Audit logs are append-only** — there is no API to delete audit logs. This is intentional for compliance.
