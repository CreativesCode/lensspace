-- Business USD→CUP rate refreshed on demand from elTOQUE (informal market rate).
-- One elTOQUE call per Havana day for the whole platform: the Edge Function
-- `refresh-exchange-rate` stores the day's rate in `market_exchange_rates`
-- (service role only), and each organization adopts it explicitly. The adopted
-- rate stays until someone presses the button again.

create table public.market_exchange_rates (
  rate_date date not null,
  source text not null check (source in ('eltoque')),
  usd_to_cup numeric(12, 2) not null check (usd_to_cup > 0),
  rates jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now(),
  primary key (rate_date, source)
);

alter table public.market_exchange_rates enable row level security;

create policy market_exchange_rates_select_authenticated
  on public.market_exchange_rates for select to authenticated using (true);

revoke all on public.market_exchange_rates from anon, authenticated;
grant select on public.market_exchange_rates to authenticated;

alter table public.organizations
  add column usd_to_cup_rate numeric(12, 2) check (usd_to_cup_rate > 0),
  add column usd_rate_source text check (usd_rate_source in ('eltoque')),
  add column usd_rate_date date,
  add column usd_rate_updated_at timestamptz,
  add column usd_rate_updated_by uuid references auth.users (id) on delete set null;

-- No rate parameter: the value always comes from the stored market row, so a
-- caller cannot set an arbitrary "elTOQUE" rate.
create or replace function public.adopt_market_usd_rate(target_organization_id bigint)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  market public.market_exchange_rates;
begin
  if not (
    private.has_organization_role(target_organization_id, array['owner', 'seller'])
    and private.can_operate_in_organization(target_organization_id, 'optical_sales')
  ) then
    raise exception 'No tienes permisos para actualizar la tasa de esta óptica.' using errcode = '42501';
  end if;

  select * into market
  from public.market_exchange_rates
  where source = 'eltoque'
  order by rate_date desc
  limit 1;

  if market.rate_date is null then
    raise exception 'Todavía no hay una tasa de elTOQUE disponible.' using errcode = 'P0002';
  end if;

  update public.organizations
  set usd_to_cup_rate = market.usd_to_cup,
      usd_rate_source = market.source,
      usd_rate_date = market.rate_date,
      usd_rate_updated_at = now(),
      usd_rate_updated_by = auth.uid()
  where id = target_organization_id;

  return jsonb_build_object(
    'rate', market.usd_to_cup,
    'rateDate', market.rate_date,
    'updatedAt', now()
  );
end;
$$;

revoke all on function public.adopt_market_usd_rate(bigint) from public, anon;
grant execute on function public.adopt_market_usd_rate(bigint) to authenticated;
