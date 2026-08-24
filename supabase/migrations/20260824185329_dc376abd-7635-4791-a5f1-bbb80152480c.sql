-- Nouveau rôle distinct : administrateur technique (indépendant d'adjoint)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin_technique';

-- is_admin / is_staff prennent en compte le rôle technique (comparaison textuelle)
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND active = true
      AND role::text IN ('responsable', 'adjoint', 'admin_technique')
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND active = true
      AND role::text IN ('responsable', 'adjoint', 'referent', 'admin_technique')
  );
$function$;