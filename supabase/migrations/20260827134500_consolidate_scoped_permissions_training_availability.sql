create or replace function public.can_access_member_scope(p_user uuid,p_module text,p_action text,p_member text)
returns boolean language plpgsql stable security definer set search_path=public as $$
declare s text;
begin
 s:=public.access_scope_for_user(p_user,p_module,p_action);
 if s='tous' then return true; end if;
 if s='moi' then return exists(select 1 from public.members m where m.id=p_member and m.auth_user_id=p_user); end if;
 if s='mon_pole' then return exists(
   select 1 from public.member_poles target
   join public.member_poles mine on mine.pole_id=target.pole_id
   join public.members me on me.id=mine.member_id
   where target.member_id=p_member and me.auth_user_id=p_user
 ); end if;
 return false;
end $$;

create or replace function public.can_access_training_path(p_user uuid,p_action text,p_path uuid)
returns boolean language plpgsql stable security definer set search_path=public as $$
declare s text; pp uuid;
begin
 s:=public.access_scope_for_user(p_user,'formation',p_action);
 select pole_id into pp from public.training_paths where id=p_path;
 if s='tous' then return true; end if;
 if s='mon_pole' then return pp is not null and public.user_in_pole(p_user,pp); end if;
 if s='moi' and p_action='consulter' then return exists(
   select 1 from public.member_training_paths mp join public.members m on m.id=mp.member_id
   where mp.path_id=p_path and m.auth_user_id=p_user
 ); end if;
 return false;
end $$;

create or replace function public.can_access_training_assignment(p_user uuid,p_action text,p_member text,p_path uuid)
returns boolean language plpgsql stable security definer set search_path=public as $$
declare s text; pp uuid;
begin
 s:=public.access_scope_for_user(p_user,'formation',p_action);
 select pole_id into pp from public.training_paths where id=p_path;
 if s='tous' then return true; end if;
 if s='moi' then return exists(select 1 from public.members m where m.id=p_member and m.auth_user_id=p_user); end if;
 if s='mon_pole' then return pp is not null and public.user_in_pole(p_user,pp)
   and exists(select 1 from public.member_poles mp where mp.member_id=p_member and mp.pole_id=pp); end if;
 return false;
end $$;

drop policy if exists ma_select_authenticated on public.member_availability;
drop policy if exists ma_write_admin on public.member_availability;
drop policy if exists ma_select_scoped on public.member_availability;
drop policy if exists ma_insert_scoped on public.member_availability;
drop policy if exists ma_update_scoped on public.member_availability;
drop policy if exists ma_delete_scoped on public.member_availability;
create policy ma_select_scoped on public.member_availability for select to authenticated using (public.can_access_member_scope(auth.uid(),'indisponibilites','consulter',member_id));
create policy ma_insert_scoped on public.member_availability for insert to authenticated with check (public.can_access_member_scope(auth.uid(),'indisponibilites','declarer',member_id));
create policy ma_update_scoped on public.member_availability for update to authenticated using (public.can_access_member_scope(auth.uid(),'indisponibilites','traiter',member_id)) with check (public.can_access_member_scope(auth.uid(),'indisponibilites','traiter',member_id));
create policy ma_delete_scoped on public.member_availability for delete to authenticated using (public.can_access_member_scope(auth.uid(),'indisponibilites','traiter',member_id) or public.can_access_member_scope(auth.uid(),'indisponibilites','declarer',member_id));

drop policy if exists training_paths_authenticated on public.training_paths;
drop policy if exists training_paths_write on public.training_paths;
drop policy if exists training_paths_select_scoped on public.training_paths;
drop policy if exists training_paths_insert_scoped on public.training_paths;
drop policy if exists training_paths_update_scoped on public.training_paths;
drop policy if exists training_paths_delete_scoped on public.training_paths;
create policy training_paths_select_scoped on public.training_paths for select to authenticated using (public.can_access_training_path(auth.uid(),'consulter',id));
create policy training_paths_insert_scoped on public.training_paths for insert to authenticated with check (case public.access_scope_for_user(auth.uid(),'formation','gerer') when 'tous' then true when 'mon_pole' then public.user_in_pole(auth.uid(),pole_id) else false end);
create policy training_paths_update_scoped on public.training_paths for update to authenticated using (public.can_access_training_path(auth.uid(),'gerer',id)) with check (public.can_access_training_path(auth.uid(),'gerer',id));
create policy training_paths_delete_scoped on public.training_paths for delete to authenticated using (public.can_access_training_path(auth.uid(),'gerer',id));

