-- Register through the game FIRST. Replace only the email below, then run in
-- Supabase SQL Editor as the project owner. Never run this in browser code.
update public.ti_profiles
set role = 'ADMIN'
where id = (
  select id from auth.users where lower(email) = lower('YOUR_REGISTERED_EMAIL@example.com')
)
returning username, role;
-- Exactly one returned row means success. Zero rows means the email was not found.
