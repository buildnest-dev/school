# API integration contract (frontend → backend)

> **Everything below is a PROPOSAL.** No backend implements these endpoints. Paths, field names and shapes are what the frontend currently expects; the backend developer may change them, in which case update `src/types/index.ts`, `src/services/endpoints.ts` and `src/services/api/index.ts` only (UI code does not need to change).
>
> The adapter that calls these endpoints is `src/services/api/index.ts` (select with `NEXT_PUBLIC_DATA_SOURCE=api`). It has **not** been exercised against a real server.

## 1. Environment

| Variable                   | Meaning                                                           |
| -------------------------- | ----------------------------------------------------------------- |
| `NEXT_PUBLIC_DATA_SOURCE`  | `mock` (default, in-memory dev data) or `api`                     |
| `NEXT_PUBLIC_API_BASE_URL` | Base URL of the API (no trailing slash). Empty in `.env.example`. |

Browser requests use `fetch(..., { credentials: "include" })`, so the API must send CORS headers allowing the frontend origin with credentials (or be served same-origin behind a reverse proxy, which is simpler).

## 2. Authentication and session

- Proposed: cookie-based session (HTTP-only, `Secure`, `SameSite=Lax/Strict`) set by the backend. **No tokens or secrets are stored in JavaScript.**
- `GET /me` → `SessionUser`: `{ id, name, role, tenantId, tenantName, title, childIds? }`. `401` when signed out (the UI then sends the user to `/sign-in`).
- Sign-in, sign-out, password reset, MFA, invitations and session management are backend flows; the frontend has no credential form (`/sign-in` explains this in API mode).
- Roles (`Role`): `platform_admin | school_owner | principal | teacher | accountant | librarian | transport | parent | student`.

## 3. Tenant and campus context

- The tenant (school) is derived **from the session on the server**. The frontend never sends a tenant id header or path segment and never trusts one returned for another school.
- Every query must be scoped to the session's tenant. Cross-tenant ids must return `404` (not `403`) so existence is not leaked.
- Platform administrators are the only role that can list tenants (`/platform/*`). They must not receive school-private records through these endpoints.
- Campuses: the school owner/principal may be authorised for several campuses. Proposal: an optional `campusId` filter on list endpoints that the server validates against the user's campus grants. The UI has no campus switcher yet.

## 4. Permissions

- The frontend hides screens by role (`src/config/screens.ts`, shown as a matrix in Settings → Roles). **This is not security.** The backend must enforce, per request: role, tenant, and record-level rules, e.g.
  - parents only see children linked to their guardian account (`/me/children*`);
  - students only see themselves;
  - teachers only see classes/students they are assigned to;
  - accountants cannot see academic discipline data, etc.
- `403` → the UI shows "You don't have access".

## 5. Lists: pagination, sorting, filtering, search

`GET <collection>?q=&page=&pageSize=&sort=&order=&filter[<field>]=<value>`

- `page` is 1-based; `pageSize` defaults to 10 (UI uses 8–100). `sort` is a field name; `order` is `asc|desc`. `q` is a free-text search over the visible columns.
- Response: `Page<T>` = `{ "items": T[], "total": number, "page": number, "pageSize": number }`.
- Unknown filter/sort fields should return `400`.

## 6. Errors and validation

- Non-2xx responses: `{ "code": string, "message": string, "fieldErrors"?: { [field]: string[] } }`.
- `422` for validation failures with `fieldErrors`; the UI client validates first (Zod) but must also show server errors. (`ApiError` in `src/lib/api/client.ts` carries `status`, `code`, `fieldErrors`.)
- Screens show: loading skeletons, an empty-state with next steps, and an error panel with "Try again" for any rejected request.

## 7. Writes and audit-sensitive operations

All writes return `{ "id"?: string, "message"?: string }` (mapped to `MutationResult`). The UI states "recorded"/"submitted"; it never claims a financial, certificate or academic operation succeeded unless the API says so. The backend must write an **audit entry** (who, when, what, before/after) for at least:

attendance submission and correction; marks submission, moderation and publication; fee payments, receipts, refunds, concessions; certificate request, approval, issue, reissue, cancellation; approvals decisions; notice publication; leave decisions; user invitation and role changes; rollover submission and execution; tenant status/plan changes; data exports.

## 8. Files, downloads and notifications

