ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS birthday_hide_allowed boolean NOT NULL DEFAULT false;

ALTER TABLE public.members
ADD COLUMN IF NOT EXISTS birthday_hidden boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.set_my_birthday_hidden(p_hidden boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_allowed boolean;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  SELECT COALESCE(birthday_hide_allowed, false)
    INTO v_allowed
  FROM public.app_settings
  WHERE id = 'main';

  IF NOT COALESCE(v_allowed, false) THEN
    RAISE EXCEPTION 'Le masquage des anniversaires n''est pas autorisé par la Direction';
  END IF;

  UPDATE public.members
     SET birthday_hidden = p_hidden,
         updated_at = now()
   WHERE auth_user_id = v_user;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aucun membre lié au compte connecté';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_birthday_hidden(boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_my_birthday_hidden(boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_my_birthday_hidden(boolean) TO authenticated;
