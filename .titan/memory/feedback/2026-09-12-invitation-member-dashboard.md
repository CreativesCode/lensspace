# Invitation and member dashboard corrections

Date: 2026-09-12
Source: user testing against the local application on port 3001.

## Confirmed corrections

- Supabase invitation links can return an implicit session in the URL fragment at
  `/auth/callback`. The application must keep that route and support fragment
  sessions as well as PKCE codes and token-hash links.
- Invitation and recovery callbacks must remove session material from the visible
  URL, then send the user through password creation before the dashboard.
- A successful membership activation is not sufficient UX. The dashboard must
  render a role-specific landing view for sellers and external providers rather
  than showing only platform-admin and owner content.
- Active members may read their organization's enabled module keys, but negotiated
  subscription amounts remain owner/platform-admin data.

Evidence: the user reproduced the missing callback and empty member dashboard;
both corrections were implemented and verified with HTTP, build and transactional
RLS checks.
