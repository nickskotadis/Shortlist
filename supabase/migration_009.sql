-- migration_009.sql
-- Harden handle_new_user() — pin search_path and schema-qualify the insert.
--
-- The original function (schema.sql) ran as SECURITY DEFINER without
-- `SET search_path` and referenced the unqualified `profiles` table. Under a
-- hardened/empty search_path this fails at signup with "Database error saving
-- new user", because `profiles` can't be resolved. CREATE OR REPLACE re-defines
-- the function body in place; the existing on_auth_user_created trigger keeps
-- pointing at it, so no trigger drop/recreate is required.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
