ALTER TABLE orders ADD COLUMN checkout_key text;--> statement-breakpoint
CREATE UNIQUE INDEX orders_checkout_key_uq ON orders(checkout_key) WHERE checkout_key IS NOT NULL;--> statement-breakpoint
