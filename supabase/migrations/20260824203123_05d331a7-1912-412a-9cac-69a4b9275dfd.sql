CREATE TABLE public.tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  detail text,
  program_id text REFERENCES public.programs(id) ON DELETE SET NULL,
  pole_id uuid REFERENCES public.poles(id) ON DELETE SET NULL,
  assignee_member_id text REFERENCES public.members(id) ON DELETE SET NULL,
  due_date date,
  priority text NOT NULL DEFAULT 'normale',
  status text NOT NULL DEFAULT 'todo',
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_select_authenticated" ON public.tasks
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "tasks_insert_staff" ON public.tasks
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "tasks_update_staff_or_assignee" ON public.tasks
  FOR UPDATE TO authenticated USING (
    public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = tasks.assignee_member_id AND m.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "tasks_delete_staff" ON public.tasks
  FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));

CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_tasks_status_due ON public.tasks (status, due_date);
