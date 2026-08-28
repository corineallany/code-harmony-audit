create or replace function public.can_edit_post_service_contribution(p_program_id text)
returns boolean language sql stable security definer set search_path=public as $$
select public.can_contribute_post_service(p_program_id)
  and not exists (
    select 1 from public.program_debriefs d
    where d.program_id=p_program_id and d.status='closed'
  );
$$;

drop policy if exists pdc_insert on public.program_debrief_contributions;
drop policy if exists pdc_update on public.program_debrief_contributions;
create policy pdc_insert on public.program_debrief_contributions for insert to authenticated with check (public.can_edit_post_service_contribution(program_id) and author_member_id=public.current_member_id() and created_by=auth.uid());
create policy pdc_update on public.program_debrief_contributions for update to authenticated using (author_member_id=public.current_member_id() and public.can_edit_post_service_contribution(program_id)) with check (author_member_id=public.current_member_id() and public.can_edit_post_service_contribution(program_id));
grant execute on function public.can_edit_post_service_contribution(text) to authenticated;
