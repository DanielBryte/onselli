ALTER TABLE "course_sections"
  ADD COLUMN "status" text NOT NULL DEFAULT 'published';
--> statement-breakpoint

ALTER TABLE "course_sections"
  ADD CONSTRAINT "course_sections_status_check" CHECK ("status" IN ('draft', 'published'));
--> statement-breakpoint

ALTER TABLE "lesson_attachments"
  ADD COLUMN "content_type" text NOT NULL DEFAULT 'application/octet-stream',
  ADD COLUMN "status" text NOT NULL DEFAULT 'ready',
  ADD COLUMN "position" integer NOT NULL DEFAULT 0;
--> statement-breakpoint

ALTER TABLE "lesson_attachments"
  ADD CONSTRAINT "lesson_attachments_status_check" CHECK ("status" IN ('pending', 'ready')),
  ADD CONSTRAINT "lesson_attachments_position_check" CHECK ("position" >= 0);
