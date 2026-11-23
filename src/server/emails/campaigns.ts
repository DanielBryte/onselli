import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { getEnv } from '../config/env';

const hex = (input: string | Buffer) => createHash('sha256').update(input).digest('hex');
const hmac = (key: string | Buffer, input: string) => createHmac('sha256', key).update(input).digest();

export function unsubscribeToken(recipientId: string) {
  const key = getEnv().BETTER_AUTH_SECRET;
  if (!key) throw new Error('BETTER_AUTH_SECRET is required to create unsubscribe links.');
  return `${recipientId}.${hmac(key, `email-unsubscribe:${recipientId}`).toString('base64url')}`;
}

export function verifyUnsubscribeToken(token: string) {
  const [recipientId, signature, ...rest] = token.split('.');
  if (!recipientId || !signature || rest.length || !/^[0-9a-f-]{36}$/i.test(recipientId)) return null;
  const key = getEnv().BETTER_AUTH_SECRET;
  if (!key) return null;
  const expected = hmac(key, `email-unsubscribe:${recipientId}`);
  let supplied: Buffer;
  try { supplied = Buffer.from(signature, 'base64url'); } catch { return null; }
  return supplied.length === expected.length && timingSafeEqual(supplied, expected) ? recipientId : null;
}

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

export function renderCampaignHtml(html: string, recipientId: string) {
  const appUrl = getEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  const url = `${appUrl}/email/unsubscribe?token=${encodeURIComponent(unsubscribeToken(recipientId))}`;
  const safeHtml = html.slice(0, 500_000)
    .replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '$1="#"');
  return `${safeHtml}<hr style="border:0;border-top:1px solid #e5e7eb;margin:32px 0 16px"><p style="font:12px Arial,sans-serif;color:#667085">You received this email because you opted in to marketing emails from this creator. <a href="${escapeHtml(url)}">Unsubscribe</a></p>`;
}

export function campaignTransportReady() {
  const env = getEnv();
  return Boolean(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.AWS_REGION && env.SES_FROM_EMAIL);
}

function awsSigningKey(secret: string, date: string, region: string) {
  const dateKey = hmac(`AWS4${secret}`, date);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, 'ses');
  return hmac(serviceKey, 'aws4_request');
}

export async function sendCampaignEmail(input: { recipientId: string; campaignId: string; to: string; subject: string; html: string; previewText?: string | null }) {
  const env = getEnv();
  const accessKey = env.AWS_ACCESS_KEY_ID;
  const secretKey = env.AWS_SECRET_ACCESS_KEY;
  const region = env.AWS_REGION;
  const from = env.SES_FROM_EMAIL;
  if (!accessKey || !secretKey || !region || !from) throw new Error('Amazon SES campaign sending is not configured.');
  const url = new URL(`https://email.${region}.amazonaws.com/v2/email/outbound-emails`);
  const html = renderCampaignHtml(input.html, input.recipientId);
  const text = html.replace(/<\s*br\s*\/?\s*>|<\s*\/\s*p\s*>/gi, '\n').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/\s+/g, ' ').trim();
  const body = JSON.stringify({
    FromEmailAddress: from,
    Destination: { ToAddresses: [input.to] },
    Content: { Simple: {
      Subject: { Data: input.subject, Charset: 'UTF-8' },
      Body: { Html: { Data: html, Charset: 'UTF-8' }, Text: { Data: text, Charset: 'UTF-8' } },
      Headers: [
        { Name: 'List-Unsubscribe', Value: `<${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}/api/email/unsubscribe?token=${encodeURIComponent(unsubscribeToken(input.recipientId))}>` },
        { Name: 'List-Unsubscribe-Post', Value: 'List-Unsubscribe=One-Click' },
        ...(input.previewText ? [{ Name: 'X-Preview-Text', Value: input.previewText.slice(0, 240) }] : []),
      ],
    } },
    ...(env.SES_CONFIGURATION_SET ? { ConfigurationSetName: env.SES_CONFIGURATION_SET } : {}),
    EmailTags: [{ Name: 'campaign_id', Value: input.campaignId }, { Name: 'recipient_id', Value: input.recipientId }],
  });
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = amzDate.slice(0, 8);
  const bodyHash = hex(body);
  const headers: Record<string, string> = {
    'content-type': 'application/json', host: url.host, 'x-amz-content-sha256': bodyHash, 'x-amz-date': amzDate,
  };
  if (env.AWS_SESSION_TOKEN) headers['x-amz-security-token'] = env.AWS_SESSION_TOKEN;
  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.keys(headers).sort().map((key) => `${key}:${(headers[key] ?? '').trim()}\n`).join('');
  const canonicalRequest = `POST\n${url.pathname}\n\n${canonicalHeaders.trimEnd()}\n${signedHeaders}\n${bodyHash}`;
  const scope = `${date}/${region}/ses/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${hex(canonicalRequest)}`;
  const signature = createHmac('sha256', awsSigningKey(secretKey, date, region)).update(stringToSign).digest('hex');
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const response = await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(15_000) });
  const result = await response.json().catch(() => ({})) as { MessageId?: string; message?: string; Message?: string };
  if (!response.ok) throw new Error(`Amazon SES rejected the campaign email (${response.status}): ${result.message ?? result.Message ?? 'provider error'}`);
  if (!result.MessageId) throw new Error('Amazon SES did not return a message ID.');
  return result.MessageId;
}