- File upload (documents, logos, study material, answer sheets) and PDF download (certificates, receipts, report cards) are **not implemented** in the UI (`FileUpload` is a dev preview that uploads nothing; certificate "preview" is HTML). Proposal: multipart `POST /files` returning `{ id, name, size, contentType }`, signed short-lived download URLs, virus scanning and per-record access checks.
- Notifications (email/SMS/push/in-app) are backend responsibilities. The UI only creates notices; delivery status and acknowledgement tracking are future screens. System status shows these integrations as "Not connected".

## 9. Endpoints used by the current screens

Resource collections (all support section 5; `GET /<path>/{id}` returns one `T`; row types are in `src/types/index.ts`):

| Resource key        | Proposed path                | Row type             | Used by                                                                                                    |
| ------------------- | ---------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------- |
| students            | `/students`                  | `Student`            | Students, student profile, attendance overview, fee ledger picker, certificate form                        |
| staff               | `/staff`                     | `Staff`              | Staff directory                                                                                            |
| enquiries           | `/admissions/enquiries`      | `Enquiry`            | Admissions                                                                                                 |
| campuses            | `/campuses`                  | `Campus`             | Campuses                                                                                                   |
| invoices            | `/fees/invoices`             | `Invoice`            | Fee collection                                                                                             |
| feeHeads            | `/fees/structure`            | `FeeHead`            | Fee structure                                                                                              |
| vendors             | `/vendors`                   | `Vendor`             | Vendors                                                                                                    |
| certificateRequests | `/certificates/requests`     | `CertificateRequest` | Certificate requests                                                                                       |
| issueRegister       | `/certificates/register`     | `IssueRegisterEntry` | Issue register                                                                                             |
| notices             | `/notices`                   | `Notice`             | Notice history; staff/parent/student notices (`filter[status]=published`, audience-filtered by the server) |
| calendar            | `/calendar/events`           | `CalendarEvent`      | Calendars (all roles; audience-filtered by the server)                                                     |
| leaves              | `/staff/leave-requests`      | `LeaveRequest`       | Staff leave                                                                                                |
| approvals           | `/approvals`                 | `Approval`           | Approval inbox (`filter[status]=pending`)                                                                  |
| eventPlans          | `/events`                    | `EventPlan`          | Events & functions                                                                                         |
| queries             | `/parent-queries`            | `ParentQuery`        | Parent queries                                                                                             |
| books               | `/library/books`             | `Book`               | Library catalogue                                                                                          |
| loans               | `/library/loans`             | `Loan`               | Issues & returns                                                                                           |
| vehicles            | `/transport/vehicles`        | `Vehicle`            | Vehicles                                                                                                   |
| routes              | `/transport/routes`          | `TransportRoute`     | Routes & stops                                                                                             |
| exams               | `/exams/datesheet`           | `ExamEntry`          | Exam datesheet                                                                                             |
| tenants             | `/platform/tenants`          | `Tenant`             | Platform: schools, plans & usage (platform admins only)                                                    |
| onboarding          | `/platform/onboarding`       | `OnboardingItem`     | Platform onboarding                                                                                        |
| support             | `/platform/support-requests` | `SupportRequest`     | Platform support                                                                                           |
| audit               | `/audit-events`              | `AuditEntry`         | School and platform audit (tenant-scoped vs all-tenants by role)                                           |

Workflow endpoints:

