# Mock data

**The mock adapter is a development tool, not a backend.** It lives in `src/services/mock/index.ts` with fixtures in `src/mocks/data.ts`. It keeps state in memory for the current page session, loses it on reload, performs no authorisation and returns `mode: "mock"` on every write so screens can say so.

## What it contains

- **Fictional institutions and people.** Northfield Academy (the signed-in school), plus Riverstone, Lakeview, Hillcrest, Oakridge and Maple Grove on the platform side. Names are generated from short first/last-name lists; they are not real.
- **Personas** (`PERSONAS`) for the dev sign-in: platform administrator, school owner, principal, teacher (Kavita Iyer, classes 6A/8A/9B), accountant, librarian, transport coordinator, parent (Rahul Mehta, children Aarav 7B and Anaya 3A) and student (Aarav Mehta).
- **Fixed "today"**: 26 Oct 2026 (`DEV_TODAY` in `src/config/env.ts`) so lists, due dates and the calendar are deterministic. In `api` mode `todayIso()` returns the real date.
- 60 students, 12 staff, 14 admission enquiries, 36 invoices, 24 books, calendar events, approvals, certificate requests/register and platform records. Numbers (enrolment 1,248, fees ₹38.6L…) are illustrative; there are no real statistics.
- Latency: 250 ms per call (0 under tests) so loading states are visible. This is dev behaviour, not a simulation of a payment or any critical operation.

## Behaviour worth knowing

| Operation                                                                                        | Mock behaviour                                                                                                                     |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Lists                                                                                            | Real search, filters, sorting and pagination over the arrays — same contract as the API.                                           |
| Attendance / marks / homework / notices / leave / approvals / certificate requests / PTM booking | Stored in memory; visible in other screens until reload. Nothing is sent to anyone.                                                |
| Rollover                                                                                         | `preview` applies the rules to 24 sample students. `submit` returns `state: "awaiting_backend_authorization"` and changes nothing. |
| Certificate verification                                                                         | Looks up the in-memory issue register (`NA/BON/2026/0142` is valid; `…/0121` is cancelled).                                        |
| Payments, PDFs, notifications, uploads                                                           | Not simulated. Screens say they are unavailable.                                                                                   |

## Switching to the real API

1. Copy `.env.example` to `.env.local`.
2. Set `NEXT_PUBLIC_DATA_SOURCE=api` and `NEXT_PUBLIC_API_BASE_URL=<backend URL>`.
3. Restart the dev server (env values are inlined at build time).
4. The app now calls `src/services/api` → proposed endpoints (`docs/API_INTEGRATION.md`). The dev sign-in page is replaced by "sign-in is handled by the backend", and the session comes from `GET /me`.
5. If the backend differs from the proposal, change `src/types`, `src/services/endpoints.ts` and `src/services/api/index.ts`. Screens only depend on the `Services` interface (`src/services/types.ts`).

## Adding fixtures

Add rows in `src/mocks/data.ts`, register a resource key in `ResourceMap` (`services/types.ts`), `RESOURCE_PATHS` (`services/endpoints.ts`), the mock `rows` store and (optionally) a `TABLES` entry for a list screen. Keep fixtures small and clearly fictional; never use real people, schools or contact details.
