-- RLS policies execute these helpers as the authenticated role. The private
-- schema is not exposed through the Data API, so they remain unavailable as RPCs.

grant execute on function private.has_commercial_catalog_access(bigint)
to authenticated;
grant execute on function private.can_manage_commercial_catalog(bigint)
to authenticated;
