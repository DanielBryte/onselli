import { Client } from '@upstash/qstash';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

const token = process.env.QSTASH_TOKEN;
const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
const devMode = process.env.QSTASH_DEV === 'true';

if (!appUrl) throw new Error('Set NEXT_PUBLIC_APP_URL before synchronizing schedules.');
if (devMode) {
  const localUrl = new URL(appUrl);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(localUrl.hostname)) throw new Error('With QSTASH_DEV=true, NEXT_PUBLIC_APP_URL must point to localhost.');
} else {
  if (!token) throw new Error('QSTASH_TOKEN is required to synchronize deployed schedules.');
  if (!/^https:\/\//.test(appUrl)) throw new Error('Set NEXT_PUBLIC_APP_URL to the deployed HTTPS origin before synchronizing schedules.');
}

const client = new Client({ token: token ?? '', devMode });
const jobs = [
  { scheduleId: 'onselli-recover-campaigns', cron: '*/2 * * * *', task: 'recover-campaigns' },
  { scheduleId: 'onselli-expire-orders', cron: '*/5 * * * *', task: 'expire-orders' },
  { scheduleId: 'onselli-release-creator-holds', cron: '0 * * * *', task: 'release-creator-holds' },
  { scheduleId: 'onselli-reconcile-payouts', cron: '*/5 * * * *', task: 'reconcile-payouts' },
];

for (const job of jobs) {
  const result = await client.schedules.create({
    scheduleId: job.scheduleId,
    destination: `${appUrl}/api/workflows/maintenance`,
    cron: job.cron,
    body: JSON.stringify({ task: job.task }),
    headers: { 'Content-Type': 'application/json' },
    retries: 3,
  });
  console.log(`Synchronized ${job.scheduleId} (${result.scheduleId})`);
}
