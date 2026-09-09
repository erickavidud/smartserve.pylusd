# Smart Serve v9 — Supabase connected

This version connects the public Smart Serve dashboard to the Supabase `schools` table.

## Shared official data
The following fields are loaded from Supabase:
- name
- level
- enrollment
- participation
- coverage
- dispensers
- start_date
- school_days

The website calculates daily and cumulative environmental impact from those shared inputs.

## Security model
- Public visitors can read the official `schools` table through the RLS SELECT policy.
- The website does not expose public INSERT/UPDATE/DELETE operations.
- Official school changes should currently be made in the Supabase Table Editor.
- Potential simulator scenarios remain in each visitor's browser localStorage.

## Next upgrade
Add Supabase Auth and admin-only INSERT/UPDATE/DELETE policies so Eric can edit official schools from a protected Admin page.
