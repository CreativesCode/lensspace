-- Every accepted commercial flow needs a stable CUP valuation basis.
alter table public.quotations alter column usd_to_cup_rate set not null;
alter table public.quotations alter column cup_equivalent set not null;
alter table public.orders alter column usd_to_cup_rate set not null;
alter table public.orders alter column cup_equivalent set not null;
