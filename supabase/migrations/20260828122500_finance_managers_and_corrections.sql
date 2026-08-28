create table if not exists public.team_finance_managers (
  member_id text primary key references public.members(id) on delete cascade,
  active boolean not null default true,
  granted_by uuid,
  granted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.team_finance_managers enable row level security;

drop policy if exists team_finance_managers_read on public.team_finance_managers;
create policy team_finance_managers_read on public.team_finance_managers
for select using (
  public.is_current_tech_admin()
  or public.can_manage_access_matrix()
  or member_id = (select id from public.members where auth_user_id=auth.uid() limit 1)
);

drop policy if exists team_finance_managers_manage on public.team_finance_managers;
create policy team_finance_managers_manage on public.team_finance_managers
for all using (public.is_current_tech_admin() or public.can_manage_access_matrix())
with check (public.is_current_tech_admin() or public.can_manage_access_matrix());

create or replace function public.is_team_finance_manager(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.team_finance_managers fm
    join public.members m on m.id=fm.member_id
    where m.auth_user_id=p_user and fm.active=true
  )
$$;

create or replace function public.has_team_finance_permission(p_action text)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select (select auth.uid()) is not null and (
    public.is_current_tech_admin()
    or public.is_team_finance_manager((select auth.uid()))
    or public.access_scope_for_user((select auth.uid()), 'finances_equipe', p_action) <> 'interdit'
  )
$$;

drop policy if exists team_finance_corrections_read on public.team_finance_corrections;
create policy team_finance_corrections_read on public.team_finance_corrections
for select using (public.has_team_finance_permission('administrer'));

drop policy if exists team_finance_corrections_write on public.team_finance_corrections;
create policy team_finance_corrections_write on public.team_finance_corrections
for insert with check (public.has_team_finance_permission('administrer') and created_by=auth.uid());

drop policy if exists team_finance_entries_read on public.team_finance_entries;
create policy team_finance_entries_read on public.team_finance_entries
for select using (
  public.has_team_finance_permission('voir_detail_cotisations')
  or public.has_team_finance_permission('administrer')
  or public.has_team_finance_permission('confirmer_cotisations')
);

drop policy if exists team_finance_entries_write on public.team_finance_entries;
create policy team_finance_entries_write on public.team_finance_entries
for insert with check (
  (public.has_team_finance_permission('administrer') or public.has_team_finance_permission('confirmer_cotisations'))
  and created_by=auth.uid()
  and (status <> 'approved' or (approved_by=auth.uid() and approved_at is not null))
);

drop policy if exists team_finance_entries_update on public.team_finance_entries;
create policy team_finance_entries_update on public.team_finance_entries
for update using (
  public.has_team_finance_permission('administrer') or public.has_team_finance_permission('confirmer_cotisations')
)
with check (
  public.has_team_finance_permission('administrer') or public.has_team_finance_permission('confirmer_cotisations')
);

create or replace function public.validate_team_finance_correction()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.target_kind not in ('contribution','entry','expense') then
    raise exception 'Type d’écriture financière invalide';
  end if;
  if new.amount_delta = 0 then
    raise exception 'Une correction doit modifier le solde';
  end if;
  if new.target_kind='contribution' and not exists(select 1 from public.team_finance_contributions where id=new.target_id and status='confirmed') then
    raise exception 'La cotisation d’origine doit exister et être confirmée';
  end if;
  if new.target_kind='entry' and not exists(select 1 from public.team_finance_entries where id=new.target_id and status='approved') then
    raise exception 'L’entrée d’origine doit exister et être validée';
  end if;
  if new.target_kind='expense' and not exists(select 1 from public.team_finance_expenses where id=new.target_id and status='approved') then
    raise exception 'La dépense d’origine doit exister et être validée';
  end if;
  return new;
end
$$;

drop trigger if exists trg_validate_team_finance_correction on public.team_finance_corrections;
create trigger trg_validate_team_finance_correction
before insert on public.team_finance_corrections
for each row execute function public.validate_team_finance_correction();
