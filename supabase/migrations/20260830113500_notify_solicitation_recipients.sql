create unique index if not exists notifications_idempotency_key_unique on public.notifications(idempotency_key) where idempotency_key is not null;
create or replace function public.notify_solicitation_recipient()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_user uuid; v_event text; v_deadline date; v_pref boolean;
begin
 select m.auth_user_id into v_user from public.members m where m.id=new.member_id and m.deleted=false;
 if v_user is null then return new; end if;
 if TG_OP='INSERT' then
  select s.event_name,s.response_deadline into v_event,v_deadline from public.solicitations s where s.id=new.solicitation_id;
  select coalesce((select np.in_app from public.notification_preferences np where np.user_id=v_user and np.event_type='sollicitation'),true) into v_pref;
  if v_pref and not exists(select 1 from public.notifications n where n.idempotency_key='sol:new:'||new.solicitation_id||':'||new.member_id) then
   insert into public.notifications(user_id,member_id,type,title,body,link,read,entity_type,entity_id,idempotency_key) values(v_user,new.member_id,'sollicitation','Nouvelle sollicitation ponctuelle',coalesce(v_event,'Sollicitation')||case when v_deadline is not null then ' · réponse avant le '||to_char(v_deadline,'DD/MM/YYYY') else '' end,'/sollicitations',false,'solicitation',new.solicitation_id,'sol:new:'||new.solicitation_id||':'||new.member_id);
  end if;
 elsif TG_OP='UPDATE' and new.selected is true and coalesce(old.selected,false) is false then
  select s.event_name into v_event from public.solicitations s where s.id=new.solicitation_id;
  if not exists(select 1 from public.notifications n where n.idempotency_key='sol:selected:'||new.solicitation_id||':'||new.member_id) then insert into public.notifications(user_id,member_id,type,title,body,link,read,entity_type,entity_id,idempotency_key) values(v_user,new.member_id,'sollicitation_retenue','Vous êtes retenu(e)',coalesce(v_event,'Sollicitation'),'/sollicitations',false,'solicitation',new.solicitation_id,'sol:selected:'||new.solicitation_id||':'||new.member_id); end if;
 end if; return new;
end $$;
drop trigger if exists trg_notify_solicitation_recipient on public.solicitation_recipients;
create trigger trg_notify_solicitation_recipient after insert or update of selected on public.solicitation_recipients for each row execute function public.notify_solicitation_recipient();