-- Phase 3 foundation: branch-shared customers, phones and immutable
-- prescription revisions.

create table public.customers (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations(id),
  branch_id bigint not null,
  full_name text not null check (
    char_length(btrim(full_name)) between 2 and 160
  ),
  national_id text check (
    national_id is null
    or char_length(btrim(national_id)) between 3 and 40
  ),
  address text,
  birth_date date check (
    birth_date is null or birth_date <= created_at::date
  ),
  notes text,
  messaging_consent boolean not null default false,
  created_by uuid not null references public.profiles(user_id),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_branch_fkey
    foreign key (branch_id, organization_id)
    references public.branches(id, organization_id),
  constraint customers_id_organization_branch_key
    unique (id, organization_id, branch_id)
);

create table public.customer_phones (
  id bigint generated always as identity primary key,
  organization_id bigint not null,
  branch_id bigint not null,
  customer_id bigint not null,
  label text not null default 'principal' check (
    char_length(btrim(label)) between 1 and 40
  ),
  phone_number text not null check (
    char_length(btrim(phone_number)) between 5 and 40
  ),
  normalized_phone text generated always as (
    regexp_replace(phone_number, '[^0-9]', '', 'g')
  ) stored check (
    normalized_phone ~ '^[0-9]{5,20}$'
  ),
  is_primary boolean not null default false,
  whatsapp_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_phones_customer_fkey
    foreign key (customer_id, organization_id, branch_id)
    references public.customers(id, organization_id, branch_id)
);

create table public.prescriptions (
  id bigint generated always as identity primary key,
  organization_id bigint not null,
  branch_id bigint not null,
  customer_id bigint not null,
  created_by uuid not null references public.profiles(user_id),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prescriptions_customer_fkey
    foreign key (customer_id, organization_id, branch_id)
    references public.customers(id, organization_id, branch_id),
  constraint prescriptions_id_organization_branch_key
    unique (id, organization_id, branch_id)
);

create table public.prescription_revisions (
  id bigint generated always as identity primary key,
  organization_id bigint not null,
  branch_id bigint not null,
  prescription_id bigint not null,
  revision_number integer not null check (revision_number > 0),
  prescription_date date not null default current_date,
  prescriber_name text check (
    prescriber_name is null
    or char_length(btrim(prescriber_name)) between 2 and 160
  ),
  right_sphere numeric(5,2) check (right_sphere between -40 and 40),
  right_cylinder numeric(5,2) check (right_cylinder between -20 and 20),
  right_axis smallint check (right_axis between 0 and 180),
  right_addition numeric(4,2) check (right_addition between 0 and 8),
  right_prism numeric(4,2) check (right_prism between 0 and 20),
  right_prism_base text check (
    right_prism_base is null
    or right_prism_base in ('up', 'down', 'in', 'out')
  ),
  left_sphere numeric(5,2) check (left_sphere between -40 and 40),
  left_cylinder numeric(5,2) check (left_cylinder between -20 and 20),
  left_axis smallint check (left_axis between 0 and 180),
  left_addition numeric(4,2) check (left_addition between 0 and 8),
  left_prism numeric(4,2) check (left_prism between 0 and 20),
  left_prism_base text check (
    left_prism_base is null
    or left_prism_base in ('up', 'down', 'in', 'out')
  ),
  pupillary_distance_total numeric(5,2) check (
    pupillary_distance_total between 30 and 90
  ),
  right_pupillary_distance numeric(5,2) check (
    right_pupillary_distance between 15 and 50
  ),
  left_pupillary_distance numeric(5,2) check (
    left_pupillary_distance between 15 and 50
  ),
  right_height numeric(5,2) check (right_height between 0 and 60),
  left_height numeric(5,2) check (left_height between 0 and 60),
  notes text,
  change_reason text,
  created_by uuid not null references public.profiles(user_id),
  created_at timestamptz not null default now(),
  constraint prescription_revisions_prescription_fkey
    foreign key (prescription_id, organization_id, branch_id)
    references public.prescriptions(id, organization_id, branch_id),
  constraint prescription_revisions_number_key
    unique (prescription_id, revision_number),
  constraint prescription_revisions_identity_key
    unique (id, prescription_id, organization_id, branch_id)
);

