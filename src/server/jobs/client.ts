import { Client, type TriggerOptions } from '@upstash/workflow';
import { getEnv } from '../config/env';

let client: Client | undefined;

function getWorkflowClient() {
  if (!client) {
    const env = getEnv();
    client = new Client({ token: env.QSTASH_TOKEN, devMode: env.QSTASH_DEV === 'true' });
  }
  return client;
}

export async function triggerWorkflow<TBody extends Record<string, unknown>>(
  path: '/api/workflows/campaign-dispatch' | '/api/workflows/form-notification',
  body: TBody,
  options: Pick<TriggerOptions, 'delay' | 'workflowRunId' | 'flowControl'> = {},
) {
  const baseUrl = getEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  return getWorkflowClient().trigger({
    url: `${baseUrl}${path}`,
    body,
    retries: 3,
    ...options,
  });
}
