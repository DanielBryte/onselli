import { serve } from '@upstash/workflow/nextjs';
import { dispatchCampaign } from '@/src/server/jobs/functions';

export const runtime = 'nodejs';
export const { POST } = serve<{ campaignId: string; creatorId: string }>(dispatchCampaign);
