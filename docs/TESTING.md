# Testing MessMate BD

Three layers: automated checks that run on every push, SQL suites that prove the database
rules (including that one mess can never see another), and a manual checklist for what only
a person with a phone can judge.

| Layer | Command | Where it runs | Covers |
|---|---|---|---|
| Static checks | `npm run check` | local, CI | ESLint, TypeScript (strict, typed routes), Bangla/English message parity |
| Build | `npm run build` | local, CI, Netlify | every route compiles and prerenders without Supabase secrets |
| Database | `npm run db:test` | local, CI | all migrations + seed + **132 RLS isolation** and **147 functional** checks in PGlite |
| Database, live | paste `supabase/tests/*.sql` | Supabase SQL editor | the same suites on your real project; each run cleans up after itself |
| Manual | this file | browser + phone | flows, design, devices, accessibility |

CI ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)) runs the first three on
every push to `main` and every pull request. It also fails if `supabase/setup.sql` is out
of date with the migrations.

---

## 1. Automated database suites

### `supabase/tests/rls_isolation.sql` — who can see and change what

It creates two messes (A and B) with a manager and a member each, a pending applicant, an
outsider, a super admin and an anonymous visitor. Then it signs in as each of them (by
setting the JWT claims Supabase uses) and tries to read and write everything.

| Actor | Proves, among others |
|---|---|
| Member of mess A | sees only mess A's members, menus, orders, ledger, bills, notices, complaints, polls and receipts. Cannot write the ledger, approve deposits, post notices, add expenses, or upload into another mess's storage folder. Cannot read anyone's Care data. |
| Manager of mess A | manages mess A only. Every write aimed at mess B fails, and they still cannot read members' Care data (mood, alerts, reminders, loans). |
| Manager of mess B | sees none of mess A's rows. |
| Pending applicant | sees nothing of the mess until approved. |
| Outsider | signed in with no mess: sees public listings, services and market items, and nothing mess-scoped. |
| Anonymous | reads only areas and emergency places, and can only send the contact form. |
| Super admin | can switch a mess off and on and moderate listings, but has no mess report of their own and no Care access. |
| Structure | every public table has RLS; every `SECURITY DEFINER` function pins `search_path`; no write grant exists without a policy that uses it; anon cannot write any table; only `submit_feedback` is callable by anon; every view runs with the caller's rights; nobody can `TRUNCATE` the ledger; no RPC returns full names by user id. |

### `supabase/tests/functional.sql` — the business rules

The 147 checks include:

- **Money:** duplicate or malformed TrxIDs are rejected, and approving a deposit credits the ledger and notifies the member. Ledger rows cannot be edited even by their owner, and a low-balance alert fires when the balance crosses the threshold.
- **Meals:** an order is charged and a cancellation is refunded in full. Orders after the cutoff are blocked, and the price locks once charged. Guests and half breakfasts count correctly, and the meal-rate mode cannot change while the open month has orders.
- **Bills & closing:** ৳100 ÷ 3 spreads the paisa fairly, a bill posts once, and a member who paid from pocket is reimbursed. The running month cannot be closed, a month closes once, and closed reports match the frozen statements.
- **Membership:** invite codes work, the last manager cannot leave, and terms must be accepted first.
- **Care:** alerts reach only their recipients, there is no duplicate alert spam, and cron flags overdue check-ins. Reminders fire once a day, and loan repayments add up.
- **Community:** roommate matching scores correctly, strangers see short names, and pending listings stay hidden.
- **Account deletion:** personal data goes, and the mess ledger stays balanced for everyone else.

### Run them on the live project

1. Supabase → **SQL Editor** → paste `supabase/tests/rls_isolation.sql` → **Run**.
2. Expect a single row: `RLS isolation: 132 checks passed`. Any failure stops with
   `FAIL: <what>` and rolls everything back.
3. Same for `functional.sql` → `Functional: 147 checks passed`.

Run them after every new migration, before announcing a release.

---

## 2. Manual multi-mess isolation test

The SQL suites test the database directly. This test goes through the real app and the
public API, the way an attacker with a normal account would.

