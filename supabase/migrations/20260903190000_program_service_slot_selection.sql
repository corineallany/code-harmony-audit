alter table public.solicitations
  add column if not exists slot_selection_mode text not null default 'organizer',
  add column if not exists offered_slot_ids jsonb not null default '[]'::jsonb;

alter table public.solicitations
  drop constraint if exists solicitations_slot_selection_mode_check;

alter table public.solicitations
  add constraint solicitations_slot_selection_mode_check
  check (slot_selection_mode in ('organizer', 'member'));

alter table public.program_assignment_member_slots
  add column if not exists service_slot_id uuid
  references public.program_service_slots(id) on delete cascade;

create unique index if not exists program_assignment_member_service_slot_unique
  on public.program_assignment_member_slots (assignment_member_id, service_slot_id)
  where service_slot_id is not null;
