# MessMate BD — database (Supabase / PostgreSQL)

Everything the app stores lives here: schema, Row Level Security, triggers, RPCs,
storage buckets, scheduled jobs, demo seed and the SQL test suites.

## Files

| Path | What it is |
|---|---|
| `migrations/0001_foundation.sql` | schemas, enums, Dhaka-time helpers |
| `migrations/0002_core.sql` | areas, profiles, messes, membership, notifications, audit log, rate limiter, join / leave RPCs |
| `migrations/0003_wallet.sql` | immutable ledger, month locks, deposit requests (manual TrxID) |
| `migrations/0004_meals.sql` | daily menu, cutoff, orders, guest meals, fixed-price charging |
| `migrations/0005_billing.sql` | expenses, bills + splitting, monthly closing (auto meal rate) |
| `migrations/0006_housing.sql` | listings, roommate matching, rent tracker, move checklists |
| `migrations/0007_community.sql` | complaints, chores, polls, notices, services, marketplace, emergency, budget |
| `migrations/0008_care.sql` | sick mode, SOS, check-ins, reminders, loans, recipes, events, jobs |
| `migrations/0009_reports.sql` | dashboards, moderation, export / delete my data, cron job bodies |
| `migrations/0010_rls.sql` | RLS policies for every table + grants |
| `migrations/0011_storage_realtime.sql` | storage buckets + policies, Realtime publication |
| `migrations/0012_reference_data.sql` | Dhaka areas, helplines, hospitals, recipes |
| `migrations/0013_cron.sql` | pg_cron schedules (run separately) |
| `migrations/0014_payment_numbers.sql` | bKash / Nagad / Rocket numbers in mess settings |
| `migrations/0015_meal_mode_guard.sql` | blocks switching meal-rate mode while a month has orders |
| `migrations/0016_manager_sees_former_members.sql` | managers can still see people who left |
| `migrations/0017_admin_reports.sql` | activity log, monthly mess report, super admin directories |
| `migrations/0018_community_names.sql` | short display names for community posts, roommate matches with English areas |
| `migrations/0019_mess_life_care.sql` | one-call read models for polls, the Care hub and a Care alert |
| `migrations/0020_security_hardening.sql` | drops the full-name lookup RPC, revokes write grants on RPC-only tables |
| `setup.sql` | **generated** bundle of every migration except 0013 (cron), for one paste |
| `seed.sql` | optional demo data (2 messes, 17 users, 60 days of history) |
| `remove_demo.sql` | deletes all demo data |
| `email-templates/` | token-hash "Confirm signup" and "Reset password" emails (Bangla + English) |
| `tests/rls_isolation.sql` | proves messes are isolated (132 checks) |
| `tests/functional.sql` | business-rule checks (147 checks) |
| `tests/pglite/` | runs all of the above locally in PGlite |

## Set up a Supabase project

1. Create a free project at [supabase.com](https://supabase.com). Pick the **Mumbai** or
   **Singapore** region (closest to Dhaka) and save the database password.
2. Open **SQL Editor → New query**, paste the whole of `setup.sql`, and run it.
3. Open **Database → Extensions** and enable **pg_cron**. Then paste and run
   `migrations/0013_cron.sql`.
4. Optional: run `seed.sql` for demo data. Every demo account uses the password
   `Demo@12345` (manager: `rafi@messmate.demo`, member: `tanvir@messmate.demo`).
5. Optional: run `tests/rls_isolation.sql` and `tests/functional.sql`. Each one cleans up
   after itself and ends with a single row such as `RLS isolation: 132 checks passed`.
6. Make your own account the platform owner (after you sign up in the app):

   ```sql
   update public.profiles set platform_role = 'super_admin' where email = 'you@example.com';
   ```

7. Before inviting real users you can run `remove_demo.sql`.

**Already ran an older `setup.sql`?** Don't run the whole bundle again. Paste only the
migration files that are newer than your last run, one at a time and in order (for
example `0014` → `0020`). Each file is safe to run once.

Auth settings (redirect URLs, Gmail SMTP, the email templates and Google login) are in
the [deployment guide](../docs/DEPLOYMENT.md#1-create-the-supabase-project).

## Run everything locally (no Supabase account needed)

```bash
cd supabase/tests/pglite
npm install
npm test
```

This loads a small Supabase stand-in (`supabase-shim.sql`), applies every migration,
the seed and both test suites in an in-memory Postgres, and regenerates `setup.sql`.
After editing any migration, run it again.

## Rules the schema enforces

- **Tenant isolation.** Every mess-scoped table filters by `private.current_mess_id()`
  (member) or `private.managed_mess_id()` (manager) in its RLS policy. A user has at
  most one pending / active / inactive membership.
- **Money is a ledger.** A balance is always `sum(ledger_entries.amount)`. Ledger rows
  cannot be updated or deleted; corrections are reversal entries. Closed months reject
  new entries, menus, orders, expenses and bills.
- **Writes that move money go through RPCs** (`submit_deposit`, `review_deposit`,
  `set_meal_order`, `post_bill`, `close_month`, …), which check the caller's role again
  inside the database and raise short error keys such as `insufficient_balance`.
- **No real money moves.** bKash / Nagad / Rocket TrxIDs are verified by hand by the
  manager. Duplicate TrxIDs in a mess are rejected.
- **Care data is private.** Mood, health alerts, reminders, loans and check-ins are
  readable only by their owner (and an alert by the people it was sent to). Managers
  and super admins cannot read them.
- **Rate limits** live in Postgres (`private.check_rate_limit`) for deposits, joins,
  feedback, alerts, listings and other spam-prone actions.

## Free-tier notes

- Free projects pause after about a week with no traffic; pg_cron jobs don't run while
  paused and catch up on the next run.
- Read notifications older than 90 days and expired rate-limit rows are deleted daily to
  stay well inside the 500 MB database limit. Images are compressed in the browser
  before upload (1 GB storage limit).
