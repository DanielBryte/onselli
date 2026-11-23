CREATE TABLE "course_quizzes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lesson_id" uuid NOT NULL UNIQUE REFERENCES "lessons"("id") ON DELETE CASCADE,
  "creator_id" uuid NOT NULL REFERENCES "creators"("id") ON DELETE CASCADE,
  "version" integer NOT NULL DEFAULT 1,
  "questions" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "passing_score" integer NOT NULL DEFAULT 70,
  "max_attempts" integer,
  "reveal_correct_answers" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "course_quizzes_version_check" CHECK ("version" > 0),
  CONSTRAINT "course_quizzes_passing_score_check" CHECK ("passing_score" BETWEEN 1 AND 100),
  CONSTRAINT "course_quizzes_max_attempts_check" CHECK ("max_attempts" IS NULL OR "max_attempts" BETWEEN 1 AND 10)
);
--> statement-breakpoint
CREATE INDEX "course_quizzes_creator_idx" ON "course_quizzes" ("creator_id", "lesson_id");
--> statement-breakpoint

CREATE TABLE "quiz_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "quiz_id" uuid NOT NULL REFERENCES "course_quizzes"("id") ON DELETE CASCADE,
  "creator_id" uuid NOT NULL REFERENCES "creators"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "quiz_version" integer NOT NULL,
  "quiz_snapshot" jsonb NOT NULL,
  "answers" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "score" integer,
  "passed" boolean,
  "status" text NOT NULL DEFAULT 'in_progress',
  "started_at" timestamp with time zone NOT NULL DEFAULT now(),
  "submitted_at" timestamp with time zone,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "quiz_attempts_status_check" CHECK ("status" IN ('in_progress','submitted')),
  CONSTRAINT "quiz_attempts_version_check" CHECK ("quiz_version" > 0),
  CONSTRAINT "quiz_attempts_score_check" CHECK ("score" IS NULL OR "score" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE INDEX "quiz_attempts_learner_quiz_version_idx" ON "quiz_attempts" ("user_id", "quiz_id", "quiz_version", "started_at");
--> statement-breakpoint
CREATE INDEX "quiz_attempts_creator_idx" ON "quiz_attempts" ("creator_id", "quiz_id", "started_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_attempts_one_open_per_user_quiz_uq" ON "quiz_attempts" ("user_id", "quiz_id") WHERE "status" = 'in_progress';
