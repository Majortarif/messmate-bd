-- =============================================================================
-- MessMate BD · 0013 · Scheduled jobs (pg_cron)
--
-- Run this file on its own AFTER setup.sql. If `create extension` fails, enable
-- "pg_cron" in Supabase Dashboard → Database → Extensions (or Integrations →
-- Cron), then run the two cron.schedule lines again.
--
-- Times are UTC. Dhaka is UTC+6, so 18:30 UTC = 00:30 in Dhaka.
-- Note: free Supabase projects pause after a week with no traffic; paused
-- projects do not run cron jobs. The jobs catch up safely when it resumes.
-- =============================================================================

create extension if not exists pg_cron;

-- Overdue "reached home" check-ins + medicine / water / sleep reminders.
select cron.schedule('messmate-every-5-min', '*/5 * * * *', $$select private.process_due_jobs()$$);

-- Month auto-close, poll / job expiry, rent reminders, housekeeping.
select cron.schedule('messmate-daily', '30 18 * * *', $$select private.run_daily_jobs()$$);
