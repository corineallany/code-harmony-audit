alter table public.training_paths
  add column if not exists objectives text,
  add column if not exists version integer not null default 1;

alter table public.training_steps
  add column if not exists parent_step_id uuid references public.training_steps(id) on delete cascade,
  add column if not exists phase text not null default 'theorie',
  add column if not exists session_count integer not null default 1,
  add column if not exists estimated_minutes_per_session integer not null default 60,
  add column if not exists objectives text,
  add column if not exists success_criteria text;

alter table public.member_training_paths
  add column if not exists planned_start_date date,
  add column if not exists planned_end_date date,
  add column if not exists initial_level text,
  add column if not exists initial_assessment text,
  add column if not exists overall_rating numeric(3,1),
  add column if not exists overall_assessment text,
  add column if not exists global_objectives text;

alter table public.member_training_steps alter column step_id drop not null;
alter table public.member_training_steps
  add column if not exists title_snapshot text,
  add column if not exists description_snapshot text,
  add column if not exists phase_snapshot text,
  add column if not exists step_type_snapshot text,
  add column if not exists required_snapshot boolean not null default true,
  add column if not exists session_count_target integer not null default 1,
  add column if not exists estimated_minutes_per_session integer not null default 60,
  add column if not exists objectives text,
  add column if not exists success_criteria text,
  add column if not exists planned_start_date date,
  add column if not exists planned_end_date date,
  add column if not exists evolution_level text,
  add column if not exists performance_rating numeric(3,1),
  add column if not exists trainer_note text,
  add column if not exists excluded boolean not null default false,
  add column if not exists custom_step boolean not null default false,
  add column if not exists position integer not null default 0;

update public.member_training_steps ms set
  title_snapshot=coalesce(ms.title_snapshot,ts.title),
  description_snapshot=coalesce(ms.description_snapshot,ts.description),
  phase_snapshot=coalesce(ms.phase_snapshot,ts.phase,'theorie'),
  step_type_snapshot=coalesce(ms.step_type_snapshot,ts.step_type),
  required_snapshot=coalesce(ts.required,true),
  session_count_target=coalesce(ts.session_count,1),
  estimated_minutes_per_session=coalesce(ts.estimated_minutes_per_session,60),
  objectives=coalesce(ms.objectives,ts.objectives),
  success_criteria=coalesce(ms.success_criteria,ts.success_criteria),
  position=coalesce(ts.position,0)
from public.training_steps ts where ms.step_id=ts.id;

create table if not exists public.member_training_sessions(
  id uuid primary key default gen_random_uuid(),
  member_training_step_id uuid not null references public.member_training_steps(id) on delete cascade,
  session_no integer not null default 1,
  planned_date date,
  completed_at timestamptz,
  duration_minutes integer,
  status text not null default 'planned',
  performance_rating numeric(3,1),
  evolution_level text,
  note text,
  trainer_member_id text references public.members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.member_training_sessions enable row level security;
drop policy if exists member_training_sessions_select_scoped on public.member_training_sessions;
create policy member_training_sessions_select_scoped on public.member_training_sessions for select to authenticated using(exists(select 1 from public.member_training_steps ms join public.member_training_paths mp on mp.id=ms.member_training_path_id where ms.id=member_training_sessions.member_training_step_id and (mp.member_id=public.user_member_id(auth.uid()) or public.can_access_training_assignment(auth.uid(),'gerer',mp.member_id,mp.path_id))));
drop policy if exists member_training_sessions_insert_scoped on public.member_training_sessions;
create policy member_training_sessions_insert_scoped on public.member_training_sessions for insert to authenticated with check(exists(select 1 from public.member_training_steps ms join public.member_training_paths mp on mp.id=ms.member_training_path_id where ms.id=member_training_sessions.member_training_step_id and public.can_access_training_assignment(auth.uid(),'gerer',mp.member_id,mp.path_id)));
drop policy if exists member_training_sessions_update_scoped on public.member_training_sessions;
create policy member_training_sessions_update_scoped on public.member_training_sessions for update to authenticated using(exists(select 1 from public.member_training_steps ms join public.member_training_paths mp on mp.id=ms.member_training_path_id where ms.id=member_training_sessions.member_training_step_id and public.can_access_training_assignment(auth.uid(),'gerer',mp.member_id,mp.path_id))) with check(exists(select 1 from public.member_training_steps ms join public.member_training_paths mp on mp.id=ms.member_training_path_id where ms.id=member_training_sessions.member_training_step_id and public.can_access_training_assignment(auth.uid(),'gerer',mp.member_id,mp.path_id)));
drop policy if exists member_training_sessions_delete_scoped on public.member_training_sessions;
create policy member_training_sessions_delete_scoped on public.member_training_sessions for delete to authenticated using(exists(select 1 from public.member_training_steps ms join public.member_training_paths mp on mp.id=ms.member_training_path_id where ms.id=member_training_sessions.member_training_step_id and public.can_access_training_assignment(auth.uid(),'gerer',mp.member_id,mp.path_id)));
create index if not exists idx_training_steps_parent on public.training_steps(parent_step_id);
create index if not exists idx_member_training_sessions_step on public.member_training_sessions(member_training_step_id);
