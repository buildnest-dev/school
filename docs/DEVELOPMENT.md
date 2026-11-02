# Development

## Requirements

Node.js 20+ (developed on 24) and npm. No database, no backend, no secrets.

## Install and run

```bash
npm install
npm run dev          # http://localhost:3000
```

Open `/sign-in`, choose a role (development picker, no password) and explore. The marketing site is at `/`.

## Environment

`cp .env.example .env.local`. Defaults to the in-memory mock adapter. See `MOCK_DATA.md` to point at a real API. Only `NEXT_PUBLIC_*` values reach the browser; never put secrets in them.

## Commands

| Command                           | Purpose                                                                                                         |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                     | Dev server                                                                                                      |
| `npm run build` / `npm run start` | Production build / serve (`-- -p 3100` to change port)                                                          |
| `npm run lint`                    | ESLint (Next core-web-vitals + TypeScript + React Compiler rules)                                               |
| `npm run typecheck`               | `tsc --noEmit` (strict, `noUncheckedIndexedAccess`)                                                             |
| `npm test`                        | Vitest + React Testing Library (24+ tests: config integrity, mock adapter, attendance flow, dashboard, schemas) |
| `npm run test:e2e`                | Playwright (`npx playwright install chromium` once); builds and serves the app                                  |
| `npm run format`                  | Prettier (with Tailwind class sorting)                                                                          |
| `npm run docs:inventory`          | Regenerates `docs/SCREEN_INVENTORY.md` from `src/config/screens.ts`                                             |

## Conventions

- New screen: add to `src/config/screens.ts`, add a component to `src/features/registry.tsx` (or a `TABLES` entry), run `npm run docs:inventory`. A test fails if you forget the component.
- Fetch through `useServices()` + `useAsync`; never import `src/mocks` from components.
- Every write shows `res.message` and a `DevNote` while in mock mode.
- Forms: React Hook Form + Zod for multi-field forms; plain controlled inputs for single-field ones. Always label inputs and show actionable errors.
- Next.js 16 note (see `AGENTS.md`): `middleware` is now `proxy`; `params` are async promises; read `node_modules/next/dist/docs/` before using unfamiliar APIs.

## Deployment readiness

`npm run build` succeeds and pre-renders all fixed routes. Before production: implement the backend contract, configure CORS/cookies, add `proxy.ts` session redirect, add error reporting, run Playwright across browsers, and review accessibility with real assistive technology.
