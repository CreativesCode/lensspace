-- Cover every Phase 3 foreign key with its leading columns in FK order.

create index customers_branch_organization_idx
  on public.customers (branch_id, organization_id);
create index customers_created_by_idx
  on public.customers (created_by);
create index customer_phones_customer_organization_branch_idx
  on public.customer_phones (customer_id, organization_id, branch_id);
create index prescriptions_customer_organization_branch_idx
  on public.prescriptions (customer_id, organization_id, branch_id);
create index prescriptions_created_by_idx
  on public.prescriptions (created_by);
create index prescription_revisions_prescription_organization_branch_idx
  on public.prescription_revisions (
    prescription_id,
    organization_id,
    branch_id
  );
create index prescription_files_prescription_organization_branch_idx
  on public.prescription_files (prescription_id, organization_id, branch_id);
create index prescription_files_revision_prescription_organization_branch_idx
  on public.prescription_files (
    revision_id,
    prescription_id,
    organization_id,
    branch_id
  );
create index prescription_files_uploaded_by_idx
  on public.prescription_files (uploaded_by);
