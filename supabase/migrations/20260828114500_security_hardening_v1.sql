-- V1 hardening applied to production 2026-08-28.
-- Internal trigger routines are not directly executable from the API.
REVOKE EXECUTE ON FUNCTION public.dispatch_notification_push() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_evaluation_pole_membership() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_evaluation_scope() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.guard_archive_fields() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.guard_permanent_delete() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.guard_solicitation_recipient_update() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.material_log_item_history() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.material_log_need_history() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_program_response_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.track_solicitation_response_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_team_finance_correction() FROM PUBLIC;

REVOKE ALL ON TABLE public.icc_migration_backup_20260825 FROM anon, authenticated;
REVOKE ALL ON TABLE public.icc_user_access_backup_20260825 FROM anon, authenticated;
REVOKE ALL ON TABLE public.membres FROM anon, authenticated;
REVOKE ALL ON TABLE public.planning FROM anon, authenticated;
REVOKE ALL ON TABLE public.icc_push_reminders FROM anon, authenticated;

create index if not exists idx_member_availability_member_id on public.member_availability(member_id);
create index if not exists idx_member_poles_pole_id on public.member_poles(pole_id);
create index if not exists idx_program_assignment_members_member_id on public.program_assignment_members(member_id);
create index if not exists idx_program_assignments_pole_id on public.program_assignments(pole_id);
create index if not exists idx_program_member_responses_member_id on public.program_member_responses(member_id);
create index if not exists idx_program_debriefs_program_id on public.program_debriefs(program_id);
create index if not exists idx_program_documents_program_id on public.program_documents(program_id);
create index if not exists idx_tasks_program_id on public.tasks(program_id);
create index if not exists idx_tasks_pole_id on public.tasks(pole_id);
create index if not exists idx_tasks_assignee_member_id on public.tasks(assignee_member_id);
create index if not exists idx_evaluations_pole_id on public.evaluations(pole_id);
create index if not exists idx_solicitations_program_id on public.solicitations(program_id);
create index if not exists idx_solicitations_requested_pole_id on public.solicitations(requested_pole_id);
create index if not exists idx_solicitations_requester_member_id on public.solicitations(requester_member_id);
create index if not exists idx_material_items_primary_pole_id on public.material_items(primary_pole_id);
create index if not exists idx_material_items_responsible_member_id on public.material_items(responsible_member_id);
create index if not exists idx_material_incidents_item_id on public.material_incidents(item_id);
create index if not exists idx_material_loans_item_id on public.material_loans(item_id);
create index if not exists idx_material_needs_program_id on public.material_needs(program_id);
create index if not exists idx_material_need_links_need_id on public.material_need_links(need_id);
create index if not exists idx_material_request_needs_need_id on public.material_request_needs(need_id);
create index if not exists idx_team_finance_entries_member_id on public.team_finance_entries(member_id);
