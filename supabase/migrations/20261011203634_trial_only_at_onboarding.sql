-- Trial only at onboarding (product owner, 2026-10-11): an organization is created
-- with or without a trial; afterwards it pays or leaves. A subscription never moves
-- into 'trial' later, and one that was ever paid cannot be a trial.
drop function public.start_subscription_trial(bigint, integer, text);

create or replace function private.guard_trial_subscription()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'trial' and tg_op = 'UPDATE' and (old.status <> 'trial' or old.last_renewed_on is not null) then
    raise exception using errcode = '55000', message = 'La prueba solo se da al crear la organización.';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_trial_subscription() from public, anon, authenticated;

create trigger subscriptions_guard_trial
before update on public.subscriptions
for each row execute function private.guard_trial_subscription();
