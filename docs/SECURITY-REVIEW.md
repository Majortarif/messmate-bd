# Security review — MessMate BD

**Date:** 23 October 2026 · **Scope:** the whole repository at the end of Phase 9 (Next.js
app, Supabase schema / RLS / RPCs / storage, deployment config, dependencies).
**Method:**

- Read the code and the policies.
- Queried the database catalog after loading every migration (grants, policies, function
  privileges, views, buckets).
- Ran bypass inputs against the redirect check.
- Ran `npm audit`.
- Checked the response headers of a production build.

## Summary

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | Open redirect after sign-in with `?next=/%09/evil.com` or `?next=/..//evil.com` | Medium | **Fixed** |
| 2 | `get_public_profiles` returned the full name of any user id, undoing short-name privacy | Medium (privacy) | **Fixed** |
| 3 | CSV exports could carry spreadsheet formulas (`=HYPERLINK(…)`) from user text | Medium | **Fixed** |
| 4 | No Content-Security-Policy or HSTS header | Low (hardening) | **Fixed** |
| 5 | Write grants left on RPC-only tables (RLS already blocked the writes) | Low (defence in depth) | **Fixed** |
| 6 | Anonymous contact form shares one global rate limit | Low | Accepted, see below |
| 7 | Photo URL columns accept any `https` URL when written straight through the API | Low | Mitigated by CSP |
| 8 | CSP allows inline scripts | Low | Accepted, see below |
| 9 | Export routes for the ledger, statements and mess backup have no rate limit | Low | Accepted, see below |
| 10 | Demo seed accounts share a public password | Info | Documented in the launch checklist |

No critical or high issues were found. `npm audit` reports **0 vulnerabilities** in the app
and in the database test runner.

---

## Fixed

### 1. Open redirect after sign-in

`/login?next=…` sends the user on after a successful sign-in. The old check only blocked
values starting with `//` or `/\`. Browsers delete tabs and newlines from URLs, so
`/%09/evil.com` became `//evil.com`, another host. `/..//evil.com` did the same after
path normalisation. This made a convincing phishing link: a real MessMate login that
lands on a fake site.

**Fix:** [`safeNext`](../src/lib/validations/auth.ts) now parses the value against a fixed
origin. It accepts the result only when the origin is unchanged and the normalised path
does not start with `//`. Tested with 13 bypass strings (tab, CR/LF, backslashes, dot
segments, encoded dots, absolute URLs). The OAuth callback and the email-confirm route use
the same function.

### 2. Full names by user id

Community tables (listings, market items, reviews, roommate profiles) expose user ids by
design. `public.get_public_profiles(uuid[])` gave any signed-in user the full name and
avatar for up to 200 ids at a time. That undid the short-name rule from migration 0018
("Rafi A." for people outside your mess). The app no longer called it.

**Fix:** dropped in
[`0020_security_hardening.sql`](../supabase/migrations/0020_security_hardening.sql). The
RLS suite now checks that no such RPC exists.

### 3. CSV formula injection

Names, descriptions and notes are user text, and managers open the CSV exports in Excel. A
member named `=HYPERLINK("https://evil.example","Click")` would become a live formula.

**Fix:** [`toCsv`](../src/lib/csv.ts) prefixes an apostrophe to any text cell that starts
with `=`, `+`, `-`, `@`, tab or CR. Plain numbers such as `-250.00` are left alone, so
amounts stay numeric.

### 4. Content-Security-Policy and HSTS

**Fix:** production responses now carry ([`next.config.ts`](../next.config.ts)):

```text
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://<supabase>
  https://lh3.googleusercontent.com https://tile.openstreetmap.org; font-src 'self';
  connect-src 'self' https://<supabase> wss://<supabase>; worker-src 'self';
  manifest-src 'self'; frame-src 'none'; frame-ancestors 'none'; object-src 'none';
  base-uri 'self'; form-action 'self'
Strict-Transport-Security: max-age=63072000
```

These sit next to the existing `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy` and `Permissions-Policy`. Even if an XSS bug existed, scripts, frames and
data requests to unknown hosts would be blocked. The Supabase host is read from
`NEXT_PUBLIC_SUPABASE_URL` at build time. The dev server sends no CSP because hot reload
needs `eval`.

### 5. Write grants on RPC-only tables

Supabase grants `INSERT / UPDATE / DELETE` on every new public table to `authenticated`.
For 23 tables that are written only through `SECURITY DEFINER` RPCs (ledger, deposits,
statements, closings, bill shares, meal orders, membership, polls, Care alerts, audit log
and others), RLS already refused those writes because no policy allowed them.

