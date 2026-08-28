-- Admin technique remains transversal; do not remap it to Direction.
-- Allow its explicit full access when managing member/pole assignments.

DROP POLICY IF EXISTS member_poles_insert_access ON public.member_poles;
CREATE POLICY member_poles_insert_access ON public.member_poles
FOR INSERT TO authenticated
WITH CHECK (
  public.is_current_tech_admin()
  OR public.access_scope_for_user(auth.uid(),'poles','gerer_membres')='tous'
  OR (
    public.access_scope_for_user(auth.uid(),'poles','gerer_membres')='mon_pole'
    AND public.user_in_pole(auth.uid(),pole_id)
  )
);

DROP POLICY IF EXISTS member_poles_update_access ON public.member_poles;
CREATE POLICY member_poles_update_access ON public.member_poles
FOR UPDATE TO authenticated
USING (
  public.is_current_tech_admin()
  OR public.access_scope_for_user(auth.uid(),'poles','gerer_membres')='tous'
  OR (
    public.access_scope_for_user(auth.uid(),'poles','gerer_membres')='mon_pole'
    AND public.user_in_pole(auth.uid(),pole_id)
  )
)
WITH CHECK (
  public.is_current_tech_admin()
  OR public.access_scope_for_user(auth.uid(),'poles','gerer_membres')='tous'
  OR (
    public.access_scope_for_user(auth.uid(),'poles','gerer_membres')='mon_pole'
    AND public.user_in_pole(auth.uid(),pole_id)
  )
);

DROP POLICY IF EXISTS member_poles_delete_access ON public.member_poles;
CREATE POLICY member_poles_delete_access ON public.member_poles
FOR DELETE TO authenticated
USING (
  public.is_current_tech_admin()
  OR public.access_scope_for_user(auth.uid(),'poles','gerer_membres')='tous'
  OR (
    public.access_scope_for_user(auth.uid(),'poles','gerer_membres')='mon_pole'
    AND public.user_in_pole(auth.uid(),pole_id)
  )
);
