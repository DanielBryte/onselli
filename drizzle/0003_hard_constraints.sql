CREATE EXTENSION IF NOT EXISTS citext;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE bookings
  ADD CONSTRAINT bookings_creator_slot_excl
  EXCLUDE USING gist (
    creator_id WITH =,
    tstzrange(blocked_from, blocked_until, '[)') WITH &&
  ) WHERE (status IN ('pending_payment', 'confirmed'));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_ledger_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'ledger entries are append-only';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER ledger_entries_immutable
  BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();
