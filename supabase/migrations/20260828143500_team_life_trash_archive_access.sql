-- Allow the Archives/Trash module to display, restore and permanently delete
-- Team Life events according to the existing Archives permissions.

CREATE POLICY team_life_events_archives_select
ON public.team_life_events
FOR SELECT
TO authenticated
USING (
  deleted_at IS NOT NULL
  AND (
    public.has_archive_permission('restaurer')
    OR public.has_archive_permission('supprimer_definitivement')
  )
);

CREATE POLICY team_life_events_archives_update
ON public.team_life_events
FOR UPDATE
TO authenticated
USING (
  deleted_at IS NOT NULL
  AND public.has_archive_permission('restaurer')
)
WITH CHECK (
  public.has_archive_permission('restaurer')
);

CREATE POLICY team_life_events_archives_delete
ON public.team_life_events
FOR DELETE
TO authenticated
USING (
  deleted_at IS NOT NULL
  AND public.has_archive_permission('supprimer_definitivement')
);
