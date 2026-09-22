# Supabase

Reserved for Supabase PostgreSQL, Auth, and private Storage. M0 connects to no
project and runs without credentials or Docker. No migrations or data are applied.

M1 adds Auth, the owner profile, token validation, and initial RLS policies.
Later migrations must follow docs/10_POSTGRES_SCHEMA.md and be reviewed before
application. Use a separate development project and synthetic data only.