**Setup:** four accounts (use `+tags`, e.g. `you+a1@gmail.com`) in two browsers or
private windows.

| Account | Role |
|---|---|
| A1 | creates **Mess A** (manager) |
| A2 | joins Mess A (member) |
| B1 | creates **Mess B** (manager) |
| B2 | joins Mess B (member) |

Give each mess a few meals, a deposit, an expense with a receipt photo, a bill, a notice, a
complaint with a photo and a poll.

### Through the app

| # | Do this | Expected |
|---|---|---|
| 1 | As A2, open every page in the sidebar | only Mess A's data anywhere; no Mess B names, amounts or photos |
| 2 | As B2, copy the URL of their Care alert (`/care/alerts/<id>`), move checklist (`/housing/move/<id>`) or a listing's edit page (`/housing/<id>/edit`). Open each as A2 | not found or redirected, never B2's content |
| 3 | As A1, open `/statement/<month>` and the CSV exports | only Mess A members |
| 4 | As A2 (member), open `/manage`, `/manage/approvals`, `/admin` | redirected to the dashboard |
| 5 | As A1, copy a receipt or deposit-proof image link. Open it more than an hour later | the signed link has expired and shows an error, not the image |
| 6 | As B2, look for A2 in **Housing → Roommates**, the marketplace and service reviews | at most a short name like "Tanvir A.", never the full name, phone or mess |
| 7 | As A2, send an SOS. As B1 and B2, open **Care** | they see nothing; only A2's chosen recipients get it |
| 8 | As A1, try to approve A2's deposit twice from two tabs | the second approval fails; the balance rises once |
| 9 | Sign out, open `/dashboard`, `/wallet`, `/api/export/me` | login page, or 401 for the API |
| 10 | Open `/login?next=//evil.com` and `/login?next=/%09/evil.com`, then sign in | you land on the dashboard, never on another site |

### Through the public API (what RLS really enforces)

The publishable key is public, so anyone can call Supabase directly. Sign in as A2 and use
their token:

```bash
URL=https://<project-ref>.supabase.co
KEY=sb_publishable_...   # the public key

# 1. A2's access token (password login)
TOKEN=$(curl -s "$URL/auth/v1/token?grant_type=password" \
  -H "apikey: $KEY" -H "Content-Type: application/json" \
  -d '{"email":"you+a2@gmail.com","password":"<A2 password>"}' | jq -r .access_token)

# 2. Read attempts: every row must belong to Mess A (or A2)
curl -s "$URL/rest/v1/ledger_entries?select=mess_id,user_id,amount" -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN"
curl -s "$URL/rest/v1/mess_members?select=mess_id,user_id,role"     -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN"
curl -s "$URL/rest/v1/mood_checkins?select=*"                        -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN"

# 3. Write attempts: all must fail
curl -s -X POST "$URL/rest/v1/ledger_entries" -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"mess_id":"<mess B id>","user_id":"<A2 id>","entry_type":"deposit","amount":100000}'
#    → 403 "permission denied for table ledger_entries"
curl -s -X POST "$URL/rest/v1/rpc/review_deposit" -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"p_request_id":"<A2 deposit id>","p_approve":true}'
#    → error "not_manager"

# 4. Without a token (anonymous)
curl -s "$URL/rest/v1/profiles?select=*" -H "apikey: $KEY"   # → 401 permission denied for table profiles
```

Repeat step 2 as B1 and confirm that nothing from Mess A comes back. Use only accounts
you own, on your own project.

---

## 3. Manual QA checklist

Test on a real Android phone (Chrome) and an iPhone (Safari), plus a desktop browser.
Widths: **360, 390, 768, 1440**.

### Auth & onboarding
- [ ] Sign up (Bangla and English) → confirmation email → onboarding opens in the same language
- [ ] Terms must be accepted before anything else
- [ ] Google sign-in, sign-out, sign-in again
- [ ] Forgot password → email → new password works; old one doesn't
- [ ] Wrong password shows a friendly error, not a technical one
- [ ] Create a mess → invite link and code; join with the code from another account; approve; reject a second request

