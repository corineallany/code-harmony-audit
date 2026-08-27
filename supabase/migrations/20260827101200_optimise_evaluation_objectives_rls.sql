CREATE INDEX IF NOT EXISTS idx_evaluation_objectives_coach ON public.evaluation_objectives(coach_member_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_subject_validated ON public.evaluations(subject_member_id, validated_at DESC);
CREATE INDEX IF NOT EXISTS idx_evaluations_evaluator ON public.evaluations(evaluator_member_id);

DROP POLICY IF EXISTS "evaluation_objectives_select" ON public.evaluation_objectives;
CREATE POLICY "evaluation_objectives_select" ON public.evaluation_objectives FOR SELECT TO authenticated
USING (
  public.is_staff((select auth.uid()))
  OR EXISTS (
    SELECT 1 FROM public.members m
    JOIN public.evaluations e ON e.id = evaluation_id
    WHERE m.id = subject_member_id
      AND m.auth_user_id = (select auth.uid())
      AND e.status = 'validated'
  )
);

DROP POLICY IF EXISTS "evaluation_objectives_write" ON public.evaluation_objectives;
DROP POLICY IF EXISTS "evaluation_objectives_insert" ON public.evaluation_objectives;
DROP POLICY IF EXISTS "evaluation_objectives_update" ON public.evaluation_objectives;
DROP POLICY IF EXISTS "evaluation_objectives_delete" ON public.evaluation_objectives;

CREATE POLICY "evaluation_objectives_insert" ON public.evaluation_objectives FOR INSERT TO authenticated
WITH CHECK (public.is_staff((select auth.uid())));
CREATE POLICY "evaluation_objectives_update" ON public.evaluation_objectives FOR UPDATE TO authenticated
USING (public.is_staff((select auth.uid())))
WITH CHECK (public.is_staff((select auth.uid())));
CREATE POLICY "evaluation_objectives_delete" ON public.evaluation_objectives FOR DELETE TO authenticated
USING (public.is_staff((select auth.uid())));
