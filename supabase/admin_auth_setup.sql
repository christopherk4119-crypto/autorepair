-- ============================================================================
-- Auto Repair Xperts — Admin Auth + RLS Setup
-- ============================================================================
-- Run this in the Supabase SQL Editor (Project → SQL Editor → New Query).
-- Do this AFTER you've created the admin's login user (see step 0 below),
-- and BEFORE the site's next deploy switches admin login over to it —
-- otherwise admin login will stop working until this has run.
--
-- What this does:
--   1. Creates an admin_users table marking which Supabase Auth users are staff.
--   2. Adds an is_admin() helper used by RLS policies below.
--   3. Turns on Row Level Security for all 4 app tables.
--   4. Locks down INSERT/UPDATE/DELETE to admins only, EXCEPT appointment
--      booking (members book their own appointments with no login).
--   5. Leaves SELECT (reading) open to anyone holding the anon key, matching
--      current behavior — the member portal still isn't using real customer
--      accounts, so tightening reads further is a separate follow-up.
-- ============================================================================


-- STEP 0 — create the admin login (do this first, in the dashboard UI):
--   Authentication → Users → Add user
--   Email: whatever you want staff to log in with (e.g. admin@autorepairxperts.com)
--   Password: a strong password — this replaces ARPX-ADMIN-2026 entirely
--   Auto Confirm User: ON (so it doesn't require an email confirmation click)
--
-- Then come back here and run everything below.


-- 1. Table marking which Supabase Auth users are admins/staff
create table if not exists admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

alter table admin_users enable row level security;

-- Only an already-recognized admin can see the admin list
drop policy if exists "admins can read admin_users" on admin_users;
create policy "admins can read admin_users"
  on admin_users for select
  using (auth.uid() = user_id);


-- 2. Helper function used inside RLS policies below
create or replace function is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from admin_users where user_id = auth.uid()
  );
$$;


-- 3. Register your admin user — replace the email with the one you created in Step 0
insert into admin_users (user_id)
select id from auth.users where email = 'REPLACE_WITH_YOUR_ADMIN_EMAIL'
on conflict (user_id) do nothing;


-- 4. Turn on RLS for the app's tables
alter table members enable row level security;
alter table benefits_used enable row level security;
alter table service_history enable row level security;
alter table appointments enable row level security;


-- 5. members — admin-only writes (Add/Delete Member, Change Plan all go
--    through the admin panel). Reads stay open for member self-login.
drop policy if exists "public read members" on members;
create policy "public read members"
  on members for select
  using (true);

drop policy if exists "admin write members" on members;
create policy "admin write members"
  on members for insert
  with check (is_admin());

drop policy if exists "admin update members" on members;
create policy "admin update members"
  on members for update
  using (is_admin())
  with check (is_admin());

drop policy if exists "admin delete members" on members;
create policy "admin delete members"
  on members for delete
  using (is_admin());


-- 6. benefits_used — only the admin panel writes here (Mark Benefit Used,
--    Reset Usage & Renew). Reads stay open for the member portal.
drop policy if exists "public read benefits_used" on benefits_used;
create policy "public read benefits_used"
  on benefits_used for select
  using (true);

drop policy if exists "admin write benefits_used" on benefits_used;
create policy "admin write benefits_used"
  on benefits_used for insert
  with check (is_admin());

drop policy if exists "admin update benefits_used" on benefits_used;
create policy "admin update benefits_used"
  on benefits_used for update
  using (is_admin())
  with check (is_admin());

drop policy if exists "admin delete benefits_used" on benefits_used;
create policy "admin delete benefits_used"
  on benefits_used for delete
  using (is_admin());


-- 7. service_history — written only by the admin panel (Mark Benefit Used).
drop policy if exists "public read service_history" on service_history;
create policy "public read service_history"
  on service_history for select
  using (true);

drop policy if exists "admin write service_history" on service_history;
create policy "admin write service_history"
  on service_history for insert
  with check (is_admin());

drop policy if exists "admin update service_history" on service_history;
create policy "admin update service_history"
  on service_history for update
  using (is_admin())
  with check (is_admin());

drop policy if exists "admin delete service_history" on service_history;
create policy "admin delete service_history"
  on service_history for delete
  using (is_admin());


-- 8. appointments — the one exception: members book (INSERT) their own
--    appointments directly with no login, so INSERT stays open. Confirming,
--    cancelling, and permanently deleting appointments is admin-only.
drop policy if exists "public read appointments" on appointments;
create policy "public read appointments"
  on appointments for select
  using (true);

drop policy if exists "public book appointments" on appointments;
create policy "public book appointments"
  on appointments for insert
  with check (true);

drop policy if exists "admin update appointments" on appointments;
create policy "admin update appointments"
  on appointments for update
  using (is_admin())
  with check (is_admin());

drop policy if exists "admin delete appointments" on appointments;
create policy "admin delete appointments"
  on appointments for delete
  using (is_admin());


-- ============================================================================
-- After running this: log into the portal's admin screen with the email +
-- password you created in Step 0. The old ARPX-ADMIN-2026 password no
-- longer works once the site code is deployed with the matching change.
--
-- NOT covered by this migration (deliberately, see chat for why):
--   - Member-side reads (benefits/history/appointments) are still open to
--     anyone holding the anon key, same as before this migration. Real
--     protection there needs actual customer accounts, which is a bigger,
--     separate change from this admin-auth fix.
-- ============================================================================
