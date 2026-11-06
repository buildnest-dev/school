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
- Public enquiry form: per-IP throttle uses `x-forwarded-for`, which a client can spoof. Behind a real proxy/CDN use the platform-supplied client IP and add a CAPTCHA before exposing it widely.
- Student data: Aadhaar is stored as the last 4 digits only and always returned masked; phone numbers are normalised to `+91 XXXXXXXXXX`; duplicate name + date of birth needs `confirmDuplicate`.
- Money is stored in paise as integers. Recording a payment does not move money: there is no payment gateway.

## Endpoints implemented

| Method    | Path                                       | Roles                                                                 |
| --------- | ------------------------------------------ | --------------------------------------------------------------------- |
| POST      | `/api/auth/login`, `/api/auth/logout`      | anyone / signed in                                                    |
| GET       | `/api/me`                                  | signed in                                                             |
| GET       | `/api/classes`                             | owner, principal, teacher, accountant                                 |
| GET/POST  | `/api/students`                            | list: owner, principal, teacher, accountant; create: owner, principal |
| GET/PATCH | `/api/students/:id`                        | read: staff + the linked parent; edit: owner, principal               |
| GET       | `/api/me/children`                         | parent                                                                |
| GET/POST  | `/api/admissions/enquiries`                | owner, principal                                                      |
| PATCH     | `/api/admissions/enquiries/:id`            | owner, principal (ordered stages only)                                |
| POST      | `/api/admissions/enquiries/:id/admit`      | owner, principal (creates the student, once)                          |
| POST      | `/api/public/schools/:slug/enquiries`      | public website form (no login; throttled, honeypot)                   |
| GET/PUT   | `/api/attendance/classes/:sectionId/:date` | read: owner, principal, teacher; write: principal, teacher            |
| GET/PUT   | `/api/marks/classes/:sectionId`            | principal, teacher (owner read)                                       |
| GET       | `/api/fees/invoices`                       | owner, principal, accountant                                          |
| POST      | `/api/fees/invoices/:id/payments`          | owner, principal, accountant                                          |
| GET       | `/api/boards`                              | signed in (all 42 boards: national, international, open, state)       |
| GET/PUT   | `/api/school/boards`                       | read: staff; write: owner, principal (exactly one default board)      |
| PUT       | `/api/school/boards/:boardId/scale`        | owner, principal (scale must cover 0-100, no gaps/overlaps; null resets) |
| GET/POST  | `/api/exams`                               | read: staff; create: owner, principal (board must be one the school follows) |
| POST      | `/api/exams/:id/publish`                   | owner, principal (refused while any mark sheet is missing)            |
| GET       | `/api/report-cards/classes/:sectionId`     | staff always; parents never (class sheets are staff-only)             |
| GET       | `/api/report-cards/students/:studentId`    | staff; parents only for their own child and only once published       |
| GET/POST  | `/api/staff`                               | owner, principal (employee no. EMP-<year>-0001 generated; phone/email unique per school) |
| GET/PATCH | `/api/staff/:id`                           | owner, principal (inactive = removed from timetable and class-teacher roles) |
| GET/PUT   | `/api/timetable/bell-schedule`             | read: signed in; write: owner, principal (no overlaps; slots with lessons cannot be removed) |
| GET/PUT   | `/api/timetable/sections/:sectionId`       | read: staff, parent of a child in that class; write: owner, principal (replaces the week atomically) |
| GET       | `/api/timetable/staff/:staffId`            | owner, principal; a teacher only their own week                       |
| PUT       | `/api/sections/:sectionId/class-teacher`   | owner, principal (active teacher of the same school, or null)         |
| GET/POST  | `/api/homework`                            | staff (drafts only to author/principal); parents see published homework of their children with each child's status; create: owner, principal, or a teacher who teaches that subject in that class (per timetable) or is its class teacher |
| GET/PATCH | `/api/homework/:id`                        | detail with roster and totals; edit/publish/withdraw: author or principal (due date never into the past; withdrawn is final) |
| PUT       | `/api/homework/:id/completion`             | done / missing / excused / pending per student (published homework only, same teacher rule) |
| GET/POST  | `/api/library/books`                       | read: anyone signed in (?q, ?category, ?available=1; retired hidden); add: owner, principal, librarian (ISBN-10/13 check digit, unique per school) |
| GET/PATCH | `/api/library/books/:id`                   | edit: library staff (copies cannot drop below copies out; no retiring while lent) |
| GET/POST  | `/api/library/loans`                       | library staff: all loans (?status=open/overdue/returned); parent: own children only; issue: 14 days default, max 3 books (students) / 5 (staff), blocked by overdue books or unpaid fines; last copy claimed atomically |
| POST      | `/api/library/loans/:id/return`            | library staff; late return records a fine of Rs 1/day; waiving it is owner/principal only |
| PATCH     | `/api/library/loans/:id/fine`              | library staff mark paid (records cash collected, no payment gateway); waive: owner/principal |
| GET/POST  | `/api/transport/vehicles`                  | owner, principal, transport (registration normalised e.g. KA01AB1234; insurance/fitness flagged ok / expiring within 30 days / expired / unknown) |
| PATCH     | `/api/transport/vehicles/:id`              | same (capacity cannot drop below riders; no switching off while on a route) |
| GET/POST  | `/api/transport/routes`                    | same (vehicle needs valid papers; one vehicle and one driver per route, database-enforced) |
| GET/PATCH | `/api/transport/routes/:id`                | route detail with riders; edit (a route with riders cannot be switched off or lose its vehicle) |
| PUT       | `/api/transport/routes/:id/stops`          | replaces stops in travel order (pickup times must increase; a stop with riders cannot be removed) |
| GET/PUT   | `/api/transport/students/:studentId`       | read: transport staff, or a parent for their own child (route, stop, times, vehicle, driver); assign/move/remove: transport staff (seat limit, route must be running) |
| GET/POST  | `/api/notices`                             | read: signed in; create: owner, principal                             |

## Not built yet

Certificates, academic-year rollover, platform-admin tenant management, password reset, email/SMS, file uploads, payment gateway, and restricting a teacher to only their own classes for attendance and marks (currently any teacher can mark any class; homework already follows the timetable rule).

Transport fees are stored on the route for information only and are not invoiced automatically; there is no live bus tracking. Deactivating or re-roling a driver takes them off their route. Homework has no file attachments or student submissions yet (no upload storage); due dates are IST days. Timetable: a teacher cannot be in two classes at once (database unique index plus a pre-check that names the clashing class); a refused save changes nothing. Staff logins are not created by the staff API yet (the seeded teacher and accountant are linked by hand).

Report cards count only submitted mark sheets; a subject below the exam pass mark fails the exam; ranks share on ties; results stay hidden from parents until published. Student-role logins are not possible yet (Student has no user link).

Boards and grade scales are editable defaults in the database, not an authoritative copy of each board's rules.
