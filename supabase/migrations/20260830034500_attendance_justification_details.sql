alter table public.program_attendance
  add column if not exists justified boolean,
  add column if not exists justification_reason text;

comment on column public.program_attendance.justified is 'Indique si un retard, une absence ou une présence partielle est justifié(e).';
comment on column public.program_attendance.justification_reason is 'Motif ou explication de la justification de présence.';
