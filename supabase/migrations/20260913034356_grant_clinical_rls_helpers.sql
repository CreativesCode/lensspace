-- RLS policies execute these non-exposed helpers as the authenticated role.
-- Keeping them in private prevents direct Data API exposure.

grant execute on function private.can_read_branch_clinical_data(bigint, bigint)
to authenticated;
grant execute on function private.can_write_branch_clinical_data(bigint, bigint)
to authenticated;