drop policy if exists training_steps_authenticated on public.training_steps;
drop policy if exists training_steps_write on public.training_steps;
drop policy if exists training_steps_select_scoped on public.training_steps;
drop policy if exists training_steps_insert_scoped on public.training_steps;
drop policy if exists training_steps_update_scoped on public.training_steps;
drop policy if exists training_steps_delete_scoped on public.training_steps;
create policy training_steps_select_scoped on public.training_steps for select to authenticated using (public.can_access_training_path(auth.uid(),'consulter',path_id));
create policy training_steps_insert_scoped on public.training_steps for insert to authenticated with check (public.can_access_training_path(auth.uid(),'gerer',path_id));
create policy training_steps_update_scoped on public.training_steps for update to authenticated using (public.can_access_training_path(auth.uid(),'gerer',path_id)) with check (public.can_access_training_path(auth.uid(),'gerer',path_id));
create policy training_steps_delete_scoped on public.training_steps for delete to authenticated using (public.can_access_training_path(auth.uid(),'gerer',path_id));

drop policy if exists member_training_paths_authenticated on public.member_training_paths;
drop policy if exists member_training_paths_write on public.member_training_paths;
drop policy if exists member_training_paths_select_scoped on public.member_training_paths;
drop policy if exists member_training_paths_insert_scoped on public.member_training_paths;
drop policy if exists member_training_paths_update_scoped on public.member_training_paths;
drop policy if exists member_training_paths_delete_scoped on public.member_training_paths;
create policy member_training_paths_select_scoped on public.member_training_paths for select to authenticated using (public.can_access_training_assignment(auth.uid(),'consulter',member_id,path_id));
create policy member_training_paths_insert_scoped on public.member_training_paths for insert to authenticated with check (public.can_access_training_assignment(auth.uid(),'gerer',member_id,path_id));
create policy member_training_paths_update_scoped on public.member_training_paths for update to authenticated using (public.can_access_training_assignment(auth.uid(),'gerer',member_id,path_id)) with check (public.can_access_training_assignment(auth.uid(),'gerer',member_id,path_id));
create policy member_training_paths_delete_scoped on public.member_training_paths for delete to authenticated using (public.can_access_training_assignment(auth.uid(),'gerer',member_id,path_id));

drop policy if exists member_training_steps_authenticated on public.member_training_steps;
drop policy if exists member_training_steps_write on public.member_training_steps;
drop policy if exists member_training_steps_select_scoped on public.member_training_steps;
drop policy if exists member_training_steps_insert_scoped on public.member_training_steps;
drop policy if exists member_training_steps_update_scoped on public.member_training_steps;
drop policy if exists member_training_steps_delete_scoped on public.member_training_steps;
create policy member_training_steps_select_scoped on public.member_training_steps for select to authenticated using (exists(select 1 from public.member_training_paths mp where mp.id=member_training_path_id and public.can_access_training_assignment(auth.uid(),'consulter',mp.member_id,mp.path_id)));
create policy member_training_steps_insert_scoped on public.member_training_steps for insert to authenticated with check (exists(select 1 from public.member_training_paths mp where mp.id=member_training_path_id and public.can_access_training_assignment(auth.uid(),'gerer',mp.member_id,mp.path_id)));
create policy member_training_steps_update_scoped on public.member_training_steps for update to authenticated using (exists(select 1 from public.member_training_paths mp where mp.id=member_training_path_id and public.can_access_training_assignment(auth.uid(),'gerer',mp.member_id,mp.path_id))) with check (exists(select 1 from public.member_training_paths mp where mp.id=member_training_path_id and public.can_access_training_assignment(auth.uid(),'gerer',mp.member_id,mp.path_id)));
create policy member_training_steps_delete_scoped on public.member_training_steps for delete to authenticated using (exists(select 1 from public.member_training_paths mp where mp.id=member_training_path_id and public.can_access_training_assignment(auth.uid(),'gerer',mp.member_id,mp.path_id)));
