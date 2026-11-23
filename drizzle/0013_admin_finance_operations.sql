ALTER TABLE "disputes"
  ADD COLUMN "reason" text,
  ADD COLUMN "is_response_editable" boolean NOT NULL DEFAULT false;