create table public.prescription_files (
  id bigint generated always as identity primary key,
  organization_id bigint not null,
  branch_id bigint not null,
  prescription_id bigint not null,
  revision_id bigint not null,
  storage_path text not null unique check (
    storage_path = btrim(storage_path)
    and storage_path <> ''
  ),
  file_name text not null check (
    char_length(btrim(file_name)) between 1 and 255
  ),
  mime_type text not null check (
    mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
  ),
  byte_size bigint not null check (byte_size between 1 and 10485760),
  uploaded_by uuid not null references public.profiles(user_id),
  created_at timestamptz not null default now(),
  constraint prescription_files_prescription_fkey
    foreign key (prescription_id, organization_id, branch_id)
    references public.prescriptions(id, organization_id, branch_id),
  constraint prescription_files_revision_fkey
    foreign key (
      revision_id,
      prescription_id,
      organization_id,
      branch_id
    )
    references public.prescription_revisions(
      id,
      prescription_id,
      organization_id,
      branch_id
    )
);

create index customers_organization_branch_name_idx
  on public.customers (organization_id, branch_id, lower(full_name))
  where archived_at is null;
create index customers_organization_branch_birth_idx
  on public.customers (organization_id, branch_id, birth_date)
  where birth_date is not null and archived_at is null;
create index customers_organization_national_id_idx
  on public.customers (organization_id, lower(national_id))
  where national_id is not null and archived_at is null;
create index customer_phones_customer_idx
  on public.customer_phones (customer_id);
create index customer_phones_lookup_idx
  on public.customer_phones (organization_id, branch_id, normalized_phone);
create unique index customer_phones_one_primary_idx
  on public.customer_phones (customer_id)
  where is_primary;
create index prescriptions_customer_idx
  on public.prescriptions (customer_id, created_at desc)
  where archived_at is null;
create index prescription_revisions_prescription_created_idx
  on public.prescription_revisions (prescription_id, revision_number desc);
create index prescription_revisions_created_by_idx
  on public.prescription_revisions (created_by);
create index prescription_files_prescription_idx
  on public.prescription_files (prescription_id);
create index prescription_files_revision_idx
  on public.prescription_files (revision_id);

create trigger customers_set_updated_at
before update on public.customers
for each row execute function private.set_updated_at();

create trigger customer_phones_set_updated_at
before update on public.customer_phones
for each row execute function private.set_updated_at();

create trigger prescriptions_set_updated_at
before update on public.prescriptions
for each row execute function private.set_updated_at();

