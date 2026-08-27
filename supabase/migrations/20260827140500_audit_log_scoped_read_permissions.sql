create or replace function public.can_read_audit_entry(p_user uuid,p_actor uuid)
returns boolean language plpgsql stable security definer set search_path=public as $$
declare s text;
begin
 s:=public.access_scope_for_user(p_user,'historique','consulter');
 if s='tous' then return true; end if;
 if s='moi' then return p_actor=p_user; end if;
 if s='mon_pole' then return p_actor=p_user or exists(
   select 1
   from public.members actor
   join public.member_poles ap on ap.member_id=actor.id
   join public.member_poles mine on mine.pole_id=ap.pole_id
   join public.members me on me.id=mine.member_id
   where actor.auth_user_id=p_actor and me.auth_user_id=p_user
 ); end if;
 return false;
end $$;

drop policy if exists audit_log_select_staff on public.audit_log;
drop policy if exists audit_log_select_scoped on public.audit_log;
create policy audit_log_select_scoped on public.audit_log for select to authenticated
 using (public.can_read_audit_entry(auth.uid(),actor_id));
