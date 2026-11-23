import { serve } from '@upstash/workflow/nextjs';
import { runMaintenanceTask } from '@/src/server/jobs/functions';

const supportedTasks = ['recover-campaigns', 'expire-orders', 'release-creator-holds', 'reconcile-payouts'] as const;
type MaintenancePayload = { task: (typeof supportedTasks)[number] };

export const runtime = 'nodejs';
export const { POST } = serve<MaintenancePayload>(async (context) => {
  const { task } = context.requestPayload;
  if (!supportedTasks.includes(task)) throw new Error('Unsupported maintenance workflow task.');
  return context.run(`maintenance-${task}`, () => runMaintenanceTask(task));
});
