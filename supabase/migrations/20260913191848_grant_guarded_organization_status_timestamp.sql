-- updated_at is overwritten by the existing set_updated_at trigger.
grant update (updated_at) on public.organizations to authenticated;
