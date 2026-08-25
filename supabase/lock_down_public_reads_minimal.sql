drop policy if exists "public read members" on members;
create policy "admin read members"
  on members for select
  using (is_admin());

drop policy if exists "public read benefits_used" on benefits_used;
create policy "admin read benefits_used"
  on benefits_used for select
  using (is_admin());

drop policy if exists "public read service_history" on service_history;
create policy "admin read service_history"
  on service_history for select
  using (is_admin());

drop policy if exists "public read appointments" on appointments;
create policy "admin read appointments"
  on appointments for select
  using (is_admin());
