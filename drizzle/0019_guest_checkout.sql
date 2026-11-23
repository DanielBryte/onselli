CREATE TABLE guest_buyers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  email_verified_at timestamptz,
  claimed_user_id uuid REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX guest_buyers_email_uq ON guest_buyers (lower(email));--> statement-breakpoint

ALTER TABLE orders ADD COLUMN guest_buyer_id uuid REFERENCES guest_buyers(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE orders ADD COLUMN buyer_email text;--> statement-breakpoint
CREATE INDEX orders_guest_buyer_idx ON orders(guest_buyer_id);--> statement-breakpoint
ALTER TABLE orders ADD CONSTRAINT orders_single_buyer_principal_check CHECK (NOT (buyer_user_id IS NOT NULL AND guest_buyer_id IS NOT NULL));--> statement-breakpoint

CREATE TABLE guest_purchase_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_buyer_id uuid NOT NULL REFERENCES guest_buyers(id) ON DELETE CASCADE,
  order_id uuid NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX guest_purchase_tokens_expiry_idx ON guest_purchase_tokens(expires_at);--> statement-breakpoint

CREATE TABLE guest_access_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_buyer_id uuid NOT NULL REFERENCES guest_buyers(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX guest_access_sessions_guest_idx ON guest_access_sessions(guest_buyer_id, expires_at);--> statement-breakpoint

ALTER TABLE entitlements ALTER COLUMN user_id DROP NOT NULL;--> statement-breakpoint
ALTER TABLE entitlements ADD COLUMN guest_buyer_id uuid REFERENCES guest_buyers(id) ON DELETE CASCADE;--> statement-breakpoint
DROP INDEX IF EXISTS entitlements_active_user_product_uq;--> statement-breakpoint
CREATE UNIQUE INDEX entitlements_active_user_product_uq ON entitlements(user_id, product_id) WHERE status = 'active' AND user_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX entitlements_active_guest_product_uq ON entitlements(guest_buyer_id, product_id) WHERE status = 'active' AND guest_buyer_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX entitlements_guest_idx ON entitlements(creator_id, guest_buyer_id);--> statement-breakpoint
ALTER TABLE entitlements ADD CONSTRAINT entitlements_single_principal_check CHECK ((user_id IS NOT NULL AND guest_buyer_id IS NULL) OR (user_id IS NULL AND guest_buyer_id IS NOT NULL));--> statement-breakpoint

ALTER TABLE lesson_progress ALTER COLUMN user_id DROP NOT NULL;--> statement-breakpoint
ALTER TABLE lesson_progress ADD COLUMN guest_buyer_id uuid REFERENCES guest_buyers(id) ON DELETE CASCADE;--> statement-breakpoint
DROP INDEX IF EXISTS lesson_progress_user_lesson_uq;--> statement-breakpoint
CREATE UNIQUE INDEX lesson_progress_user_lesson_uq ON lesson_progress(user_id, lesson_id) WHERE user_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX lesson_progress_guest_lesson_uq ON lesson_progress(guest_buyer_id, lesson_id) WHERE guest_buyer_id IS NOT NULL;--> statement-breakpoint
ALTER TABLE lesson_progress ADD CONSTRAINT lesson_progress_single_principal_check CHECK ((user_id IS NOT NULL AND guest_buyer_id IS NULL) OR (user_id IS NULL AND guest_buyer_id IS NOT NULL));--> statement-breakpoint

ALTER TABLE quiz_attempts ALTER COLUMN user_id DROP NOT NULL;--> statement-breakpoint
ALTER TABLE quiz_attempts ADD COLUMN guest_buyer_id uuid REFERENCES guest_buyers(id) ON DELETE CASCADE;--> statement-breakpoint
DROP INDEX IF EXISTS quiz_attempts_one_open_per_user_quiz_uq;--> statement-breakpoint
CREATE UNIQUE INDEX quiz_attempts_one_open_per_user_quiz_uq ON quiz_attempts(user_id, quiz_id) WHERE status = 'in_progress' AND user_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX quiz_attempts_one_open_per_guest_quiz_uq ON quiz_attempts(guest_buyer_id, quiz_id) WHERE status = 'in_progress' AND guest_buyer_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX quiz_attempts_guest_quiz_version_idx ON quiz_attempts(guest_buyer_id, quiz_id, quiz_version, started_at);--> statement-breakpoint
ALTER TABLE quiz_attempts ADD CONSTRAINT quiz_attempts_single_principal_check CHECK ((user_id IS NOT NULL AND guest_buyer_id IS NULL) OR (user_id IS NULL AND guest_buyer_id IS NOT NULL));--> statement-breakpoint
