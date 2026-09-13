-- Cover every Phase 4 foreign key in constraint-column order.
create index quotation_items_catalog_item_idx on public.quotation_items (catalog_item_id) where catalog_item_id is not null;
create index quotation_items_parent_fk_idx on public.quotation_items (quotation_id, organization_id, branch_id);
create index quotations_branch_fk_idx on public.quotations (branch_id, organization_id);
create index quotations_customer_fk_idx on public.quotations (customer_id, organization_id, branch_id);
create index quotations_prescription_revision_idx on public.quotations (prescription_revision_id) where prescription_revision_id is not null;

create index order_items_catalog_item_idx on public.order_items (catalog_item_id) where catalog_item_id is not null;
create index order_items_parent_fk_idx on public.order_items (order_id, organization_id, branch_id);
create index orders_branch_fk_idx on public.orders (branch_id, organization_id);
create index orders_customer_fk_idx on public.orders (customer_id, organization_id, branch_id);
create index orders_prescription_revision_idx on public.orders (prescription_revision_id) where prescription_revision_id is not null;
create index orders_quotation_fk_idx on public.orders (quotation_id, organization_id, branch_id);
create index order_confirmations_parent_fk_idx on public.order_confirmations (order_id, organization_id, branch_id);
