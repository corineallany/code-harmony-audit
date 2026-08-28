alter table public.member_training_paths
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by text,
  add column if not exists deletion_reason text;

create index if not exists member_training_paths_deleted_at_idx
  on public.member_training_paths(deleted_at);
