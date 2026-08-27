create or replace function public.guard_validated_finance_row()
returns trigger language plpgsql set search_path=public as $$
begin
 if old.status in ('confirmed','approved') then
   raise exception 'Une écriture financière validée est immuable. Utilisez Corriger / annuler une écriture.';
 end if;
 return new;
end $$;

drop trigger if exists trg_finance_contribution_immutable on public.team_finance_contributions;
create trigger trg_finance_contribution_immutable before update on public.team_finance_contributions for each row execute function public.guard_validated_finance_row();
drop trigger if exists trg_finance_expense_immutable on public.team_finance_expenses;
create trigger trg_finance_expense_immutable before update on public.team_finance_expenses for each row execute function public.guard_validated_finance_row();
drop trigger if exists trg_finance_entry_immutable on public.team_finance_entries;
create trigger trg_finance_entry_immutable before update on public.team_finance_entries for each row execute function public.guard_validated_finance_row();

drop policy if exists team_finance_entries_write on public.team_finance_entries;
create policy team_finance_entries_write on public.team_finance_entries for insert to authenticated
 with check (
   (public.access_scope_for_user(auth.uid(),'finances_equipe','administrer') <> 'interdit' or public.access_scope_for_user(auth.uid(),'finances_equipe','confirmer_cotisations') <> 'interdit')
   and created_by=auth.uid()
   and (status<>'approved' or (approved_by=auth.uid() and approved_at is not null))
 );

drop policy if exists team_finance_corrections_write on public.team_finance_corrections;
create policy team_finance_corrections_write on public.team_finance_corrections for insert to authenticated
 with check (public.access_scope_for_user(auth.uid(),'finances_equipe','administrer') <> 'interdit' and created_by=auth.uid());
