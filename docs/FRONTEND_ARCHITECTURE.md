# Frontend architecture

Frontend for a universal, multi-tenant School ERP SaaS. **There is no backend in this repository.** Another developer builds it; this frontend talks to it through typed service interfaces (see `API_INTEGRATION.md`).

## Boundaries

| Concern                           | Where                              | Notes                                                                                                         |
| --------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Public marketing site             | `src/app/(marketing)`              | Static, animated (GSAP). Preserved from the first deliverable.                                                |
| Sign-in / onboarding entry points | `src/app/(auth)`                   | `/sign-in` is a **dev role picker** in mock mode; `/get-started` is a placeholder. Real auth is backend work. |
| Authenticated product             | `src/app/(app)/[area]/[[...slug]]` | One catch-all route per area, resolved against `src/config/screens.ts`.                                       |
| Server data                       | `src/services` + `src/lib/api`     | UI never fetches or reads fixtures directly.                                                                  |
| Dev fixtures                      | `src/mocks`                        | Imported only by `src/services/mock` and the dev session.                                                     |

Areas (separate shells, navigation and information architecture): `platform` (software provider), `school` (owner, principal, accountant, librarian, transport coordinator, role-filtered menu), `teacher`, `parent`, `student`. Platform admin and school admin share no screens.

## Routing and the screen registry

`src/config/screens.ts` is the single source of truth: route, title, allowed roles, sidebar entry, status and the catalogue section(s) covered. Everything derives from it:

- the route table (`matchScreen`, `generateStaticParams`),
- sidebar / mobile navigation (`AppShell`),
- the route guard (`ScreenHost`),
- the permission matrix in Settings,
- `docs/SCREEN_INVENTORY.md` (`npm run docs:inventory`),
- tests that fail if a screen has no component or an unknown icon.

`src/features/registry.tsx` maps screen id → component. List-style screens are _configuration_, not components: add an entry to `TABLES` in `features/shared/resource-table.tsx`. Screens with `status: "planned"` have no component and render an explicit "planned" page.

**To add a screen:** add an entry to `SCREENS`; add a component to the registry (or a `TABLES` entry); run `npm run docs:inventory`.

## Data flow

```
Screen component ──useServices()──▶ Services (interface, src/services/types.ts)
                                      ├─ mock adapter  (src/services/mock)  ← src/mocks/data.ts   [dev only, in memory]
                                      └─ api adapter   (src/services/api)   ← src/lib/api/client.ts → backend [proposed endpoints]
```

- `NEXT_PUBLIC_DATA_SOURCE=mock|api` selects the adapter (`src/services/index.ts`).
- Lists go through `ListService<T>` (`list(params)`, `get(id)`) and the shared `DataTable`, which sends `q`, `page`, `pageSize`, `sort`, `order`, `filters` — the same contract for mock and API (server-side paging).
- Writes return `MutationResult { ok, mode: "mock" | "api", message }`. Screens show the message and a `DevNote`, so nothing claims persistence it does not have.
- `useAsync` loads data with stale-response protection; every screen handles loading (skeleton), empty (guided message), and error (retry).
- Session: mock mode = a persona remembered for the browser tab (`sessionStorage`, UI preference only). API mode = `GET /me` (cookie session, proposed). `ScreenHost` redirects signed-out users and shows an "unauthorised" page for wrong-role access.
- **Permission-aware UI is not authorisation.** Hidden menu items and the guard are conveniences. The backend must authorise every request and isolate tenants. The frontend never sends or trusts a tenant id from the client.
- Local storage is not used for data. `sessionStorage` holds only the dev persona id.

## Source layout

```
src/
  app/                 routes + layouts ((marketing), (auth), (app)), globals.css (design tokens)
  components/
    ui/                primitives: Button, Field/Input/Select, Dialog, Toast, Badge, Card, Tabs, states
    shared/            DataTable, PageHeader, StatGrid, BarList, Stepper, MonthCalendar, FileUpload, AuditHistory…
    layout/            site header/footer (marketing), AppShell (all authenticated areas), nav icons
    app/               providers, route guard (ScreenHost), dev sign-in
    landing/ motion/ mockups/   marketing site (GSAP motion system) — unchanged architecture
  config/              env.ts, screens.ts (inventory/routes/roles)
  features/            screens by domain: teacher, school, family (parent+student), shared (tables, planned)
  hooks/               useAsync, useServices, useSession
  lib/                 utils, site config, api client, schemas
  mocks/               dev-only fixtures
  services/            interfaces (types.ts), endpoints.ts (proposed), mock/, api/
  types/               DTOs / models
tests/  e2e/  docs/  scripts/
```

## Design tokens and UI

Tokens live in `@theme` in `src/app/globals.css` (Tailwind v4): ink/teal `ink`, warm `paper`, one accent, status colours, display serif + system sans. The application uses the same tokens as the marketing site with a denser, calmer treatment.

Teacher-first conventions (apply to all new screens):

- Plain verbs ("Mark Attendance", "Add Homework", "Enter Marks", "Request Leave"); daily tasks reachable from Home in one tap; 2–4 steps per task.
- Sensible defaults (everyone starts "present"; class and date preselected), sticky primary action bar on mobile.
- Inline, actionable validation (Zod + React Hook Form where forms have several fields); values are preserved on error; focus moves to the first problem.
- Draft vs submitted vs published are always labelled with text + icon (never colour alone); confirmation dialogs for consequential actions; "unsaved changes" warnings (`beforeunload` + in-app back).
- Min 44 px touch targets; mobile bottom navigation for teacher/parent/student; tables collapse into cards below `md`.

## Motion

Marketing site: GSAP + ScrollTrigger, gated behind `.js` and `prefers-reduced-motion` (see comments in `components/motion/gsap.ts` and `app/globals.css`). Authenticated app: no decorative animation; only short CSS transitions on buttons/progress bars. Reduced motion is respected by a global rule.

## Accessibility and performance

Semantic landmarks and skip links, labelled form controls with `aria-describedby`, `aria-live` for counts/toasts, radio-group semantics for attendance, `aria-sort` on tables, focus-visible rings, text+icon status badges. Static pre-rendering for all fixed routes; screens are client components that load through services after hydration. No data libraries beyond the platform (React, Radix, GSAP for marketing only).

## What is deliberately not here

Authentication, tenant resolution, authorisation, persistence, payments, PDF generation, notifications, live GPS, imports/exports and every integration. Where a screen touches one of these, it says so on the page (`DevNote`, "Not connected" badges) and the contract is in `API_INTEGRATION.md`.

## Known limitations / next steps

- Details for rows in generic list screens are read-only dialogs; create/edit forms exist only for the workflows listed as implemented in `SCREEN_INVENTORY.md`.
- `proxy.ts` (Next 16's middleware) is not used; add a session-cookie presence check there once the backend defines the cookie. It would be an optimistic redirect only.
- i18n, offline notes, print stylesheets and PDF previews are not implemented.