### Meals
- [ ] Order and cancel before the cutoff; blocked after it, with the reason shown
- [ ] Guest meal adds to the count and cost
- [ ] Manager menu planner: set prices, lock a day, see attendance
- [ ] Fixed-rate and auto-rate messes both show the right cost

### Wallet & money
- [ ] Add money with bKash / Nagad / Rocket (TrxID + screenshot) and cash; "the app never moves real money" is visible
- [ ] Same TrxID twice is rejected
- [ ] Manager approves → member's balance and notification update without a reload (Realtime)
- [ ] Reversal and adjustment entries show in the history; nothing can be edited
- [ ] Low-balance alert appears
- [ ] Wallet CSV opens in Excel with Bangla intact; a name starting with `=` shows as text

### Bills & month closing
- [ ] Expense with receipt photo; member-paid expense reimburses the member
- [ ] Bill split: equal, by room, custom; a posted bill can only be voided
- [ ] Close the month → statements, carry-forward balances, printable statement (Print → PDF keeps Bangla shaping), CSV

### Manager & reports
- [ ] Overview charts render, switch to table view, follow the theme
- [ ] Reports for past months, full CSV backup, activity log lists who did what
- [ ] Member actions: deactivate, change room, make manager

### Housing & community
- [ ] Post a listing with photos and a map pin → pending → super admin approves → visible to others
- [ ] Filters (area, rent, type), list ↔ map, save a listing
- [ ] Roommate profile and matches with scores; strangers see short names
- [ ] Rent tracker, move-in/out checklist with photos, printable handover
- [ ] Marketplace item and service with review/rating; report an item

### Mess life
- [ ] Notice (pinned), complaint with photo → manager updates status → member notified
- [ ] Poll: vote, change vote, results; anonymous poll hides names
- [ ] Roster: generate round-robin, mark done

### Care
- [ ] SOS and sick mode: recipients notified, location link, WhatsApp/SMS and 999 buttons work on a phone
- [ ] "Reached home" check-in: missing it alerts the chosen people (cron, within ~5 min)
- [ ] Mood check-in, helplines, water counter, reminders, call-home nudge
- [ ] Budget, survival mode, loans (dhar) add up
- [ ] Recipes, tiffin finder, events RSVP, tuition board
- [ ] As the manager, confirm none of a member's Care data is visible

### Trust & account
- [ ] Privacy and Terms in both languages; footer links work signed out
- [ ] Floating feedback button on every app page; the public `/feedback` page; super admin sees both in **Admin → Feedback**
- [ ] Settings: avatar, profile, password, leave mess (balance warning)
- [ ] Export my data downloads JSON with my own records only
- [ ] Delete account (type DELETE) → `/account-deleted`; signing in again doesn't reach the app

### Super admin
- [ ] Platform stats, messes (switch off/on), users (role change), moderation, feedback, activity log

### Cross-cutting
- [ ] **Language:** every screen in Bangla and English; Bangla digits in amounts and dates; no missing-key text
- [ ] **Theme:** dark (default) and light; charts and maps readable in both
- [ ] **PWA:** install from Chrome / Safari "Add to Home Screen"; opens full screen with the icon; airplane mode shows the offline page
- [ ] **Responsive:** no sideways scrolling at 360 px; bottom nav on phones, sidebar on desktop
- [ ] **Keyboard:** Tab reaches every control in order, focus ring visible, dialogs trap focus and close on Esc
- [ ] **Screen reader:** form fields have labels; icon buttons have names (TalkBack / VoiceOver spot check)
- [ ] **Reduced motion:** with the OS setting on, charts and transitions don't animate
- [ ] **Loading / empty / error states:** slow 3G throttling shows skeletons; empty lists explain what to do; a failed save shows a toast
- [ ] **Security headers:** `curl -I https://your-site` shows `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options: DENY`
- [ ] **Lighthouse** (mobile) on the landing page: Performance, Accessibility, Best Practices, SEO all green

## Reporting a bug

Use the in-app feedback button (type "Bug"). It records the page URL automatically. Or open
a GitHub issue with: what you did, what you expected, what happened, the device and browser,
and a screenshot. Never include passwords or full TrxIDs.
