-- Lock anonymous writes out of the dashboard's tables.
--
-- Found on 2026-09-17 while building Autopilot. These tables carried Supabase's
-- starter "public access" policies — `using (true)` granted to PUBLIC, which
-- includes the `anon` role — together with anon table grants for INSERT,
-- UPDATE, DELETE and TRUNCATE.
--
-- The anon key is not a secret. It is published in the page source of
-- bettyscrispychicken.com, because the website and the in-store TV boards read
-- the menu with it. So anyone on the internet could:
--
--   * set their own profiles.role to 'admin'
--   * grant themselves any page in page_permissions
--   * rewrite or delete menu_items, including tv_number and position, which
--     decide what the four screens in the shop display
--   * alter payroll_records, payroll_payments and rate_changes
--   * delete shifts
--
-- Verified by sending PATCH and DELETE with the published anon key, filtered to
-- an id that matches nothing: the server answered 200 and 204, so the writes
-- were authorised. No rows were changed.
--
-- The fix retargets the write policies from PUBLIC to `authenticated` and
-- revokes the anon write grants. Every write in the dashboard happens on
-- /calendar, /menu, /payroll, /settings or the assistant panel — all behind a
-- login, so all running as `authenticated`. The public TV and QR pages only
-- read, and SELECT policies are deliberately left untouched so they keep
-- working without a session.
--
-- Rollback: 0001_lock_down_anon_writes.rollback.sql

begin;

drop policy if exists "Public insert access on menu_item_price_history" on public.menu_item_price_history;
drop policy if exists "Public update access on menu_item_price_history" on public.menu_item_price_history;
drop policy if exists "Public delete access on menu_items" on public.menu_items;
drop policy if exists "Public insert access on menu_items" on public.menu_items;
drop policy if exists "Public update access on menu_items" on public.menu_items;
drop policy if exists "page_permissions: admin can delete" on public.page_permissions;
drop policy if exists "page_permissions: admin can insert" on public.page_permissions;
drop policy if exists "panel_items: admin can delete" on public.panel_items;
drop policy if exists "panel_items: admin can insert" on public.panel_items;
drop policy if exists "panel_items: admin can update" on public.panel_items;
drop policy if exists "payroll_payments: admin can delete" on public.payroll_payments;
drop policy if exists "payroll_payments: admin can insert" on public.payroll_payments;
drop policy if exists "payroll_records: admin can delete" on public.payroll_records;
drop policy if exists "payroll_records: admin can insert" on public.payroll_records;
drop policy if exists "payroll_records: admin can update" on public.payroll_records;
drop policy if exists "profiles: admin can insert" on public.profiles;
drop policy if exists "profiles: admin can update" on public.profiles;
drop policy if exists "profiles: user can update own safe fields" on public.profiles;
drop policy if exists "rate_changes: admin can delete" on public.rate_changes;
drop policy if exists "rate_changes: admin can insert" on public.rate_changes;
drop policy if exists "rate_changes: admin can update" on public.rate_changes;
drop policy if exists "shifts: admin can delete any" on public.shifts;
drop policy if exists "shifts: admin can insert any" on public.shifts;
drop policy if exists "shifts: admin can update any" on public.shifts;
drop policy if exists "shifts: employee can delete own in unpaid months" on public.shifts;
drop policy if exists "shifts: employee can insert own in unpaid months" on public.shifts;
drop policy if exists "shifts: employee can update own in unpaid months" on public.shifts;

CREATE POLICY "Public insert access on menu_item_price_history" ON public.menu_item_price_history AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Public update access on menu_item_price_history" ON public.menu_item_price_history AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public delete access on menu_items" ON public.menu_items AS PERMISSIVE FOR DELETE TO authenticated USING (true);
CREATE POLICY "Public insert access on menu_items" ON public.menu_items AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Public update access on menu_items" ON public.menu_items AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "page_permissions: admin can delete" ON public.page_permissions AS PERMISSIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "page_permissions: admin can insert" ON public.page_permissions AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "panel_items: admin can delete" ON public.panel_items AS PERMISSIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "panel_items: admin can insert" ON public.panel_items AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "panel_items: admin can update" ON public.panel_items AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "payroll_payments: admin can delete" ON public.payroll_payments AS PERMISSIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "payroll_payments: admin can insert" ON public.payroll_payments AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "payroll_records: admin can delete" ON public.payroll_records AS PERMISSIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "payroll_records: admin can insert" ON public.payroll_records AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "payroll_records: admin can update" ON public.payroll_records AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "profiles: admin can insert" ON public.profiles AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "profiles: admin can update" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "profiles: user can update own safe fields" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = id)) WITH CHECK (((auth.uid() = id) AND (role = ( SELECT profiles_1.role
   FROM profiles profiles_1
  WHERE (profiles_1.id = auth.uid()))) AND (is_active = ( SELECT profiles_1.is_active
   FROM profiles profiles_1
  WHERE (profiles_1.id = auth.uid())))));
CREATE POLICY "rate_changes: admin can delete" ON public.rate_changes AS PERMISSIVE FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "rate_changes: admin can insert" ON public.rate_changes AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "rate_changes: admin can update" ON public.rate_changes AS PERMISSIVE FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "shifts: admin can delete any" ON public.shifts AS PERMISSIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "shifts: admin can insert any" ON public.shifts AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "shifts: admin can update any" ON public.shifts AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "shifts: employee can delete own in unpaid months" ON public.shifts AS PERMISSIVE FOR DELETE TO authenticated USING (((auth.uid() = employee_id) AND (NOT (EXISTS ( SELECT 1
   FROM payroll_records pr
  WHERE ((pr.employee_id = auth.uid()) AND (pr.year = (EXTRACT(year FROM shifts.shift_date))::integer) AND (pr.month = (EXTRACT(month FROM shifts.shift_date))::integer) AND (pr.status = 'paid'::text)))))));
CREATE POLICY "shifts: employee can insert own in unpaid months" ON public.shifts AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((auth.uid() = employee_id) AND (NOT (EXISTS ( SELECT 1
   FROM payroll_records pr
  WHERE ((pr.employee_id = auth.uid()) AND (pr.year = (EXTRACT(year FROM shifts.shift_date))::integer) AND (pr.month = (EXTRACT(month FROM shifts.shift_date))::integer) AND (pr.status = 'paid'::text)))))));
CREATE POLICY "shifts: employee can update own in unpaid months" ON public.shifts AS PERMISSIVE FOR UPDATE TO authenticated USING (((auth.uid() = employee_id) AND (NOT (EXISTS ( SELECT 1
   FROM payroll_records pr
  WHERE ((pr.employee_id = auth.uid()) AND (pr.year = (EXTRACT(year FROM shifts.shift_date))::integer) AND (pr.month = (EXTRACT(month FROM shifts.shift_date))::integer) AND (pr.status = 'paid'::text)))))));

-- Belt and braces: even with no policy granting it, a table grant is a standing
-- invitation. TRUNCATE in particular is not governed by RLS at all — a role
-- holding it can empty the table regardless of any policy.
revoke insert, update, delete, truncate on
  public.profiles, public.page_permissions, public.menu_items,
  public.menu_item_price_history, public.payroll_records, public.payroll_payments,
  public.rate_changes, public.shifts, public.panel_items
from anon;

commit;
