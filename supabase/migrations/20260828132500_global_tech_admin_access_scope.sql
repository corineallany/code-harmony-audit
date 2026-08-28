-- Garantit le caractère transversal de l'Admin technique dans tous les modules
-- qui utilisent le moteur centralisé access_scope_for_user().
create or replace function public.access_scope_for_user(p_user uuid, p_module text, p_action text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_member text; v_role text; v_scope text; v_enabled boolean;
begin
  if exists (
    select 1 from public.user_roles
    where user_id = p_user and active = true and role::text = 'admin_technique'
  ) then
    return 'tous';
  end if;

  select id into v_member from public.members where auth_user_id=p_user limit 1;
  if v_member is not null then
    select scope,enabled into v_scope,v_enabled
    from public.access_user_exceptions
    where member_id=v_member and module_key=p_module and action_key=p_action limit 1;
    if found then
      return case when v_enabled=false then 'interdit' else coalesce(v_scope,'interdit') end;
    end if;
  end if;

  v_role:=public.access_role_key_for_user(p_user);
  select scope,enabled into v_scope,v_enabled
  from public.access_role_permissions
  where role_key=v_role and module_key=p_module and action_key=p_action limit 1;
  return case when coalesce(v_enabled,false)=false then 'interdit' else coalesce(v_scope,'interdit') end;
end
$function$;
