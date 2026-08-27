-- Évaluations : période structurée, repères factuels figés et objectifs de progression
ALTER TABLE public.evaluations
  ADD COLUMN IF NOT EXISTS period_start date,
  ADD COLUMN IF NOT EXISTS period_end date,
  ADD COLUMN IF NOT EXISTS fact_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS training_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.evaluation_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_member_id text NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  evaluation_id uuid NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  label text NOT NULL,
  due_date date,
  coach_member_id text REFERENCES public.members(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'todo',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evaluation_objectives_status_check CHECK (status IN ('todo','in_progress','done','cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_evaluation_objectives_subject
  ON public.evaluation_objectives(subject_member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evaluation_objectives_evaluation
  ON public.evaluation_objectives(evaluation_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.evaluation_objectives TO authenticated;
GRANT ALL ON public.evaluation_objectives TO service_role;
ALTER TABLE public.evaluation_objectives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "evaluation_objectives_select" ON public.evaluation_objectives;
CREATE POLICY "evaluation_objectives_select" ON public.evaluation_objectives FOR SELECT TO authenticated
USING (
  public.is_staff(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.members m
    JOIN public.evaluations e ON e.id = evaluation_id
    WHERE m.id = subject_member_id
      AND m.auth_user_id = auth.uid()
      AND e.status = 'validated'
  )
);

DROP POLICY IF EXISTS "evaluation_objectives_write" ON public.evaluation_objectives;
CREATE POLICY "evaluation_objectives_write" ON public.evaluation_objectives FOR ALL TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

DROP TRIGGER IF EXISTS evaluation_objectives_set_updated_at ON public.evaluation_objectives;
CREATE TRIGGER evaluation_objectives_set_updated_at
BEFORE UPDATE ON public.evaluation_objectives
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
