-- ROLLBACK for 0001_lock_down_anon_writes.sql
--
-- Restores the PUBLIC policies and the anon grants exactly as they were on
-- 2026-09-17, before the lockdown. Run this only if the lockdown broke
-- something — it re-opens write access to anyone holding the anon key, which
-- is published in the page source of bettyscrispychicken.com.

CREATE POLICY "Public insert access on menu_item_price_history" ON public.menu_item_price_history AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (true);
CREATE POLICY "Public read access on menu_item_price_history" ON public.menu_item_price_history AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "Public update access on menu_item_price_history" ON public.menu_item_price_history AS PERMISSIVE FOR UPDATE TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "Public delete access on menu_items" ON public.menu_items AS PERMISSIVE FOR DELETE TO PUBLIC USING (true);
CREATE POLICY "Public insert access on menu_items" ON public.menu_items AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (true);
CREATE POLICY "Public read access on menu_items" ON public.menu_items AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "Public update access on menu_items" ON public.menu_items AS PERMISSIVE FOR UPDATE TO PUBLIC USING (true) WITH CHECK (true);
CREATE POLICY "page_permissions: admin can delete" ON public.page_permissions AS PERMISSIVE FOR DELETE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "page_permissions: admin can insert" ON public.page_permissions AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "page_permissions: admin can read all" ON public.page_permissions AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "page_permissions: user can read own" ON public.page_permissions AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = user_id));
CREATE POLICY "panel_items: admin can delete" ON public.panel_items AS PERMISSIVE FOR DELETE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "panel_items: admin can insert" ON public.panel_items AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "panel_items: admin can read all" ON public.panel_items AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "panel_items: admin can update" ON public.panel_items AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "payroll_payments: admin can delete" ON public.payroll_payments AS PERMISSIVE FOR DELETE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "payroll_payments: admin can insert" ON public.payroll_payments AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "payroll_payments: admin can read all" ON public.payroll_payments AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "payroll_payments: employee can read own" ON public.payroll_payments AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM payroll_records pr
  WHERE ((pr.id = payroll_payments.payroll_id) AND (pr.employee_id = auth.uid())))));
CREATE POLICY "payroll_records: admin can delete" ON public.payroll_records AS PERMISSIVE FOR DELETE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "payroll_records: admin can insert" ON public.payroll_records AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "payroll_records: admin can read all" ON public.payroll_records AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "payroll_records: admin can update" ON public.payroll_records AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "payroll_records: employee can read own" ON public.payroll_records AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = employee_id));
CREATE POLICY "profiles: admin can insert" ON public.profiles AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (is_admin());
CREATE POLICY "profiles: admin can read all" ON public.profiles AS PERMISSIVE FOR SELECT TO PUBLIC USING (is_admin());
CREATE POLICY "profiles: admin can update" ON public.profiles AS PERMISSIVE FOR UPDATE TO PUBLIC USING (is_admin());
CREATE POLICY "profiles: user can read own" ON public.profiles AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = id));
CREATE POLICY "profiles: user can update own safe fields" ON public.profiles AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((auth.uid() = id)) WITH CHECK (((auth.uid() = id) AND (role = ( SELECT profiles_1.role
   FROM profiles profiles_1
  WHERE (profiles_1.id = auth.uid()))) AND (is_active = ( SELECT profiles_1.is_active
   FROM profiles profiles_1
  WHERE (profiles_1.id = auth.uid())))));
CREATE POLICY "rate_changes: admin can delete" ON public.rate_changes AS PERMISSIVE FOR DELETE TO PUBLIC USING (is_admin());
CREATE POLICY "rate_changes: admin can insert" ON public.rate_changes AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (is_admin());
CREATE POLICY "rate_changes: admin can select" ON public.rate_changes AS PERMISSIVE FOR SELECT TO PUBLIC USING (is_admin());
CREATE POLICY "rate_changes: admin can update" ON public.rate_changes AS PERMISSIVE FOR UPDATE TO PUBLIC USING (is_admin());
CREATE POLICY "rate_changes: employee can read own" ON public.rate_changes AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() = employee_id));
CREATE POLICY "shifts: admin can delete any" ON public.shifts AS PERMISSIVE FOR DELETE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "shifts: admin can insert any" ON public.shifts AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "shifts: admin can update any" ON public.shifts AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "shifts: all authenticated can read" ON public.shifts AS PERMISSIVE FOR SELECT TO PUBLIC USING ((auth.uid() IS NOT NULL));
CREATE POLICY "shifts: employee can delete own in unpaid months" ON public.shifts AS PERMISSIVE FOR DELETE TO PUBLIC USING (((auth.uid() = employee_id) AND (NOT (EXISTS ( SELECT 1
   FROM payroll_records pr
  WHERE ((pr.employee_id = auth.uid()) AND (pr.year = (EXTRACT(year FROM shifts.shift_date))::integer) AND (pr.month = (EXTRACT(month FROM shifts.shift_date))::integer) AND (pr.status = 'paid'::text)))))));
CREATE POLICY "shifts: employee can insert own in unpaid months" ON public.shifts AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((auth.uid() = employee_id) AND (NOT (EXISTS ( SELECT 1
   FROM payroll_records pr
  WHERE ((pr.employee_id = auth.uid()) AND (pr.year = (EXTRACT(year FROM shifts.shift_date))::integer) AND (pr.month = (EXTRACT(month FROM shifts.shift_date))::integer) AND (pr.status = 'paid'::text)))))));
CREATE POLICY "shifts: employee can update own in unpaid months" ON public.shifts AS PERMISSIVE FOR UPDATE TO PUBLIC USING (((auth.uid() = employee_id) AND (NOT (EXISTS ( SELECT 1
   FROM payroll_records pr
  WHERE ((pr.employee_id = auth.uid()) AND (pr.year = (EXTRACT(year FROM shifts.shift_date))::integer) AND (pr.month = (EXTRACT(month FROM shifts.shift_date))::integer) AND (pr.status = 'paid'::text)))))));

grant insert, update, delete, truncate on
  public.profiles, public.page_permissions, public.menu_items,
  public.menu_item_price_history, public.payroll_records, public.payroll_payments,
  public.rate_changes, public.shifts, public.panel_items
to anon;
