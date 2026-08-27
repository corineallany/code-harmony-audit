ALTER TABLE public.members ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false;
ALTER TABLE public.poles ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false;
ALTER TABLE public.program_models ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_members_archived_deleted ON public.members (status, deleted);
CREATE INDEX IF NOT EXISTS idx_poles_archived_deleted ON public.poles (archived, deleted);
CREATE INDEX IF NOT EXISTS idx_program_models_archived_deleted ON public.program_models (archived, deleted);

CREATE OR REPLACE FUNCTION public.guard_archive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    IF TG_TABLE_NAME = 'members' THEN
      IF NEW.deleted IS DISTINCT FROM OLD.deleted
         OR NEW.status IS DISTINCT FROM OLD.status AND (NEW.status = 'archived' OR OLD.status = 'archived') THEN
        RAISE EXCEPTION 'Archive/corbeille réservée à la Direction et à l''Administrateur technique';
      END IF;
    ELSE
      IF NEW.deleted IS DISTINCT FROM OLD.deleted
         OR NEW.archived IS DISTINCT FROM OLD.archived THEN
        RAISE EXCEPTION 'Archive/corbeille réservée à la Direction et à l''Administrateur technique';
      END IF;
    END IF;
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
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Suppression définitive réservée à la Direction et à l''Administrateur technique';
  END IF;
  IF OLD.deleted IS NOT TRUE THEN
    RAISE EXCEPTION 'L''élément doit d''abord être placé dans la corbeille';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_archive_programs ON public.programs;
CREATE TRIGGER trg_guard_archive_programs BEFORE UPDATE ON public.programs FOR EACH ROW EXECUTE FUNCTION public.guard_archive_fields();
DROP TRIGGER IF EXISTS trg_guard_archive_solicitations ON public.solicitations;
CREATE TRIGGER trg_guard_archive_solicitations BEFORE UPDATE ON public.solicitations FOR EACH ROW EXECUTE FUNCTION public.guard_archive_fields();
DROP TRIGGER IF EXISTS trg_guard_archive_poles ON public.poles;
CREATE TRIGGER trg_guard_archive_poles BEFORE UPDATE ON public.poles FOR EACH ROW EXECUTE FUNCTION public.guard_archive_fields();
DROP TRIGGER IF EXISTS trg_guard_archive_models ON public.program_models;
CREATE TRIGGER trg_guard_archive_models BEFORE UPDATE ON public.program_models FOR EACH ROW EXECUTE FUNCTION public.guard_archive_fields();
DROP TRIGGER IF EXISTS trg_guard_archive_members ON public.members;
CREATE TRIGGER trg_guard_archive_members BEFORE UPDATE ON public.members FOR EACH ROW EXECUTE FUNCTION public.guard_archive_fields();

DROP TRIGGER IF EXISTS trg_guard_delete_programs ON public.programs;
CREATE TRIGGER trg_guard_delete_programs BEFORE DELETE ON public.programs FOR EACH ROW EXECUTE FUNCTION public.guard_permanent_delete();
DROP TRIGGER IF EXISTS trg_guard_delete_solicitations ON public.solicitations;
CREATE TRIGGER trg_guard_delete_solicitations BEFORE DELETE ON public.solicitations FOR EACH ROW EXECUTE FUNCTION public.guard_permanent_delete();
DROP TRIGGER IF EXISTS trg_guard_delete_poles ON public.poles;
CREATE TRIGGER trg_guard_delete_poles BEFORE DELETE ON public.poles FOR EACH ROW EXECUTE FUNCTION public.guard_permanent_delete();
DROP TRIGGER IF EXISTS trg_guard_delete_models ON public.program_models;
CREATE TRIGGER trg_guard_delete_models BEFORE DELETE ON public.program_models FOR EACH ROW EXECUTE FUNCTION public.guard_permanent_delete();
DROP TRIGGER IF EXISTS trg_guard_delete_members ON public.members;
CREATE TRIGGER trg_guard_delete_members BEFORE DELETE ON public.members FOR EACH ROW EXECUTE FUNCTION public.guard_permanent_delete();

DROP POLICY IF EXISTS "poles_delete_admin" ON public.poles;
CREATE POLICY "poles_delete_admin" ON public.poles FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));