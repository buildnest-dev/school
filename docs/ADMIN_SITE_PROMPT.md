Copy everything below the line into the Claude Code chat of the admin.zaqsa.com project.

---

admin.zaqsa.com is now the only place where ZAQSA team members sign in. The team site (https://team.schools.zaqsa.com, a separate project, already built) has no password form: it sends people here and trusts a signed token from this site. Build the sign-in on this site and the handoff.

## 1. Sign-in to this site (strong, because it unlocks every school's data)
- Only people on an allow-list may sign in. Keep the allow-list in an environment variable `ADMIN_ALLOWED_EMAILS` (comma separated, lowercase), and refuse everyone else, even with a correct password.
- Use a password plus a second step: a 6 digit authenticator-app code (TOTP) or an email one-time code. Do not accept a password alone. Rate-limit attempts (for example 5 per 15 minutes per email and per IP) and show one generic error for any failure.
- Store the password only as a bcrypt/argon2 hash. The session is a random id in an httpOnly, secure, sameSite=lax, host-only cookie (no Domain attribute), 8 hours, with Sign out. Add `X-Robots-Tag: noindex`.
- Protect every editor page and every editor API route (reads and writes) with that session. Signed-out: pages go to the sign-in page, APIs return 401.

## 2. Route `GET /sso/team?return=<url>&state=<value>`
This is where the team site sends people. Behave exactly like this:
- If the visitor has no valid session, send them to the sign-in page and come back to this same URL afterwards (keep the full query string; accept only a return path that starts with `/sso/team?`).
- `return` must be exactly `https://team.schools.zaqsa.com/api/platform/sso/callback`. Reject anything else with 400 (an environment variable `TEAM_CALLBACK_URL` can hold this value). `state` must be 16-200 characters.
- Then create a JWT and redirect to `<return>?token=<jwt>&state=<state>`.
- The JWT: algorithm HS256 only, signed with the environment variable `SSO_SHARED_SECRET` (the same value is set on the team site; 32+ characters). Claims: `iss` = "zaqsa-admin", `aud` = "https://team.schools.zaqsa.com", `sub` = the person's id here, `email` = their email (lowercase), `name`, `state` = the exact state received, `iat`, and `exp` = iat + 60 seconds. Use `jose` or node:crypto.
- Send `Cache-Control: no-store`. Never log the token or put it anywhere except that one redirect.

The team site checks the signature, issuer, audience, expiry and state, and only lets in an email that already exists as an active ZAQSA team account in its own database, so the email here must be the same one as that account (surajitsadhukhan870@gmail.com for the first one).

## 3. Roles
This site keeps its own editor roles; the team site decides team permissions by itself. Only people on `ADMIN_ALLOWED_EMAILS` may use the editor.

## 4. Tests and hand-over
Test: a person not on the allow-list is refused; wrong state, wrong return URL, an expired token and a changed email in the token are all refused; the token has the claims above and lives 60 seconds. Tell me exactly which environment variables to add in Vercel (`SSO_SHARED_SECRET`, `ADMIN_ALLOWED_EMAILS`, `TEAM_CALLBACK_URL`, and anything for the second step) and how I create the first sign-in (the first password and the authenticator setup) without leaving a default password anywhere.
