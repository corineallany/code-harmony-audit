create table if not exists public.program_days (
 id uuid primary key default gen_random_uuid(), program_id text not null references public.programs(id) on delete cascade,
 service_date date not null, start_time text, end_time text, note text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(program_id, service_date), check (end_time is null or start_time is null or end_time >= start_time)
);
create table if not exists public.program_assignment_member_slots (
 id uuid primary key default gen_random_uuid(), assignment_member_id uuid not null references public.program_assignment_members(id) on delete cascade,
 program_day_id uuid not null references public.program_days(id) on delete cascade, start_time text, end_time text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(assignment_member_id, program_day_id),
 check (end_time is null or start_time is null or end_time >= start_time)
);
create index if not exists program_days_program_date_idx on public.program_days(program_id, service_date);
create index if not exists program_member_slots_day_idx on public.program_assignment_member_slots(program_day_id);
create index if not exists program_member_slots_assignment_member_idx on public.program_assignment_member_slots(assignment_member_id);
alter table public.program_days enable row level security; alter table public.program_assignment_member_slots enable row level security;
drop policy if exists program_days_authenticated on public.program_days; drop policy if exists program_member_slots_authenticated on public.program_assignment_member_slots;
drop policy if exists program_days_select_authenticated on public.program_days; drop policy if exists program_days_insert_scoped on public.program_days; drop policy if exists program_days_update_scoped on public.program_days; drop policy if exists program_days_delete_scoped on public.program_days;
drop policy if exists program_member_slots_select_authenticated on public.program_assignment_member_slots; drop policy if exists program_member_slots_insert_scoped on public.program_assignment_member_slots; drop policy if exists program_member_slots_update_scoped on public.program_assignment_member_slots; drop policy if exists program_member_slots_delete_scoped on public.program_assignment_member_slots;
create policy program_days_select_authenticated on public.program_days for select to authenticated using (true);
create policy program_days_insert_scoped on public.program_days for insert to authenticated with check (scope_allows_program(auth.uid(),'programmes','modifier',program_id));
create policy program_days_update_scoped on public.program_days for update to authenticated using (scope_allows_program(auth.uid(),'programmes','modifier',program_id)) with check (scope_allows_program(auth.uid(),'programmes','modifier',program_id));
create policy program_days_delete_scoped on public.program_days for delete to authenticated using (scope_allows_program(auth.uid(),'programmes','modifier',program_id));
create policy program_member_slots_select_authenticated on public.program_assignment_member_slots for select to authenticated using (true);
create policy program_member_slots_insert_scoped on public.program_assignment_member_slots for insert to authenticated with check (exists(select 1 from public.program_assignment_members pam join public.program_assignments pa on pa.id=pam.assignment_id where pam.id=assignment_member_id and scope_allows_pole(auth.uid(),'programmes','affecter',pa.pole_id)));
create policy program_member_slots_update_scoped on public.program_assignment_member_slots for update to authenticated using (exists(select 1 from public.program_assignment_members pam join public.program_assignments pa on pa.id=pam.assignment_id where pam.id=assignment_member_id and scope_allows_pole(auth.uid(),'programmes','affecter',pa.pole_id))) with check (exists(select 1 from public.program_assignment_members pam join public.program_assignments pa on pa.id=pam.assignment_id where pam.id=assignment_member_id and scope_allows_pole(auth.uid(),'programmes','affecter',pa.pole_id)));
create policy program_member_slots_delete_scoped on public.program_assignment_member_slots for delete to authenticated using (exists(select 1 from public.program_assignment_members pam join public.program_assignments pa on pa.id=pam.assignment_id where pam.id=assignment_member_id and scope_allows_pole(auth.uid(),'programmes','affecter',pa.pole_id)));
insert into public.program_days(program_id,service_date,start_time,end_time)
select p.id,gs::date,case when gs::date=p.start_date then p.start_time else null end,case when gs::date=coalesce(p.end_date,p.start_date) then p.end_time else null end
from public.programs p cross join lateral generate_series(p.start_date,coalesce(p.end_date,p.start_date),'1 day'::interval) gs where p.start_date is not null on conflict(program_id,service_date) do nothing;
insert into public.program_assignment_member_slots(assignment_member_id,program_day_id,start_time,end_time)
select pam.id,pd.id,pd.start_time,pd.end_time from public.program_assignment_members pam join public.program_assignments pa on pa.id=pam.assignment_id join public.program_days pd on pd.program_id=pa.program_id on conflict(assignment_member_id,program_day_id) do nothing;
do $$ begin begin alter publication supabase_realtime add table public.program_days; exception when duplicate_object then null; end; begin alter publication supabase_realtime add table public.program_assignment_member_slots; exception when duplicate_object then null; end; end $$;