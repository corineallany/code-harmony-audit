create extension if not exists pg_net with schema extensions;

alter table public.notifications
  add column if not exists push_sent_at timestamptz;

create or replace function public.dispatch_notification_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://fticxzuzjgeypvqrfrwk.supabase.co/functions/v1/notification-push',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object('notification_id', new.id)
  );
  return new;
end;
$$;

drop trigger if exists trg_dispatch_notification_push on public.notifications;
create trigger trg_dispatch_notification_push
after insert on public.notifications
for each row execute function public.dispatch_notification_push();