| Method + path                                                                                                          | Request                                                                | Response                                                                                                                                         | Used by                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `GET /dashboards/school`                                                                                               | —                                                                      | `SchoolDashboard`                                                                                                                                | School home. Content varies by the **session's** role; the client never sends a role.                                               |
| `GET /platform/dashboard`                                                                                              | —                                                                      | `PlatformDashboard`                                                                                                                              | Platform overview                                                                                                                   |
| `GET /platform/status`                                                                                                 | —                                                                      | `ServiceStatus[]`                                                                                                                                | System status (must report unconnected integrations honestly)                                                                       |
| `GET /students/{id}/ledger`                                                                                            | —                                                                      | `LedgerEntry[]`                                                                                                                                  | Student profile, ledger. Carry-forward rows must reference the originating year.                                                    |
| `GET /teacher/home`                                                                                                    | —                                                                      | `TeacherHome`                                                                                                                                    | Teacher home                                                                                                                        |
| `GET /teacher/classes`                                                                                                 | —                                                                      | `TeachingClass[]`                                                                                                                                | Teacher screens                                                                                                                     |
| `GET /teacher/timetable`                                                                                               | —                                                                      | `TimetableSlot[]`                                                                                                                                | Teacher today                                                                                                                       |
| `GET /teacher/syllabus-progress`                                                                                       | —                                                                      | `{classLabel, subject, pct}[]`                                                                                                                   | Syllabus                                                                                                                            |
| `GET /teacher/leave-requests`                                                                                          | —                                                                      | `LeaveRequest[]`                                                                                                                                 | Request leave                                                                                                                       |
| `GET /attendance/classes/{classId}/{date}`                                                                             | —                                                                      | `AttendanceSheet` (`marks` keyed by student id, `status` draft/submitted)                                                                        | Teacher attendance                                                                                                                  |
| `PUT /attendance/classes/{classId}/{date}`                                                                             | `{ marks: {studentId: "present"\|"absent"\|"late"}, submit: boolean }` | `{ id?, message? }`                                                                                                                              | Save draft / submit. Submitted sheets are immutable except via a correction workflow.                                               |
| `GET/POST /homework`                                                                                                   | `HomeworkInput` `{ classId, title, instructions, due, publish }`       | `Homework[]` / `{id}`                                                                                                                            | Homework                                                                                                                            |
| `GET /marks/classes/{classId}`                                                                                         | —                                                                      | `MarksSheet`                                                                                                                                     | Marks entry                                                                                                                         |
| `PUT /marks/classes/{classId}`                                                                                         | `{ marks: {studentId: number\|null}, submit: boolean }`                | `{message?}`                                                                                                                                     | Server must validate `0 ≤ mark ≤ max`.                                                                                              |
| `POST /notices`                                                                                                        | `NoticeInput` `{ title, body, audience, publish }`                     | `{id}`                                                                                                                                           | Compose notice (publishing triggers delivery server-side)                                                                           |
| `POST /staff/leave-requests`                                                                                           | `LeaveInput` `{ from, to, type, reason }`                              | `{id}`                                                                                                                                           | Request leave                                                                                                                       |
| `POST /approvals/{id}/decision`                                                                                        | `{ decision: "approved"\|"rejected", note? }`                          | `{message?}`                                                                                                                                     | Approval inbox                                                                                                                      |
| `POST /certificates/requests`                                                                                          | `CertificateInput` `{ type, studentId, purpose }`                      | `{id}`                                                                                                                                           | Generate certificate / parent request                                                                                               |
| `GET /certificates/verify/{certNo}`                                                                                    | —                                                                      | `{ valid: boolean, summary? }`                                                                                                                   | Verification (minimal data; should be callable without sign-in)                                                                     |
| `GET /rollover/checks`                                                                                                 | —                                                                      | `RolloverCheck[]`                                                                                                                                | Rollover step 2                                                                                                                     |
| `POST /rollover/preview`                                                                                               | `PromotionRules`                                                       | `PromotionPreviewRow[]`                                                                                                                          | Step 4. **Dry run only; must not change data.**                                                                                     |
| `GET /rollover/sections`                                                                                               | —                                                                      | `SectionPlan[]`                                                                                                                                  | Step 5                                                                                                                              |
| `POST /rollover/submissions`                                                                                           | `RolloverSubmission`                                                   | `RolloverResult` `{ ok, state: "awaiting_backend_authorization", message? }`                                                                     | Step 8. Starts an approval workflow; execution, audit trail, rollback plan and "closed years are read-only" are backend guarantees. |
| `GET /me/children`                                                                                                     | —                                                                      | `Child[]` (only authorised children)                                                                                                             | Parent/student                                                                                                                      |
| `GET /me/children/{childId}/{briefing\|attendance\|homework\|results\|ledger\|timetable\|exams\|certificate-requests}` | —                                                                      | `DailyBriefing`, `AttendanceSummary`, `HomeworkItem[]`, `ResultRow[]`, `LedgerEntry[]`, `TimetableSlot[]`, `ExamEntry[]`, `CertificateRequest[]` | Parent/student screens                                                                                                              |
| `POST /me/children/{childId}/certificate-requests`                                                                     | `{ type, purpose }`                                                    | `{id}`                                                                                                                                           | Parent certificate request                                                                                                          |
| `GET /me/ptm-slots`, `POST /me/ptm-slots/{slotId}/booking`                                                             | —                                                                      | `PtmSlot[]`, `{message?}`                                                                                                                        | Meet a teacher                                                                                                                      |

## 10. Outstanding backend dependencies

Authentication/session, tenant resolution, authorisation, audit log, every endpoint above, file storage, PDF generation (certificates, receipts, report cards), notification providers, payment gateway (payments are **not** in the UI), import/export, real-time updates. Planned screens (see `SCREEN_INVENTORY.md`) will add contracts for timetable generation, curriculum, refunds/reconciliation, platform configuration, etc.
