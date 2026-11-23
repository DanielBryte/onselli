import { serve } from '@upstash/workflow/nextjs';
import { notifyFormSubmission } from '@/src/server/jobs/functions';

export const runtime = 'nodejs';
export const { POST } = serve<{ formId: string; creatorId: string; submissionId: string }>(notifyFormSubmission);
