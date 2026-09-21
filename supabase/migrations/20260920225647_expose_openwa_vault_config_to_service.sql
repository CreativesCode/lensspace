-- Allow only the Edge Function service role to retrieve the project-wide
-- OpenWA runtime configuration encrypted in Supabase Vault.
create or replace function public.get_openwa_runtime_config()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_object_agg(secret.name, secret.decrypted_secret)
  from vault.decrypted_secrets secret
  where secret.name in (
    'vision_studio_project_url',
    'vision_studio_wa_notify_secret',
    'vision_studio_openwa_base_url',
    'vision_studio_openwa_api_key',
    'vision_studio_openwa_session_id',
    'vision_studio_openwa_country_code'
  );
$$;

revoke all on function public.get_openwa_runtime_config()
  from public, anon, authenticated;
grant execute on function public.get_openwa_runtime_config()
  to service_role;
