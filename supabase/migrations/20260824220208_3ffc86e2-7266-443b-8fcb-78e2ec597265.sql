-- 1. Présences réelles
CREATE TABLE public.program_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id text NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  member_id text NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  presence text NOT NULL DEFAULT 'present',
  replaced_member_id text REFERENCES public.members(id),
  is_reinforcement boolean NOT NULL DEFAULT false,
  arrival_time text,
  departure_time text,
  note text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, member_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_attendance TO authenticated;
GRANT ALL ON public.program_attendance TO service_role;
ALTER TABLE public.program_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance_read" ON public.program_attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "attendance_write_staff" ON public.program_attendance FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_attendance_updated BEFORE UPDATE ON public.program_attendance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Post-service enrichi
ALTER TABLE public.program_debriefs
  ADD COLUMN IF NOT EXISTS actual_start text,
  ADD COLUMN IF NOT EXISTS actual_end text,
  ADD COLUMN IF NOT EXISTS completion text NOT NULL DEFAULT 'total',
  ADD COLUMN IF NOT EXISTS difficulties text,
  ADD COLUMN IF NOT EXISTS needs text,
  ADD COLUMN IF NOT EXISTS to_direction boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS incident_type text,
  ADD COLUMN IF NOT EXISTS incident_detail text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';

-- 3. Documents et liens de programme
CREATE TABLE public.program_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id text NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  title text NOT NULL,
  url text NOT NULL,
  kind text NOT NULL DEFAULT 'lien',
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_documents TO authenticated;
GRANT ALL ON public.program_documents TO service_role;
ALTER TABLE public.program_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "documents_read" ON public.program_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "documents_write_staff" ON public.program_documents FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_documents_updated BEFORE UPDATE ON public.program_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Notes internes
CREATE TABLE public.internal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity text NOT NULL,
  entity_id text NOT NULL,
  body text NOT NULL,
  visibility text NOT NULL DEFAULT 'equipe',
  author_id uuid,
  author_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.internal_notes TO authenticated;
GRANT ALL ON public.internal_notes TO service_role;
ALTER TABLE public.internal_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notes_read_scope" ON public.internal_notes FOR SELECT TO authenticated
  USING (
    visibility = 'equipe'
    OR (visibility = 'encadrement' AND public.is_staff(auth.uid()))
    OR (visibility = 'direction' AND public.is_admin(auth.uid()))
  );
CREATE POLICY "notes_write_staff" ON public.internal_notes FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_internal_notes_updated BEFORE UPDATE ON public.internal_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Préférences de notifications
CREATE TABLE public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  in_app boolean NOT NULL DEFAULT true,
  push boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prefs_own" ON public.notification_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_prefs_updated BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Raccourcis personnels
CREATE TABLE public.user_shortcuts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  label text NOT NULL,
  path text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, path)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_shortcuts TO authenticated;
GRANT ALL ON public.user_shortcuts TO service_role;
ALTER TABLE public.user_shortcuts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shortcuts_own" ON public.user_shortcuts FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 7. Masquage personnel dans « Mes services »
CREATE TABLE public.user_hidden_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entity text NOT NULL,
  entity_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entity, entity_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_hidden_items TO authenticated;
GRANT ALL ON public.user_hidden_items TO service_role;
ALTER TABLE public.user_hidden_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hidden_own" ON public.user_hidden_items FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());