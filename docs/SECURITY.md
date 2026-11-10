# Security checks

A red-team pass was run against the app with seeded users (principal, teacher, accountant, parent,
student, platform admin and a second school). Every attack below is now a test in
`e2e/api-security.spec.ts`, `e2e/api-hosts.spec.ts` or `tests/approvals.test.ts`.

## What was attacked, and the result

| Attack | Result |
| --- | --- |
| Call all 120 API routes without signing in | Every route refuses, except the intended public ones (login, reset, demo form, school lookup, certificate check) |
| Every state-changing route accepts a foreign `Origin` | Refused (same-origin check on all of them) |
| A school reads or changes another school's records, by id, by list, by detail | Refused |
| Platform admin reads school records | Refused |
| Parent or student reads another child, files a proof for one, calls staff routes | Refused |
| Teacher reads fees, bank details, other classes' attendance and marks | Refused |
| Accountant creates students/staff/notices, runs the year rollover | Refused |
| Strangers and other roles open or decide a payment screenshot | Refused |
| SQL-style text in search and sort parameters, huge page sizes | No errors, no leakage |
| Fake image upload (PNG, oversized, not JPEG) | Refused |
| Forgot-password and login messages for known and unknown emails | Same answer |

## Found and fixed

1. **Push address (server-side request forgery).** Any signed-in person could store any URL as their
   phone's push address and the server would send to it. Only the browsers' own push services
   (Chrome, Firefox, Safari, Windows) are accepted now.
2. **Login guessing with a changing address.** The limit was per email *and* address, so changing
   `X-Forwarded-For` reset it. There is now a limit per email from anywhere (25 per 15 minutes) and
   per address across emails (60 per 10 minutes).
3. **No browser protections.** Added a content policy, no framing, no file-type guessing, HTTPS only
   and a permissions policy on every response.
4. **Broken JSON gave a 500.** It is a 400 now.
5. **Reset links built from the Host header.** In production the link must use one of our own
   addresses.
6. **Remembered devices survived a password reset.** A reset now forgets them.
7. **Team sign-in could fall back to a password alone** if the approval settings went missing on
   Vercel. On Vercel it now locks team members out instead (fail closed).

## Known and accepted

- Someone who knows an email can lock that account's login for 15 minutes by guessing (the price of
  stopping rotating-address guessing).
- Forgot-password takes slightly longer when the email exists (the mail is sent), which a patient
  attacker could measure. Low risk; fix by sending mail after the response.
- `GET /api/public/resolve-host` tells anyone whether a school address exists and its name.
- `uuid` (moderate advisory) inside `firebase-admin` -> `google-gax`. It affects a call style this
  app does not use.
- The content policy allows inline scripts and styles because Next.js writes some itself. A
  nonce-based policy would be stricter.
- Same-school isolation between two different families was reviewed in code (every query filters
  by the signed-in guardian) but not attack-tested: the demo data has one guardian for all students.

## Settings that must exist on Vercel

`BANK_ENC_KEY` (bank account numbers cannot be read or saved without it), `FIREBASE_SERVICE_ACCOUNT`
(team sign-in approval), `BREVO_API_KEY`, `VAPID_*`, `VERCEL_TOKEN` and `VERCEL_PROJECT_ID` (adds each new school's two
addresses to the project; also `VERCEL_TEAM_ID` if the project is in a team. The token can add and
remove domains, so keep it only on the `school` project). Optional: `APP_ORIGIN` (the address used in
e-mailed links if a request arrives on an unknown host).
