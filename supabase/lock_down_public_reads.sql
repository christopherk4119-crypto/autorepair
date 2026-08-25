-- ============================================================================
-- Auto Repair Xperts — Lock Down Public Reads
-- ============================================================================
-- Run this in the Supabase SQL Editor AFTER admin_auth_setup.sql has already
-- been run (this migration assumes is_admin() already exists).
--
-- THE PROBLEM THIS FIXES:
-- Every table currently has a "public read ... using (true)" policy, meaning
-- ANYONE who has the site's public anon key (which is not a secret — it's
-- sitting in the page's own code, visible to any visitor) can ask Supabase
-- for the ENTIRE members / benefits_used / service_history / appointments
-- table in one request. Not "log in as someone else" — just directly ask
-- for every row, no login at all. That's every customer's name, email,
-- vehicle, VIN, and service history, dumpable in one shot.
--
-- THE FIX:
-- Reads are now admin-only at the database level, same as writes already
-- are. The admin panel keeps working exactly as before (it already logs in
-- with real Supabase Auth, so is_admin() recognizes it). The member portal
-- and public appointment booking, which have no real login, now go through
-- three small server-side functions (api/member-login.js,
-- api/check-availability.js, api/member-cancel-appointment.js) that use a
-- private service-role key — a real secret that lives only in Vercel's
-- environment variables, never in the browser — to look up exactly one
-- matching record and return only that. The browser can no longer read the
-- tables directly at all.
-- ============================================================================


-- 1. members — was: "public read members" using (true). Now admin-only.
--    Member login moves to api/member-login.js.
drop policy if exists "public read members" on members;
create policy "admin read members"
  on members for select
  using (is_admin());


-- 2. benefits_used — was: "public read benefits_used" using (true). Now
--    admin-only. Member portal gets this data from api/member-login.js.
drop policy if exists "public read benefits_used" on benefits_used;
create policy "admin read benefits_used"
  on benefits_used for select
  using (is_admin());


-- 3. service_history — was: "public read service_history" using (true).
--    Now admin-only. Member portal gets this data from api/member-login.js.
drop policy if exists "public read service_history" on service_history;
create policy "admin read service_history"
  on service_history for select
  using (is_admin());


-- 4. appointments — was: "public read appointments" using (true). Now
--    admin-only. The double-booking availability check (which needs to see
--    booked time slots before a member has "logged in") moves to
--    api/check-availability.js. The "public book appointments" INSERT
--    policy is untouched — anonymous booking still works exactly as before.
drop policy if exists "public read appointments" on appointments;
create policy "admin read appointments"
  on appointments for select
  using (is_admin());


-- ============================================================================
-- STEP — verify. Run this after everything above:
--
--   select schemaname, tablename, policyname, cmd,
--          qual as using_expr, with_check as check_expr
--   from pg_policies
--   where tablename in ('members','benefits_used','service_history','appointments')
--     and cmd = 'SELECT'
--   order by tablename;
--
-- Every row's using_expr should say "is_admin()" — if any row still says
-- "true" on its own, that table is still fully readable by anyone and this
-- migration didn't fully apply.
--
-- AFTER RUNNING THIS: member login, appointment booking, and appointment
-- cancellation on the live site will all break UNTIL the matching code
-- (api/member-login.js, api/check-availability.js,
-- api/member-cancel-appointment.js) is deployed AND the
-- SUPABASE_SERVICE_ROLE_KEY environment variable is set in Vercel. Where to
-- find that key: Supabase dashboard → Project Settings → API → "service_role
-- secret" (NOT the "anon public" key — the service_role key bypasses RLS
-- entirely, so treat it like a password and never put it in any file that
-- gets committed to git or sent to a browser).
-- ============================================================================
