do $$
declare
  t text;
  tables text[] := array[
    'app_settings','access_role_permissions','access_user_exceptions','user_roles','user_shortcuts','user_hidden_items',
    'members','poles','member_poles','com_groups','com_group_leads','member_availability',
    'programs','program_assignments','program_assignment_members','program_member_responses','program_attendance','program_debriefs','program_debrief_contributions','program_documents','program_models',
    'solicitations','solicitation_targets','solicitation_recipients','solicitation_recipient_targets','solicitation_responses',
    'tasks','notifications','notification_preferences',
    'training_paths','training_steps','member_training_paths','member_training_steps','member_training_sessions',
    'evaluations','evaluation_contributors','evaluation_objectives',
    'team_life_events','team_life_participations','team_life_polls','team_life_poll_options','team_life_poll_votes',
    'material_items','material_item_poles','material_needs','material_need_links','material_requests','material_request_needs','material_incidents','material_loans','material_documents','material_managers',
    'team_finance_entries','team_finance_contributions','team_finance_expenses','team_finance_adjustments','team_finance_corrections','team_finance_managers',
    'icc_app_state'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || quote_ident(t)) is not null
       and not exists (
         select 1
         from pg_publication_tables
         where pubname='supabase_realtime'
           and schemaname='public'
           and tablename=t
       ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
