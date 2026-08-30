create or replace function public.sync_direction_roles_from_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_supervisor uuid;
  old_adjoint uuid;
  new_supervisor uuid;
  new_adjoint uuid;
begin
  select auth_user_id into old_supervisor from members where id = old.supervisor_member_id;
  select auth_user_id into old_adjoint from members where id = old.adjoint_member_id;
  select auth_user_id into new_supervisor from members where id = new.supervisor_member_id;
  select auth_user_id into new_adjoint from members where id = new.adjoint_member_id;

  if old_supervisor is not null and old.supervisor_member_id is distinct from new.supervisor_member_id then
    update user_roles set active = false where user_id = old_supervisor and role = 'responsable';
  end if;
  if old_adjoint is not null and old.adjoint_member_id is distinct from new.adjoint_member_id then
    update user_roles set active = false where user_id = old_adjoint and role = 'adjoint';
  end if;

  if new_supervisor is not null then
    insert into user_roles(user_id, role, active)
    values(new_supervisor, 'responsable', true)
    on conflict(user_id, role) do update set active = true;
    update members set base_role = 'responsable' where id = new.supervisor_member_id;
  end if;

  if new_adjoint is not null then
    insert into user_roles(user_id, role, active)
    values(new_adjoint, 'adjoint', true)
    on conflict(user_id, role) do update set active = true;
    update members set base_role = 'adjoint'
      where id = new.adjoint_member_id and id is distinct from new.supervisor_member_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_sync_direction_roles_from_settings on public.app_settings;
create trigger trg_sync_direction_roles_from_settings
after update of supervisor_member_id, adjoint_member_id on public.app_settings
for each row execute function public.sync_direction_roles_from_settings();
