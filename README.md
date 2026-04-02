# Finance Dashboard Backend

A production-grade REST API for a multi-role finance dashboard system, built with **Node.js**, **Express**, and **SQLite** (via `better-sqlite3`).

> **Live API:** https://finance-data-processing-and-access-2amx.onrender.com

> **Live Swagger Docs:** https://finance-data-processing-and-access-2amx.onrender.com/api/v1/docs

> **Local Swagger Docs:** `http://localhost:3000/api/v1/docs` — fully interactive Swagger UI after running the server.

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

> **Note:** The live Render deployment may take ~30 seconds to respond on the first request after inactivity (free tier cold start). Subsequent requests are fast.

### Quick Test (PowerShell)

```powershell
$r = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/login" `
  -Method POST -ContentType "application/json" `
  -Body '{"email":"admin@example.com","password":"Admin@1234"}'
$TOKEN = $r.data.accessToken

Invoke-RestMethod -Uri "http://localhost:3000/api/v1/dashboard/overview" `
  -Headers @{Authorization="Bearer $TOKEN"} | ConvertTo-Json -Depth 5
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

- **Routes** — declare HTTP method + path + middleware chain only
- **Middleware** — auth, authorization, validation, rate limiting
- **Controllers** — parse request, call service, send response (thin by design)
- **Services** — all business logic, DB queries, access rules
- **Config** — database init, constants, permission matrix, environment

Controllers have zero business logic. All decisions live in services.

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
│   ├── routes/
│   │   └── docsRoutes.js       # Swagger UI served at /api/v1/docs
│   └── utils/
│       ├── response.js         # sendSuccess(), sendError(), pagination helpers
│       └── logger.js           # Structured JSON logger
├── tests/                      # 56 tests across 4 files
├── scripts/
│   └── seed.js                 # Realistic 200-record seed dataset
├── docs/
│   └── openapi.yaml            # Full OpenAPI 3.0 spec
├── .env.example
└── package.json
```

---

## Role & Permission Model

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

**Registration security:** Public registration always assigns `role = 'viewer'` regardless of what is sent. Only an authenticated admin can create elevated roles — prevents privilege escalation.

---

## API Reference

All responses use a consistent envelope:

```json
{
  "success": true,
  "message": "Human-readable message",
  "data": { ... },
  "meta": { "pagination": { "page": 1, "limit": 20, "total": 150 } }
}
```

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/register` | Public | Create account (role always viewer) |
| POST | `/api/v1/auth/login` | Public | Returns accessToken + refreshToken |
| POST | `/api/v1/auth/refresh` | Public | Rotate refresh token |
| GET  | `/api/v1/auth/me` | 🔒 Any | Current user profile |
| POST | `/api/v1/auth/logout` | 🔒 Any | Revoke current session |
| POST | `/api/v1/auth/logout-all` | 🔒 Any | Revoke all sessions |

### Financial Records
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET    | `/api/v1/records` | 🔒 All | Paginated + filtered list |
| GET    | `/api/v1/records/:id` | 🔒 All | Single record |
| POST   | `/api/v1/records` | 🔒 Analyst/Admin | Create record |
| PATCH  | `/api/v1/records/:id` | 🔒 Analyst/Admin | Update record |
| DELETE | `/api/v1/records/:id` | 🔒 Admin | Soft delete |
| POST   | `/api/v1/records/:id/restore` | 🔒 Admin | Restore deleted record |

**Filters:** `type`, `category`, `startDate`, `endDate`, `minAmount`, `maxAmount`, `search`, `tags`, `sortBy`, `order`, `page`, `limit`

### Dashboard & Analytics
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/dashboard/overview` | 🔒 All | Full dashboard in one call |
| GET | `/api/v1/dashboard/summary` | 🔒 All | Totals + net balance |
| GET | `/api/v1/dashboard/recent-activity` | 🔒 All | Latest N transactions |
| GET | `/api/v1/dashboard/categories` | 🔒 Analyst/Admin | Category breakdown |
| GET | `/api/v1/dashboard/trends/monthly` | 🔒 Analyst/Admin | Monthly trends |
| GET | `/api/v1/dashboard/trends/weekly` | 🔒 Analyst/Admin | Weekly trends |
| GET | `/api/v1/dashboard/top-categories` | 🔒 Analyst/Admin | Top spending categories |

### Users & Audit
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET    | `/api/v1/users` | 🔒 Admin | List all users |
| GET    | `/api/v1/users/:id` | 🔒 Self/Admin | Get user |
| PATCH  | `/api/v1/users/:id` | 🔒 Self/Admin | Update user |
| DELETE | `/api/v1/users/:id` | 🔒 Admin | Soft-delete user |
| GET    | `/api/v1/audit` | 🔒 Admin | Audit logs |

---

## Design Decisions & Tradeoffs

**SQLite over Postgres/MySQL** — Zero setup, synchronous API, WAL mode for concurrent reads. Service layer abstracts the DB so migrating to Postgres is a schema migration, not a rewrite.

**Soft Delete for records and users** — `is_deleted = 1` rather than hard delete. Preserves financial audit trail, allows restoration, standard in financial systems.

**JWT Refresh Token Rotation** — Every refresh rotates the token and revokes the old one immediately. All tokens stored in DB so `logout-all` works across devices.

**Permission Matrix over scattered role checks** — Central `PERMISSIONS` map in `constants.js`. Adding a new role is one object change — no controller edits needed.

**Audit log failure isolation** — Audit writes wrapped in try/catch. A logging failure never fails the user's request.

**Composite DB indexes** — `(user_id, is_deleted, date)`, `(is_deleted, type)`, `(is_deleted, category)` — eliminate full table scans on the most expensive dashboard queries.

---

## Known Limitations

- **Single-process only** — `better-sqlite3` is synchronous. Migrate to Postgres for horizontal scaling.
- **No email verification** — production would require email confirmation on register.
- **In-process rate limiting** — resets on restart. Use Redis for distributed rate limiting in production.
- **Render free tier cold start** — live deployment may take ~30 seconds after 15 min of inactivity.
- **Single currency** — no multi-currency support.

---

## Testing

```bash
npm test               # Run all 56 tests
npm run test:coverage  # With coverage report
```

| Test file | Coverage | Tests |
|---|---|---|
| `auth.test.js` | Register, login, refresh, token edge cases | 14 |
| `users.test.js` | CRUD, role access, self vs admin | 13 |
| `records.test.js` | CRUD, filters, soft delete, restore, permissions | 18 |
| `dashboard.test.js` | Analytics endpoints, role gating | 11 |
| **Total** | | **56/56 passing** |

---

## Assumptions

1. **Positive amounts only** — `type` determines direction. A refund = `income` in the relevant category.
2. **Single currency** — all amounts share the same unit.
3. **Transaction date vs record date** — `date` = when it happened; `created_at` = when recorded.
4. **Admin sees all data** in dashboard; non-admins see only their own records.
5. **Free-text categories** — any string ≤ 50 chars accepted.
6. **Email is immutable** — not changeable via API.
7. **Soft deletes only** — no hard-delete endpoint exposed.
8. **Audit logs are append-only** — no delete API. Intentional for compliance.
