-- Historique : rattachement auteur + suppression réservée Direction/Admin technique

CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id ON public.audit_log (actor_id);

-- Rattache les anciennes entrées uniquement lorsqu'un nom correspond sans ambiguïté
-- à un membre possédant un compte applicatif.
WITH unique_matches AS (
  SELECT
    a.id,
    (array_agg(m.auth_user_id))[1] AS auth_user_id
  FROM public.audit_log a
  JOIN public.members m
    ON m.auth_user_id IS NOT NULL
   AND a.actor_name IS NOT NULL
   AND lower(btrim(m.full_name)) = lower(btrim(a.actor_name))
  WHERE a.actor_id IS NULL
  GROUP BY a.id
  HAVING count(*) = 1
)
UPDATE public.audit_log a
SET actor_id = u.auth_user_id
FROM unique_matches u
WHERE a.id = u.id
  AND a.actor_id IS NULL;

GRANT DELETE ON public.audit_log TO authenticated;

DROP POLICY IF EXISTS "audit_log_delete_direction_admin" ON public.audit_log;
CREATE POLICY "audit_log_delete_direction_admin"
ON public.audit_log
FOR DELETE
TO authenticated
USING (
  public.is_admin((SELECT auth.uid()))
  OR public.is_current_tech_admin()
);