create or replace function private.can_read_branch_clinical_data(
  target_organization_id bigint,
  target_branch_id bigint
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_platform_admin()
    or private.has_organization_role(target_organization_id, array['owner'])
    or exists (
      select 1
      from public.organization_memberships membership
      join public.profiles profile
        on profile.user_id = membership.user_id
        and profile.is_active
      where membership.organization_id = target_organization_id
        and membership.branch_id = target_branch_id
        and membership.user_id = (select auth.uid())
        and membership.role = 'seller'
        and membership.status = 'active'
    );
$$;

create or replace function private.can_write_branch_clinical_data(
  target_organization_id bigint,
  target_branch_id bigint
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (
      private.is_platform_admin()
      or private.has_organization_role(target_organization_id, array['owner'])
      or exists (
        select 1
        from public.organization_memberships membership
        join public.profiles profile
          on profile.user_id = membership.user_id
          and profile.is_active
        where membership.organization_id = target_organization_id
          and membership.branch_id = target_branch_id
          and membership.user_id = (select auth.uid())
          and membership.role = 'seller'
          and membership.status = 'active'
      )
    )
    and private.can_operate_in_organization(
      target_organization_id,
      'optical_sales'
    );
$$;

revoke all on function private.can_read_branch_clinical_data(bigint, bigint)
from public, anon, authenticated;
revoke all on function private.can_write_branch_clinical_data(bigint, bigint)
from public, anon, authenticated;

alter table public.customers enable row level security;
alter table public.customer_phones enable row level security;
alter table public.prescriptions enable row level security;
alter table public.prescription_revisions enable row level security;
alter table public.prescription_files enable row level security;

create policy customers_select_branch_clinical
on public.customers for select to authenticated
using (
  (select private.can_read_branch_clinical_data(organization_id, branch_id))
);
create policy customers_insert_branch_clinical
on public.customers for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (select private.can_write_branch_clinical_data(organization_id, branch_id))
);
create policy customers_update_branch_clinical
on public.customers for update to authenticated
using (
  (select private.can_write_branch_clinical_data(organization_id, branch_id))
)
with check (
  (select private.can_write_branch_clinical_data(organization_id, branch_id))
);

create policy customer_phones_select_branch_clinical
on public.customer_phones for select to authenticated
using (
  (select private.can_read_branch_clinical_data(organization_id, branch_id))
);
create policy customer_phones_insert_branch_clinical
on public.customer_phones for insert to authenticated
with check (
  (select private.can_write_branch_clinical_data(organization_id, branch_id))
);
create policy customer_phones_update_branch_clinical
on public.customer_phones for update to authenticated
using (
  (select private.can_write_branch_clinical_data(organization_id, branch_id))
)
with check (
  (select private.can_write_branch_clinical_data(organization_id, branch_id))
);

create policy prescriptions_select_branch_clinical
on public.prescriptions for select to authenticated
using (
  (select private.can_read_branch_clinical_data(organization_id, branch_id))
);
create policy prescriptions_insert_branch_clinical
on public.prescriptions for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (select private.can_write_branch_clinical_data(organization_id, branch_id))
);
create policy prescriptions_update_branch_clinical
on public.prescriptions for update to authenticated
using (
  (select private.can_write_branch_clinical_data(organization_id, branch_id))
)
with check (
  (select private.can_write_branch_clinical_data(organization_id, branch_id))
);

create policy prescription_revisions_select_branch_clinical
on public.prescription_revisions for select to authenticated
using (
  (select private.can_read_branch_clinical_data(organization_id, branch_id))
);
create policy prescription_revisions_insert_branch_clinical
on public.prescription_revisions for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (select private.can_write_branch_clinical_data(organization_id, branch_id))
);

create policy prescription_files_select_branch_clinical
on public.prescription_files for select to authenticated
using (
  (select private.can_read_branch_clinical_data(organization_id, branch_id))
);
create policy prescription_files_insert_branch_clinical
on public.prescription_files for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and (select private.can_write_branch_clinical_data(organization_id, branch_id))
);

revoke all on public.customers from anon, authenticated;
revoke all on public.customer_phones from anon, authenticated;
revoke all on public.prescriptions from anon, authenticated;
revoke all on public.prescription_revisions from anon, authenticated;
revoke all on public.prescription_files from anon, authenticated;

grant select, insert on public.customers to authenticated;
grant update (
  full_name,
  national_id,
  address,
  birth_date,
  notes,
  messaging_consent,
  archived_at
) on public.customers to authenticated;
grant select, insert on public.customer_phones to authenticated;
grant update (
  label,
  phone_number,
  is_primary,
  whatsapp_enabled
) on public.customer_phones to authenticated;
grant select, insert on public.prescriptions to authenticated;
grant update (archived_at) on public.prescriptions to authenticated;
grant select, insert on public.prescription_revisions to authenticated;
grant select, insert on public.prescription_files to authenticated;

grant usage, select on sequence public.customers_id_seq to authenticated;
grant usage, select on sequence public.customer_phones_id_seq to authenticated;
grant usage, select on sequence public.prescriptions_id_seq to authenticated;
grant usage, select on sequence public.prescription_revisions_id_seq to authenticated;
grant usage, select on sequence public.prescription_files_id_seq to authenticated;
