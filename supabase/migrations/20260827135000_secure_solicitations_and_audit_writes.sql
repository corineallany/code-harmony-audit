create or replace function public.can_modify_solicitation(p_user uuid,p_solicitation text)
returns boolean language plpgsql stable security definer set search_path=public as $$
declare s text; r public.solicitations%rowtype; my_member text;
begin
 select * into r from public.solicitations where id=p_solicitation;
 if not found then return false; end if;
 select id into my_member from public.members where auth_user_id=p_user limit 1;
 s:=public.access_scope_for_user(p_user,'sollicitations','modifier');
 if s='tous' then return true; end if;
 if s='moi' then return r.created_by=p_user or (my_member is not null and r.requester_member_id=my_member); end if;
 if s='mon_pole' then return (r.target_pole_id is not null and public.user_in_pole(p_user,r.target_pole_id)) or (r.requested_pole_id is not null and public.user_in_pole(p_user,r.requested_pole_id)) or r.created_by=p_user; end if;
 return false;
end $$;

create or replace function public.can_create_solicitation_row(p_user uuid,p_created_by uuid,p_requester_member text,p_target_pole uuid,p_requested_pole uuid)
returns boolean language plpgsql stable security definer set search_path=public as $$
declare s text; my_member text;
begin
 s:=public.access_scope_for_user(p_user,'sollicitations','creer');
 select id into my_member from public.members where auth_user_id=p_user limit 1;
 if p_created_by is distinct from p_user then return false; end if;
 if s='tous' then return true; end if;
 if s='moi' then return my_member is not null and (p_requester_member is null or p_requester_member=my_member); end if;
 if s='mon_pole' then return (p_target_pole is not null and public.user_in_pole(p_user,p_target_pole)) or (p_requested_pole is not null and public.user_in_pole(p_user,p_requested_pole)) or (my_member is not null and p_requester_member=my_member); end if;
 return false;
end $$;

drop policy if exists solicitations_insert_authenticated on public.solicitations;
drop policy if exists solicitations_update_staff on public.solicitations;
drop policy if exists solicitations_insert_scoped on public.solicitations;
drop policy if exists solicitations_update_scoped on public.solicitations;
create policy solicitations_insert_scoped on public.solicitations for insert to authenticated with check (public.can_create_solicitation_row(auth.uid(),created_by,requester_member_id,target_pole_id,requested_pole_id));
create policy solicitations_update_scoped on public.solicitations for update to authenticated using (public.can_modify_solicitation(auth.uid(),id)) with check (public.can_modify_solicitation(auth.uid(),id));

drop policy if exists solicitation_recipients_insert_authenticated on public.solicitation_recipients;
drop policy if exists solicitation_recipients_update_authenticated on public.solicitation_recipients;
drop policy if exists solicitation_recipients_delete_authenticated on public.solicitation_recipients;
drop policy if exists solicitation_recipients_select_scoped on public.solicitation_recipients;
create policy solicitation_recipients_select_scoped on public.solicitation_recipients for select to authenticated using (public.can_view_solicitation(solicitation_id));
create policy solicitation_recipients_insert_scoped on public.solicitation_recipients for insert to authenticated with check (public.can_modify_solicitation(auth.uid(),solicitation_id));
create policy solicitation_recipients_update_scoped on public.solicitation_recipients for update to authenticated using (public.can_modify_solicitation(auth.uid(),solicitation_id) or exists(select 1 from public.members m where m.id=member_id and m.auth_user_id=auth.uid())) with check (public.can_modify_solicitation(auth.uid(),solicitation_id) or exists(select 1 from public.members m where m.id=member_id and m.auth_user_id=auth.uid()));
create policy solicitation_recipients_delete_scoped on public.solicitation_recipients for delete to authenticated using (public.can_modify_solicitation(auth.uid(),solicitation_id));

create or replace function public.guard_solicitation_recipient_update()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or public.can_modify_solicitation(auth.uid(),old.solicitation_id) then return new; end if;
 if not exists(select 1 from public.members m where m.id=old.member_id and m.auth_user_id=auth.uid()) then raise exception 'Accès refusé'; end if;
 if new.solicitation_id is distinct from old.solicitation_id or new.recipient_type is distinct from old.recipient_type or new.member_id is distinct from old.member_id or new.pole_id is distinct from old.pole_id or new.target_id is distinct from old.target_id or new.selected is distinct from old.selected or new.selected_at is distinct from old.selected_at or new.selected_by is distinct from old.selected_by then raise exception 'Seule votre réponse peut être modifiée'; end if;
 return new;
end $$;
drop trigger if exists trg_guard_solicitation_recipient_update on public.solicitation_recipients;
create trigger trg_guard_solicitation_recipient_update before update on public.solicitation_recipients for each row execute function public.guard_solicitation_recipient_update();

drop policy if exists solicitation_response_history_authenticated_insert on public.solicitation_response_history;
drop policy if exists solicitation_response_history_insert_scoped on public.solicitation_response_history;
create policy solicitation_response_history_insert_scoped on public.solicitation_response_history for insert to authenticated with check (changed_by=auth.uid() and (public.can_modify_solicitation(auth.uid(),solicitation_id) or exists(select 1 from public.members m where m.id=member_id and m.auth_user_id=auth.uid())));

drop policy if exists audit_log_insert_authenticated on public.audit_log;
drop policy if exists audit_log_insert_authenticated_actor on public.audit_log;
create policy audit_log_insert_authenticated_actor on public.audit_log for insert to authenticated with check (actor_id=auth.uid());
