# Encargado regression

Run `node tests/encargado-regression.cjs` with `@electric-sql/pglite` installed in the test environment. It does not connect to Supabase or modify production.

Fixtures contain only database column metadata and two existing function definitions. All rows are fictitious. Checks cover restricted signup, legacy permissive RLS resistance, the operational DTO, assigned-only remitos and photo upload, photo-required/idempotent completion, production states, atomic/idempotent stock movements, preserved prices, existing Admin access and inactive-account rejection.

Visual checks use a local static render with fictitious rows. Production checks must be repeated after migration and deployment, before creating Juan. Do not create or assign real work for testing without approval.
