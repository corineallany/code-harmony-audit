drop policy if exists program_debriefs_insert_scoped on public.program_debriefs;
drop policy if exists program_debriefs_update_scoped on public.program_debriefs;
drop policy if exists attendance_write_scoped on public.program_attendance;

create policy program_debriefs_insert_scoped on public.program_debriefs
for insert to authenticated
with check (created_by=auth.uid() and public.can_finalize_post_service(program_id));

create policy program_debriefs_update_scoped on public.program_debriefs
for update to authenticated
using (public.can_finalize_post_service(program_id))
with check (public.can_finalize_post_service(program_id));

create policy attendance_write_scoped on public.program_attendance
for all to authenticated
using (public.can_finalize_post_service(program_id))
with check (public.can_finalize_post_service(program_id));
