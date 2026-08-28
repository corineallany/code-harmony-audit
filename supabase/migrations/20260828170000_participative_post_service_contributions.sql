create table if not exists public.program_debrief_contributions (
  id uuid primary key default gen_random_uuid(),
  program_id text not null references public.programs(id) on delete cascade,
  author_member_id text not null references public.members(id) on delete cascade,
  pole_id uuid null references public.poles(id) on delete set null,
  rating integer null check (rating between 1 and 5),
  went_well text null,
  difficulties text null,
  to_improve text null,
  needs text null,
  incident_note text null,
  proposed_action text null,
  to_direction boolean not null default false,
  created_by uuid null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(program_id, author_member_id)
);

create index if not exists program_debrief_contributions_program_idx on public.program_debrief_contributions(program_id);
create index if not exists program_debrief_contributions_author_idx on public.program_debrief_contributions(author_member_id);

create or replace function public.can_contribute_post_service(p_program_id text)
returns boolean language sql stable security definer set search_path=public as $$
select public.is_admin(auth.uid())
  or exists (
    select 1 from public.program_assignments pa
    join public.program_assignment_members pam on pam.assignment_id=pa.id
    where pa.program_id=p_program_id and pam.member_id=public.current_member_id()
  )
  or exists (
    select 1 from public.program_assignments pa
    join public.member_poles mp on mp.pole_id=pa.pole_id and mp.is_referent=true
    where pa.program_id=p_program_id and mp.member_id=public.current_member_id()
  );
$$;

create or replace function public.can_finalize_post_service(p_program_id text)
returns boolean language sql stable security definer set search_path=public as $$
select public.is_admin(auth.uid())
  or exists (
    select 1 from public.program_assignments pa
    join public.member_poles mp on mp.pole_id=pa.pole_id and mp.is_referent=true
    where pa.program_id=p_program_id and mp.member_id=public.current_member_id()
  );
$$;

alter table public.program_debrief_contributions enable row level security;
drop policy if exists pdc_select on public.program_debrief_contributions;
drop policy if exists pdc_insert on public.program_debrief_contributions;
drop policy if exists pdc_update on public.program_debrief_contributions;
drop policy if exists pdc_delete on public.program_debrief_contributions;
create policy pdc_select on public.program_debrief_contributions for select to authenticated using (public.can_contribute_post_service(program_id));
create policy pdc_insert on public.program_debrief_contributions for insert to authenticated with check (public.can_contribute_post_service(program_id) and author_member_id=public.current_member_id() and created_by=auth.uid());
create policy pdc_update on public.program_debrief_contributions for update to authenticated using (author_member_id=public.current_member_id() and public.can_contribute_post_service(program_id)) with check (author_member_id=public.current_member_id() and public.can_contribute_post_service(program_id));
create policy pdc_delete on public.program_debrief_contributions for delete to authenticated using (author_member_id=public.current_member_id() or public.is_admin(auth.uid()));
grant select,insert,update,delete on public.program_debrief_contributions to authenticated;
grant execute on function public.can_contribute_post_service(text) to authenticated;
grant execute on function public.can_finalize_post_service(text) to authenticated;
