create or replace function public.technical_system_status()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public','storage'
as $function$
declare
  v_used bigint := 0;
  v_capacity bigint;
  v_files bigint := 0;
  v_members bigint := 0;
  v_programs bigint := 0;
  v_solicitations bigint := 0;
  v_remaining bigint;
  v_percent numeric;
begin
  if not public.is_current_tech_admin() then raise exception 'Accès refusé'; end if;
  begin
    select coalesce(sum(coalesce((metadata->>'size')::bigint,0)),0), count(*) into v_used, v_files from storage.objects;
  exception when others then
    v_used := 0; v_files := 0;
  end;
  select storage_capacity_bytes into v_capacity from public.app_settings where id='main';
  if v_capacity is not null and v_capacity > 0 then
    v_remaining := greatest(v_capacity-v_used,0);
    v_percent := round((v_used::numeric/v_capacity::numeric)*100,1);
  end if;
  select count(*) into v_members from public.members where coalesce(deleted,false)=false and status='active';
  select count(*) into v_programs from public.programs where coalesce(deleted,false)=false and coalesce(archived,false)=false;
  select count(*) into v_solicitations from public.solicitations where coalesce(deleted,false)=false and coalesce(archived,false)=false and coalesce(status,'pending') not in ('cancelled','closed','completed');
  return jsonb_build_object(
    'database','ok','auth','ok','storage','ok','checked_at',now(),
    'storage_used_bytes',v_used,'storage_capacity_bytes',v_capacity,'storage_remaining_bytes',v_remaining,'storage_percent',v_percent,
    'file_count',v_files,'member_count',v_members,'program_count',v_programs,'solicitation_count',v_solicitations
  );
end;
$function$;

create or replace function public.technical_diagnostics()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_orphan_member_poles bigint;
  v_orphan_documents bigint;
  v_orphan_solicitations bigint;
  v_legacy_program_types bigint;
  v_legacy_formats bigint;
  v_inactive_referents bigint;
begin
  if not public.is_current_tech_admin() then raise exception 'Accès refusé'; end if;
  select count(*) into v_orphan_member_poles from public.member_poles mp left join public.members m on m.id=mp.member_id left join public.poles p on p.id=mp.pole_id where m.id is null or p.id is null;
  select count(*) into v_orphan_documents from public.program_documents d left join public.programs p on p.id=d.program_id where p.id is null;
  select count(*) into v_orphan_solicitations from public.solicitations s left join public.programs p on p.id=s.program_id where s.program_id is not null and p.id is null;
  select count(*) into v_legacy_program_types from public.programs where lower(trim(coalesce(program_type,''))) in ('com','eglise');
  select count(*) into v_legacy_formats from public.programs where lower(trim(coalesce(format,''))) in ('presentiel','both','online','deplacement_connecte');
  select count(*) into v_inactive_referents from public.member_poles mp join public.members m on m.id=mp.member_id where mp.is_referent=true and m.status <> 'active';
  return jsonb_build_object('checked_at',now(),'checks',jsonb_build_array(
    jsonb_build_object('key','orphan_member_poles','label','Liens membre/pôle orphelins','count',v_orphan_member_poles),
    jsonb_build_object('key','orphan_documents','label','Documents liés à un programme inexistant','count',v_orphan_documents),
    jsonb_build_object('key','orphan_solicitations','label','Sollicitations liées à un programme inexistant','count',v_orphan_solicitations),
    jsonb_build_object('key','legacy_program_types','label','Anciennes valeurs de type de programme','count',v_legacy_program_types),
    jsonb_build_object('key','legacy_formats','label','Anciennes valeurs de format','count',v_legacy_formats),
    jsonb_build_object('key','inactive_referents','label','Référents actuellement inactifs','count',v_inactive_referents)
  ));
end;
$function$;
