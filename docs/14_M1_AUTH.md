# M1 - owner-only authentication

Approved: email/password login, only Isna, no public registration. No financial
features are part of this milestone.

## Access boundary

- Supabase Auth manages passwords and sessions. No custom password storage.
- An authenticated identity must also have its own `profiles` row with `role=owner`.
- User metadata and email strings never grant owner access.
- Only an administrator provisions the owner profile for an explicit Auth UUID.
  There is no automatic first-user promotion or client-side profile creation.
- The schema supports the documented role values, but M1 grants access only to owner.
  A unique partial index permits only one owner profile in this single-owner app.
- RLS permits an owner to read only their own profile. No client insert/update/delete.
- Disable public signups and anonymous sign-ins in the Supabase dashboard.
- Next.js validates the session and profile on the server before rendering protected content.
- FastAPI verifies bearer tokens with the configured Supabase Auth service and reads
  the profile with the same user's token, preserving RLS. No service-role key is used.
- Authentication/provider failures fail closed; no tokens or passwords are logged.

## Routes and responses

- `/login`: email/password form, no signup link or account creation endpoint.
- `/`: protected shell. Missing session redirects to `/login`.
- `/access`: denied/unavailable access with a sign-out action; no financial content.
- `GET /api/v1/me`: verified owner UUID, display name, and role only.
  Missing/invalid/expired bearer tokens return 401; non-owner/missing profile returns
  403; unavailable or misconfigured authentication infrastructure returns 503.
- Health remains public and independent of Supabase. Protected responses are not cached.
- Logout ends the current Supabase session. Password recovery/admin account setup
  is performed through Supabase for this milestone; no recovery UI is promised.

## Visual reference

The supplied reference is `references/mobile-finance-reference.png`; the original
approved logo is `../web/public/brand/isna-finance-logo.png`. Preserve the original
artwork. Use restrained blue, light neutral backgrounds, white rounded surfaces,
clear headings, generous spacing, and mobile-first layouts. The reference's bank
transfers, investments, charts, balances, and AI insights do not add product scope.

Login and the protected shell receive initial styling in M1. Domain screens are
built with their milestones; dashboard metrics arrive in M6, broad visual QA in M10.

## Live activation

Apply the profiles migration to the development project, create the owner Auth user
through the dashboard, and run the separate bootstrap script with that user's UUID.
Never commit the real UUID, email, password, or project credentials as fixtures.
All automated tests use synthetic identities. A publishable key cannot perform
administrative provisioning; live activation is a separate required verification step.
