-- ============================================================
-- ICC LE MANS — Socle relationnel (Module 1)
-- Non destructif : création uniquement.
-- ============================================================

-- 0. Utilitaires -------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TYPE public.app_role AS ENUM ('responsable', 'adjoint', 'referent', 'equipier');
CREATE TYPE public.member_status AS ENUM ('active', 'inactive', 'archived');
CREATE TYPE public.response_status AS ENUM ('available', 'partial', 'unavailable', 'pending');

-- 1. profiles ----------------------------------------------------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  member_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. user_roles + has_role --------------------------------------
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role AND active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND active = true
      AND role IN ('responsable', 'adjoint')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND active = true
      AND role IN ('responsable', 'adjoint', 'referent')
  );
$$;

CREATE POLICY "profiles_select_authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE POLICY "user_roles_select_authenticated" ON public.user_roles
  FOR SELECT TO authenticated USING (true);

-- 3. role_permissions -------------------------------------------
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  permission TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (role, permission)
);
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "role_permissions_select_authenticated" ON public.role_permissions
  FOR SELECT TO authenticated USING (true);

-- 4. poles -------------------------------------------------------
CREATE TABLE public.poles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  pole_group TEXT,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.poles TO authenticated;
GRANT ALL ON public.poles TO service_role;
ALTER TABLE public.poles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "poles_select_authenticated" ON public.poles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "poles_write_admin" ON public.poles
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER trg_poles_updated BEFORE UPDATE ON public.poles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. members -----------------------------------------------------
CREATE TABLE public.members (
  id TEXT PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT NOT NULL,
  base_role public.app_role NOT NULL DEFAULT 'equipier',
  arrival_year INTEGER,
  arrival_month INTEGER,
  photo_url TEXT,
  status public.member_status NOT NULL DEFAULT 'active',
  is_ejp BOOLEAN NOT NULL DEFAULT false,
  is_icc BOOLEAN NOT NULL DEFAULT false,
  affiliations TEXT,
  inactive_note TEXT,
  training_done BOOLEAN NOT NULL DEFAULT false,
  training_start DATE,
  training_end_planned DATE,
  training_end_effective DATE,
  login_email TEXT,
  auth_user_id UUID,
  legacy_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_members_auth_user ON public.members (auth_user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.members TO authenticated;
GRANT ALL ON public.members TO service_role;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_select_authenticated" ON public.members
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "members_write_admin" ON public.members
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER trg_members_updated BEFORE UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. member_poles ------------------------------------------------
CREATE TABLE public.member_poles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id TEXT NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  pole_id UUID NOT NULL REFERENCES public.poles(id) ON DELETE CASCADE,
  is_referent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (member_id, pole_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_poles TO authenticated;
GRANT ALL ON public.member_poles TO service_role;
ALTER TABLE public.member_poles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "member_poles_select_authenticated" ON public.member_poles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "member_poles_write_admin" ON public.member_poles
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- 7. programs ----------------------------------------------------
CREATE TABLE public.programs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  program_type TEXT,
  format TEXT,
  audience TEXT,
  start_date DATE,
  start_time TEXT,
  end_date DATE,
  end_time TEXT,
  location TEXT,
  onsite TEXT,
  travel TEXT,
  importance TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  recurrence TEXT,
  recurrence_rule JSONB NOT NULL DEFAULT '{}'::jsonb,
  recurrence_until DATE,
  general_note TEXT,
  resource_link TEXT,
  invite_members TEXT,
  archived BOOLEAN NOT NULL DEFAULT false,
  deleted BOOLEAN NOT NULL DEFAULT false,
  legacy_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_programs_start_date ON public.programs (start_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.programs TO authenticated;
GRANT ALL ON public.programs TO service_role;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "programs_select_authenticated" ON public.programs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "programs_write_staff" ON public.programs
  FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_programs_updated BEFORE UPDATE ON public.programs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 8. program_assignments -----------------------------------------
CREATE TABLE public.program_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id TEXT NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  pole_id UUID NOT NULL REFERENCES public.poles(id) ON DELETE CASCADE,
  tasks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (program_id, pole_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_assignments TO authenticated;
GRANT ALL ON public.program_assignments TO service_role;
ALTER TABLE public.program_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "program_assignments_select_authenticated" ON public.program_assignments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "program_assignments_write_staff" ON public.program_assignments
  FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_program_assignments_updated BEFORE UPDATE ON public.program_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.program_assignment_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.program_assignments(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, member_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_assignment_members TO authenticated;
GRANT ALL ON public.program_assignment_members TO service_role;
ALTER TABLE public.program_assignment_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pam_select_authenticated" ON public.program_assignment_members
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "pam_write_staff" ON public.program_assignment_members
  FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- 9. réponses membres --------------------------------------------
CREATE TABLE public.program_member_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id TEXT NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  status public.response_status NOT NULL DEFAULT 'pending',
  reason TEXT,
  reserve TEXT,
  reversible_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (program_id, member_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_member_responses TO authenticated;
GRANT ALL ON public.program_member_responses TO service_role;
ALTER TABLE public.program_member_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pmr_select_authenticated" ON public.program_member_responses
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "pmr_write_staff" ON public.program_member_responses
  FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "pmr_write_own" ON public.program_member_responses
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.members m WHERE m.id = member_id AND m.auth_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.members m WHERE m.id = member_id AND m.auth_user_id = auth.uid()));
CREATE TRIGGER trg_pmr_updated BEFORE UPDATE ON public.program_member_responses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.program_response_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id TEXT NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  status public.response_status NOT NULL,
  reason TEXT,
  reserve TEXT,
  reversible_until TIMESTAMPTZ,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_prh_program ON public.program_response_history (program_id, member_id);
GRANT SELECT, INSERT ON public.program_response_history TO authenticated;
GRANT ALL ON public.program_response_history TO service_role;
ALTER TABLE public.program_response_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prh_select_authenticated" ON public.program_response_history
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "prh_insert_authenticated" ON public.program_response_history
  FOR INSERT TO authenticated WITH CHECK (true);

-- 10. checklist --------------------------------------------------
CREATE TABLE public.program_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id TEXT NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_checklist_items TO authenticated;
GRANT ALL ON public.program_checklist_items TO service_role;
ALTER TABLE public.program_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pci_select_authenticated" ON public.program_checklist_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "pci_write_staff" ON public.program_checklist_items
  FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_pci_updated BEFORE UPDATE ON public.program_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 11. solicitations ----------------------------------------------
CREATE TABLE public.solicitations (
  id TEXT PRIMARY KEY,
  requester TEXT,
  event_name TEXT,
  event_date DATE,
  message TEXT,
  mode TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  target_type TEXT,
  target_name TEXT,
  target_pole_id UUID REFERENCES public.poles(id) ON DELETE SET NULL,
  program_id TEXT REFERENCES public.programs(id) ON DELETE SET NULL,
  replacement_member_id TEXT REFERENCES public.members(id) ON DELETE SET NULL,
  link TEXT,
  attachment TEXT,
  seen BOOLEAN NOT NULL DEFAULT false,
  decision TEXT,
  decision_note TEXT,
  decision_at TIMESTAMPTZ,
  reversible_until TIMESTAMPTZ,
  archived BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ,
  deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.solicitations TO authenticated;
GRANT ALL ON public.solicitations TO service_role;
ALTER TABLE public.solicitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "solicitations_select_authenticated" ON public.solicitations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "solicitations_insert_authenticated" ON public.solicitations
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "solicitations_update_staff" ON public.solicitations
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "solicitations_delete_admin" ON public.solicitations
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
CREATE TRIGGER trg_solicitations_updated BEFORE UPDATE ON public.solicitations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.solicitation_decision_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitation_id TEXT NOT NULL REFERENCES public.solicitations(id) ON DELETE CASCADE,
  decision TEXT,
  note TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.solicitation_decision_history TO authenticated;
GRANT ALL ON public.solicitation_decision_history TO service_role;
ALTER TABLE public.solicitation_decision_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sdh_select_authenticated" ON public.solicitation_decision_history
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "sdh_insert_staff" ON public.solicitation_decision_history
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

-- 12. program_models ---------------------------------------------
CREATE TABLE public.program_models (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  program_type TEXT,
  format TEXT,
  audience TEXT,
  tasks TEXT,
  poles JSONB NOT NULL DEFAULT '[]'::jsonb,
  checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.program_models TO authenticated;
GRANT ALL ON public.program_models TO service_role;
ALTER TABLE public.program_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "program_models_select_authenticated" ON public.program_models
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "program_models_write_staff" ON public.program_models
  FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_program_models_updated BEFORE UPDATE ON public.program_models
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 13. member_availability ----------------------------------------
CREATE TABLE public.member_availability (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  note TEXT,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_availability TO authenticated;
GRANT ALL ON public.member_availability TO service_role;
ALTER TABLE public.member_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ma_select_authenticated" ON public.member_availability
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ma_write_admin" ON public.member_availability
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER trg_ma_updated BEFORE UPDATE ON public.member_availability
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 14. audit_log --------------------------------------------------
CREATE TABLE public.audit_log (
  id TEXT PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_name TEXT,
  actor_id UUID,
  action TEXT NOT NULL,
  detail TEXT,
  entity TEXT,
  entity_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_log_occurred ON public.audit_log (occurred_at DESC);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_log_select_staff" ON public.audit_log
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "audit_log_insert_authenticated" ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (true);

-- 15. app_settings -----------------------------------------------
CREATE TABLE public.app_settings (
  id TEXT PRIMARY KEY DEFAULT 'main',
  brand TEXT,
  subtitle TEXT,
  home_title TEXT,
  icon_url TEXT,
  cover_url TEXT,
  cover_enabled BOOLEAN NOT NULL DEFAULT false,
  menus JSONB NOT NULL DEFAULT '[]'::jsonb,
  verses JSONB NOT NULL DEFAULT '[]'::jsonb,
  export_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  supervisor_member_id TEXT,
  adjoint_member_id TEXT,
  group_leads JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_settings_select_authenticated" ON public.app_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "app_settings_write_admin" ON public.app_settings
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER trg_app_settings_updated BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 16. push_subscriptions -----------------------------------------
CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  member_id TEXT REFERENCES public.members(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  user_agent TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push_own" ON public.push_subscriptions
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_push_updated BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 17. archive legacy (lecture seule) -----------------------------
CREATE TABLE public.legacy_state_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  revision INTEGER,
  schema_version INTEGER,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.legacy_state_archive TO authenticated;
GRANT ALL ON public.legacy_state_archive TO service_role;
ALTER TABLE public.legacy_state_archive ENABLE ROW LEVEL SECURITY;
CREATE POLICY "legacy_select_admin" ON public.legacy_state_archive
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- 18. matrice de permissions (reprise de l'existant) -------------
INSERT INTO public.role_permissions (role, permission) VALUES
  ('equipier','planning.view'),('equipier','programmes.view'),('equipier','trombinoscope.view'),
  ('equipier','formations.view'),('equipier','poles.view'),('equipier','solicitations.create'),
  ('equipier','notifications.view'),('equipier','evaluations.view_own');
