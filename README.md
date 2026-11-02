# SchoolOS — frontend

Frontend for a universal, multi-tenant School ERP SaaS (temporary name: set `BRAND` in `src/lib/site.ts`).

- **Public website** (animated, GSAP): `/`
- **Application** (separate shells per audience): `/platform`, `/school`, `/teacher`, `/parent`, `/student` — sign in at `/sign-in` with the **development role picker** (no credentials).
- **No backend exists in this repo.** All data comes from a development-only in-memory mock; the contract the backend must implement is in `docs/API_INTEGRATION.md`. Nothing here is persisted, paid, sent or authorised.

```bash
npm install
npm run dev      # http://localhost:3000
```

## Docs

| File                            | What                                              |
| ------------------------------- | ------------------------------------------------- |
| `docs/FRONTEND_ARCHITECTURE.md` | Boundaries, routing, data flow, conventions       |
| `docs/API_INTEGRATION.md`       | Proposed API contract for the backend developer   |
| `docs/SCREEN_INVENTORY.md`      | Every screen: route, roles, status (generated)    |
| `docs/FEATURE_TRACEABILITY.md`  | Master feature catalogue → screens, honest status |
| `docs/MOCK_DATA.md`             | Fixtures and how to switch to the real API        |
| `docs/DEVELOPMENT.md`           | Commands, conventions, deployment readiness       |

Stack: Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 4 · Radix UI · Lucide · GSAP (marketing only) · React Hook Form + Zod · Vitest · Playwright. `prototype/` holds the first static HTML version, kept for reference.
