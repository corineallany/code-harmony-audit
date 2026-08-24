CREATE TABLE public.evaluations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_member_id text NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  evaluator_member_id text REFERENCES public.members(id) ON DELETE SET NULL,
  evaluator_user_id uuid,
  kind text NOT NULL DEFAULT 'operational',
  period_label text,
  status text NOT NULL DEFAULT 'draft',
  scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  initial_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  comment text,
  strengths text,
  improvements text,
  revision_note text,
  anonymous boolean NOT NULL DEFAULT false,
  submitted_at timestamptz,
  validated_at timestamptz,
  validated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evaluations_kind_check CHECK (kind IN ('operational','referent','leadership')),
  CONSTRAINT evaluations_status_check CHECK (status IN ('draft','submitted','revision','validated'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.evaluations TO authenticated;
GRANT ALL ON public.evaluations TO service_role;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evaluations_select" ON public.evaluations FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR evaluator_user_id = auth.uid()
  OR (status = 'validated' AND subject_member_id IN (
    SELECT m.id FROM public.members m WHERE m.auth_user_id = auth.uid()
  ))
);

CREATE POLICY "evaluations_insert" ON public.evaluations FOR INSERT TO authenticated
WITH CHECK (
  evaluator_user_id = auth.uid()
  AND (public.is_staff(auth.uid()) OR kind = 'leadership')
);

CREATE POLICY "evaluations_update" ON public.evaluations FOR UPDATE TO authenticated
USING (
  public.is_admin(auth.uid())
  OR (evaluator_user_id = auth.uid() AND status IN ('draft','revision'))
)
WITH CHECK (
  public.is_admin(auth.uid())
  OR (evaluator_user_id = auth.uid() AND status IN ('draft','revision','submitted'))
);

CREATE POLICY "evaluations_delete" ON public.evaluations FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));

CREATE TRIGGER evaluations_set_updated_at BEFORE UPDATE ON public.evaluations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.program_debriefs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id text NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  author_member_id text REFERENCES public.members(id) ON DELETE SET NULL,
  created_by uuid,
  summary text,
  went_well text,
  to_improve text,
  attendance_note text,
  rating integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT program_debriefs_rating_check CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_debriefs TO authenticated;
GRANT ALL ON public.program_debriefs TO service_role;
ALTER TABLE public.program_debriefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "program_debriefs_select" ON public.program_debriefs FOR SELECT TO authenticated USING (true);
CREATE POLICY "program_debriefs_insert" ON public.program_debriefs FOR INSERT TO authenticated
WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "program_debriefs_update" ON public.program_debriefs FOR UPDATE TO authenticated
USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "program_debriefs_delete" ON public.program_debriefs FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));

CREATE TRIGGER program_debriefs_set_updated_at BEFORE UPDATE ON public.program_debriefs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.member_availability
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'validated',
  ADD COLUMN IF NOT EXISTS decided_by uuid,
  ADD COLUMN IF NOT EXISTS decided_at timestamptz;

ALTER TABLE public.member_availability
  ADD CONSTRAINT member_availability_status_check CHECK (status IN ('pending','validated','refused'));