**Fix:** migration 0020 revokes the grants, so a future policy mistake cannot open them. A
new structural test fails if any table keeps a write grant that no policy uses. Writing to
the ledger now fails with `permission denied` before RLS is even consulted.

---

## Accepted risks

**6. Anonymous contact form.** Signed-out visitors share one bucket of 30 messages an hour.
Signed-in users have their own limit of 10 an hour. A spammer could use up the anonymous
bucket for an hour, but cannot flood the database: messages are capped at 2,000
characters. *If abused:* add Cloudflare Turnstile to `/feedback`, or a per-IP limit at the
edge.

**7. Photo URL columns.** The app writes only Supabase Storage URLs. A user could still put
any `https` URL in their own `avatar_url` (or their own listing photo row) through the REST
API. Messmates' browsers will not load it: the CSP `img-src` allows only our origin,
Supabase, Google avatars and map tiles. *Later:* store storage paths instead of URLs.

**8. Inline scripts in the CSP.** Next.js streams its payload in inline `<script>` tags,
and the theme script must run before paint. A nonce-based CSP would make every page
dynamic and give up static shells and partial prerendering. React escapes all
user-supplied text, and the only `dangerouslySetInnerHTML` uses are the static theme
script and chart colour CSS built from constants.

**9. Export routes.** `/api/export/ledger`, `/statements` and `/mess` return only rows the
caller's RLS allows, and the mess backup is manager-only (403 otherwise). Only "export my
data" is rate limited (it builds a large JSON in the database). *If abused:* move the mess
backup behind an RPC that calls `private.check_rate_limit`.

**Session cookies.** `@supabase/ssr` keeps the session in cookies that JavaScript can read,
because the browser client needs the token for Storage uploads and Realtime. This is
Supabase's standard design. The CSP and React's escaping are the guard against token theft
by XSS.

---

## Controls in place

| Area | Control |
|---|---|
| Tenant isolation | RLS on every public table, keyed to the caller's membership (`private.current_mess_id()`, `private.managed_mess_id()`); 132 isolation checks in CI |
| Money | balance = `sum(ledger)`; ledger rows immutable (trigger + no grants); closed months locked; every money write is a `SECURITY DEFINER` RPC that re-checks role and mess; duplicate and malformed TrxIDs rejected |
| Functions | every `SECURITY DEFINER` function pins `search_path = ''` (checked in CI); `EXECUTE` revoked from `anon` on everything except `submit_feedback`; maintenance functions (`purge_data`, cron jobs) also require `is_system_call()`; the `private` schema is not exposed by the Data API |
| Input validation | Zod in the browser, again in every server action, then CHECK constraints and RPC checks in Postgres; server actions return error keys, never raw database messages |
| Rate limits | in Postgres for deposits, joins, invite lookups, mess creation, complaints, polls, listings, market items, services, Care alerts, feedback and data export |
| Storage | per-bucket size and MIME limits; private buckets (receipts, deposit proofs, complaint photos, personal) read through 1-hour signed URLs; uploads only into the uploader's own folder (or, for managers, their mess's folder) |
| Privacy | Care data (mood, alerts, check-ins, reminders, loans) is owner-only, so managers and super admins can't read it; strangers see short names; roommate profiles are private rows; export and delete-my-data built in |
| Auth | Supabase Auth with email confirmation; password ≥ 8 characters with a letter and a number; PKCE for OAuth; token-hash email links; `proxy.ts` verifies the JWT with `getClaims()` on every request, and the data layer uses the server-checked `getUser()` |
| Secrets | only `NEXT_PUBLIC_*` values reach the browser; the secret key is read in one `server-only` module and used only to delete an auth user; `.env*` ignored by git; CI builds without any secret |
| Headers | CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` (camera and mic off, geolocation self only) |
| Dependencies | `npm audit` clean; Next.js 16.4.2 includes the 14 October 2026 security update (RCE in `use cache` with typed arrays, which this app uses for the areas list, plus Image Optimization RCE and Server Actions DoS); Dependabot opens weekly update PRs |

## Checklist for new features

- **New table:** enable RLS, add a policy for each command users really need, revoke the
  other write grants, and add isolation checks to `tests/rls_isolation.sql`.
- **New RPC:** `security definer set search_path = ''`, `revoke execute … from public,
  anon`, check the caller's role and mess inside, raise short error keys, and rate-limit
  anything spammable.
- **New upload:** bucket size/MIME limits, and a storage policy restricted to the
  uploader's folder. Private buckets get signed URLs only.
- **New external host** (images, API, map): add it to the CSP in `next.config.ts`.
- **New redirect parameter:** pass it through `safeNext`.
- **New CSV column:** go through `toCsv`.

## Reporting a vulnerability

See [`SECURITY.md`](../SECURITY.md).
