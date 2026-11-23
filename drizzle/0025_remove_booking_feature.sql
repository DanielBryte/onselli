-- Retain any historical booking data while taking the feature out of the active schema.
UPDATE pages
SET draft_content = jsonb_set(
  draft_content,
  '{sections}',
  COALESCE((
    SELECT jsonb_agg(section ORDER BY ordinal)
    FROM jsonb_array_elements(draft_content->'sections') WITH ORDINALITY AS item(section, ordinal)
    WHERE section->>'type' <> 'booking'
  ), '[]'::jsonb),
  true
)
WHERE jsonb_typeof(draft_content->'sections') = 'array';
--> statement-breakpoint
UPDATE pages
SET published_content = jsonb_set(
  published_content,
  '{sections}',
  COALESCE((
    SELECT jsonb_agg(section ORDER BY ordinal)
    FROM jsonb_array_elements(published_content->'sections') WITH ORDINALITY AS item(section, ordinal)
    WHERE section->>'type' <> 'booking'
  ), '[]'::jsonb),
  true
)
WHERE jsonb_typeof(published_content->'sections') = 'array';
--> statement-breakpoint
ALTER TABLE bookings RENAME TO archived_bookings;
--> statement-breakpoint
ALTER TABLE availability_overrides RENAME TO archived_availability_overrides;
--> statement-breakpoint
ALTER TABLE availability_rules RENAME TO archived_availability_rules;
--> statement-breakpoint
ALTER TABLE booking_services RENAME TO archived_booking_services;
--> statement-breakpoint
ALTER TYPE booking_status RENAME TO archived_booking_status;
