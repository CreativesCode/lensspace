-- Immutable prescription revision workflow and private original files.

create or replace function public.create_prescription_revision(
  target_organization_id bigint,
  target_branch_id bigint,
  target_customer_id bigint,
  target_prescription_id bigint,
  revision_prescription_date date,
  revision_prescriber_name text,
  revision_right_sphere numeric,
  revision_right_cylinder numeric,
  revision_right_axis smallint,
  revision_right_addition numeric,
  revision_right_prism numeric,
  revision_right_prism_base text,
  revision_left_sphere numeric,
  revision_left_cylinder numeric,
  revision_left_axis smallint,
  revision_left_addition numeric,
  revision_left_prism numeric,
  revision_left_prism_base text,
  revision_pupillary_distance_total numeric,
  revision_right_pupillary_distance numeric,
  revision_left_pupillary_distance numeric,
  revision_right_height numeric,
  revision_left_height numeric,
  revision_notes text,
  revision_change_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  prescription_row public.prescriptions%rowtype;
  new_revision_id bigint;
  next_revision_number integer;
begin
  if actor_user_id is null then
    raise exception using errcode = '42501', message = 'Debes iniciar sesión.';
  end if;

  if target_prescription_id is null then
    insert into public.prescriptions (
      organization_id,
      branch_id,
      customer_id,
      created_by
    )
    values (
      target_organization_id,
      target_branch_id,
      target_customer_id,
      actor_user_id
    )
    returning * into prescription_row;
  else
    select * into prescription_row
    from public.prescriptions
    where id = target_prescription_id
      and organization_id = target_organization_id
      and branch_id = target_branch_id
      and customer_id = target_customer_id
      and archived_at is null
    for update;

    if not found then
      raise exception using
        errcode = 'P0002',
        message = 'La receta no existe o no pertenece al cliente y sucursal indicados.';
    end if;
  end if;

  -- Serializes revision numbering for this prescription.
  perform 1
  from public.prescriptions
  where id = prescription_row.id
  for update;

  select coalesce(max(revision_number), 0) + 1
    into next_revision_number
  from public.prescription_revisions
  where prescription_id = prescription_row.id;

  if next_revision_number > 1
    and nullif(btrim(revision_change_reason), '') is null
  then
    raise exception using
      errcode = '22023',
      message = 'Indica el motivo de la corrección.';
  end if;

  insert into public.prescription_revisions (
    organization_id,
    branch_id,
    prescription_id,
    revision_number,
    prescription_date,
    prescriber_name,
    right_sphere,
    right_cylinder,
    right_axis,
    right_addition,
    right_prism,
    right_prism_base,
    left_sphere,
    left_cylinder,
    left_axis,
    left_addition,
    left_prism,
    left_prism_base,
    pupillary_distance_total,
    right_pupillary_distance,
    left_pupillary_distance,
    right_height,
    left_height,
    notes,
    change_reason,
    created_by
  )
  values (
    target_organization_id,
    target_branch_id,
    prescription_row.id,
    next_revision_number,
    revision_prescription_date,
    nullif(btrim(revision_prescriber_name), ''),
    revision_right_sphere,
    revision_right_cylinder,
    revision_right_axis,
    revision_right_addition,
    revision_right_prism,
    nullif(btrim(revision_right_prism_base), ''),
    revision_left_sphere,
    revision_left_cylinder,
    revision_left_axis,
    revision_left_addition,
    revision_left_prism,
    nullif(btrim(revision_left_prism_base), ''),
    revision_pupillary_distance_total,
    revision_right_pupillary_distance,
    revision_left_pupillary_distance,
    revision_right_height,
    revision_left_height,
    nullif(btrim(revision_notes), ''),
    nullif(btrim(revision_change_reason), ''),
    actor_user_id
  )
  returning id into new_revision_id;

  return jsonb_build_object(
    'prescriptionId', prescription_row.id,
    'revisionId', new_revision_id,
    'revisionNumber', next_revision_number
  );
end;
$$;

revoke all on function public.create_prescription_revision(
  bigint, bigint, bigint, bigint, date, text,
  numeric, numeric, smallint, numeric, numeric, text,
  numeric, numeric, smallint, numeric, numeric, text,
  numeric, numeric, numeric, numeric, numeric, text, text
) from public, anon;

grant execute on function public.create_prescription_revision(
  bigint, bigint, bigint, bigint, date, text,
  numeric, numeric, smallint, numeric, numeric, text,
  numeric, numeric, smallint, numeric, numeric, text,
  numeric, numeric, numeric, numeric, numeric, text, text
) to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'prescription-originals',
  'prescription-originals',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.can_access_prescription_object(
  object_name text,
  require_write boolean
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  path_parts text[];
  object_organization_id bigint;
  object_branch_id bigint;
  object_prescription_id bigint;
  object_revision_id bigint;
begin
  if (select auth.uid()) is null
    or object_name !~ '^[0-9]+/[0-9]+/[0-9]+/[0-9]+/[^/]+$'
  then
    return false;
  end if;

  path_parts := string_to_array(object_name, '/');
  object_organization_id := path_parts[1]::bigint;
  object_branch_id := path_parts[2]::bigint;
  object_prescription_id := path_parts[3]::bigint;
  object_revision_id := path_parts[4]::bigint;

  return exists (
    select 1
    from public.prescriptions prescription
    join public.prescription_revisions revision
      on revision.prescription_id = prescription.id
      and revision.organization_id = prescription.organization_id
      and revision.branch_id = prescription.branch_id
    where prescription.id = object_prescription_id
      and prescription.organization_id = object_organization_id
      and prescription.branch_id = object_branch_id
      and revision.id = object_revision_id
      and (
        case
          when require_write then private.can_write_branch_clinical_data(
            object_organization_id,
            object_branch_id
          )
          else private.can_read_branch_clinical_data(
            object_organization_id,
            object_branch_id
          )
        end
      )
  );
end;
$$;

revoke all on function private.can_access_prescription_object(text, boolean)
from public, anon, authenticated;

create policy prescription_originals_select
on storage.objects for select to authenticated
using (
  bucket_id = 'prescription-originals'
  and (select private.can_access_prescription_object(name, false))
);

create policy prescription_originals_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'prescription-originals'
  and owner_id = (select auth.uid()::text)
  and (select private.can_access_prescription_object(name, true))
);

create policy prescription_originals_delete_unregistered
on storage.objects for delete to authenticated
using (
  bucket_id = 'prescription-originals'
  and owner_id = (select auth.uid()::text)
  and (select private.can_access_prescription_object(name, true))
  and not exists (
    select 1
    from public.prescription_files file_record
    where file_record.storage_path = name
  )
);
