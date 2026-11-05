# Backend

TypeScript backend inside the Next.js app: route handlers in `src/app/api`, Prisma + SQLite for development (PostgreSQL for production), server code in `src/server`.

## Run

```bash
npm install
cp .env.example .env.local   # DATABASE_URL=file:./prisma/dev.db
npm run db:reset             # dev only: recreates prisma/dev.db and seeds demo data
npm run dev
```

Demo logins (fictional schools, development only, all use the password in `prisma/seed.ts`):
`principal@demo.test`, `teacher@demo.test`, `accountant@demo.test`, `parent@demo.test`, `platform@demo.test`, and `principal@other.test` (a second school used to test isolation).

## Multi-tenancy

Shared database, shared schema. Every school-owned table has `tenantId`. The tenant is taken only from the server-side session (`requireTenant`), never from the request. Data access for school data goes through `tenantDb(tenantId)` or an explicit `where: { tenantId }`. Cross-school ids return 404.

## Security model

- Passwords: bcrypt. Sessions: random 256-bit token in an HTTP-only, SameSite=Lax cookie; only its SHA-256 is stored.
- State-changing routes check `Origin` against `Host` (CSRF) and validate bodies with Zod.
- Login is throttled (5 tries / 10 minutes) **in memory**: a multi-instance deployment needs a shared store (Redis).
- Roles are enforced per route. Teachers can edit attendance and marks until submitted; then only a principal can.
- Aadhaar: only the last 4 digits are modelled. Do not store full Aadhaar numbers.
- Money is stored in paise as integers. Recording a payment does not move money: there is no payment gateway.

## Endpoints implemented

| Method   | Path                                       | Roles                                                      |
| -------- | ------------------------------------------ | ---------------------------------------------------------- |
| POST     | `/api/auth/login`, `/api/auth/logout`      | anyone / signed in                                         |
| GET      | `/api/me`                                  | signed in                                                  |
| GET      | `/api/classes`                             | owner, principal, teacher, accountant                      |
| GET      | `/api/students`                            | owner, principal, teacher, accountant                      |
| GET/PUT  | `/api/attendance/classes/:sectionId/:date` | read: owner, principal, teacher; write: principal, teacher |
| GET/PUT  | `/api/marks/classes/:sectionId`            | principal, teacher (owner read)                            |
| GET      | `/api/fees/invoices`                       | owner, principal, accountant                               |
| POST     | `/api/fees/invoices/:id/payments`          | owner, principal, accountant                               |
| GET/POST | `/api/notices`                             | read: signed in; create: owner, principal                  |

## Not built yet

Student create/update, admissions, staff, timetable, homework, library, transport, certificates, report cards with board grade scales, academic-year rollover, platform-admin tenant management, password reset, email/SMS, file uploads, payment gateway, and restricting a teacher to only their own classes (currently any teacher in the school can mark any class).

Boards and grade scales are editable defaults in the database, not an authoritative copy of each board's rules.
