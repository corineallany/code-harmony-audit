do $$
declare r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid='public.member_training_steps'::regclass
      and contype='f'
      and pg_get_constraintdef(oid) ilike '%step_id%training_steps%'
  loop
    execute format('alter table public.member_training_steps drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.member_training_steps
  add constraint member_training_steps_step_id_fkey
  foreign key(step_id) references public.training_steps(id) on delete set null;
