-- QA-05: the storage policies of the private prescription-originals bucket call this
-- check as `authenticated`, but EXECUTE was revoked and never granted, so every upload
-- and download failed. The function is SECURITY DEFINER with a fixed search_path and
-- only validates the object path against the caller's clinical access.
grant execute on function private.can_access_prescription_object(text, boolean) to authenticated;
