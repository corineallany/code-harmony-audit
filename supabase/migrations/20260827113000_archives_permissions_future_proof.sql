-- Archives/Corbeille pilotés par la matrice de droits plutôt que par les noms de rôles.

INSERT INTO public.access_role_permissions (role_key,module_key,action_key,scope,enabled)
VALUES
 ('direction','archives','corbeille','tous',true),
 ('referent','archives','corbeille','interdit',false),
 ('equipier','archives','corbeille','interdit',false)
ON CONFLICT (role_key,module_key,action_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.has_archive_permission(p_action text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_current_tech_admin()
      OR public.access_scope_for_user(
           auth.uid(),
           'archives',
           CASE WHEN p_action='corbeille' THEN 'restaurer' ELSE p_action END
         ) = 'tous';
$$;

CREATE OR REPLACE FUNCTION public.guard_archive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_action text;
BEGIN
  IF TG_TABLE_NAME = 'members' THEN
    IF NEW.deleted IS DISTINCT FROM OLD.deleted THEN
      v_action := CASE WHEN NEW.deleted THEN 'corbeille' ELSE 'restaurer' END;
    ELSIF NEW.status IS DISTINCT FROM OLD.status AND (NEW.status='archived' OR OLD.status='archived') THEN
      v_action := 'restaurer';
    END IF;
  ELSE
    IF NEW.deleted IS DISTINCT FROM OLD.deleted THEN
      v_action := CASE WHEN NEW.deleted THEN 'corbeille' ELSE 'restaurer' END;
    ELSIF NEW.archived IS DISTINCT FROM OLD.archived THEN
      v_action := 'restaurer';
    END IF;
  END IF;
  IF v_action IS NOT NULL AND NOT public.has_archive_permission(v_action) THEN
    RAISE EXCEPTION 'Permission Archives/Corbeille insuffisante pour %', v_action;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_permanent_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_archive_permission('supprimer_definitivement') THEN
    RAISE EXCEPTION 'Permission Archives/Corbeille insuffisante pour la suppression définitive';
  END IF;
  IF OLD.deleted IS NOT TRUE THEN
    RAISE EXCEPTION 'L''élément doit d''abord être placé dans la corbeille';
  END IF;
  RETURN OLD;
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_archive_permission(text) TO authenticated;

DROP POLICY IF EXISTS "archives_update_permission_programs" ON public.programs;
CREATE POLICY "archives_update_permission_programs" ON public.programs FOR UPDATE TO authenticated USING (public.has_archive_permission('restaurer')) WITH CHECK (public.has_archive_permission('restaurer'));
DROP POLICY IF EXISTS "archives_update_permission_solicitations" ON public.solicitations;
CREATE POLICY "archives_update_permission_solicitations" ON public.solicitations FOR UPDATE TO authenticated USING (public.has_archive_permission('restaurer')) WITH CHECK (public.has_archive_permission('restaurer'));
DROP POLICY IF EXISTS "archives_update_permission_members" ON public.members;
CREATE POLICY "archives_update_permission_members" ON public.members FOR UPDATE TO authenticated USING (public.has_archive_permission('restaurer')) WITH CHECK (public.has_archive_permission('restaurer'));
DROP POLICY IF EXISTS "archives_update_permission_poles" ON public.poles;
CREATE POLICY "archives_update_permission_poles" ON public.poles FOR UPDATE TO authenticated USING (public.has_archive_permission('restaurer')) WITH CHECK (public.has_archive_permission('restaurer'));
DROP POLICY IF EXISTS "archives_update_permission_models" ON public.program_models;
CREATE POLICY "archives_update_permission_models" ON public.program_models FOR UPDATE TO authenticated USING (public.has_archive_permission('restaurer')) WITH CHECK (public.has_archive_permission('restaurer'));

DROP POLICY IF EXISTS "archives_delete_permission_programs" ON public.programs;
CREATE POLICY "archives_delete_permission_programs" ON public.programs FOR DELETE TO authenticated USING (public.has_archive_permission('supprimer_definitivement'));
DROP POLICY IF EXISTS "archives_delete_permission_solicitations" ON public.solicitations;
CREATE POLICY "archives_delete_permission_solicitations" ON public.solicitations FOR DELETE TO authenticated USING (public.has_archive_permission('supprimer_definitivement'));
DROP POLICY IF EXISTS "archives_delete_permission_members" ON public.members;
CREATE POLICY "archives_delete_permission_members" ON public.members FOR DELETE TO authenticated USING (public.has_archive_permission('supprimer_definitivement'));
DROP POLICY IF EXISTS "archives_delete_permission_poles" ON public.poles;
CREATE POLICY "archives_delete_permission_poles" ON public.poles FOR DELETE TO authenticated USING (public.has_archive_permission('supprimer_definitivement'));
DROP POLICY IF EXISTS "archives_delete_permission_models" ON public.program_models;
CREATE POLICY "archives_delete_permission_models" ON public.program_models FOR DELETE TO authenticated USING (public.has_archive_permission('supprimer_definitivement'));
