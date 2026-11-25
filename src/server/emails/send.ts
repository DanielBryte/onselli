import { render } from '@react-email/render';
import { AccountActionEmail, type AccountEmailAction } from './AccountActionEmail';
import { FormSubmissionEmail } from './FormSubmissionEmail';
import { getEnv } from '../config/env';

type EmailAddress = { address: string; name?: string };

function configuredApiKey(value: string) {
  // CPaaS's UI may show the key with its header prefix. Accept either that
  // complete value or the raw key, then add the prefix exactly once below.
  return value.trim().replace(/^(?:authorization:\s*)?zoho-enczapikey\s+/i, '').trim();
}

function configuredFrom(): EmailAddress {
  const env = getEnv();
  if (!env.ZEPTOMAIL_FROM_EMAIL) throw new Error('ZeptoMail sender address is not configured.');
  return { address: env.ZEPTOMAIL_FROM_EMAIL, ...(env.ZEPTOMAIL_FROM_NAME ? { name: env.ZEPTOMAIL_FROM_NAME } : {}) };
}

export async function sendTransactionalEmail(input: { to: string; subject: string; html: string; text?: string; category?: string }) {
  const { ZEPTOMAIL_SEND_API_KEY: configuredKey, ZEPTOMAIL_API_URL: apiUrl, ZEPTOMAIL_FROM_EMAIL: fromEmail, ZEPTOMAIL_BOUNCE_ADDRESS: bounceAddress } = getEnv();
  const apiKey = configuredKey ? configuredApiKey(configuredKey) : '';
  if (!apiKey || !apiUrl || !fromEmail || !bounceAddress) {
    throw new Error('Transactional email is not fully configured. Set ZEPTOMAIL_API_URL, ZEPTOMAIL_SEND_API_KEY, ZEPTOMAIL_FROM_EMAIL, and the verified ZEPTOMAIL_BOUNCE_ADDRESS from your Zoho CPaaS agent.');
  }

  let response: Response;
  try {
    response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Zoho-enczapikey ${apiKey}`,
      },
      body: JSON.stringify({
        from: configuredFrom(),
        bounce_address: bounceAddress,
        to: [{ email_address: { address: input.to } }],
        subject: input.subject,
        htmlbody: input.html,
        ...(input.text ? { textbody: input.text } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    // Do not log request bodies, addresses, credentials, or provider URLs.
    console.error('[email] ZeptoMail request failed.', { errorType: error instanceof Error ? error.name : 'UnknownError' });
    throw new Error('Transactional email could not be delivered. Please try again later.');
  }
  const responseBody = await response.text();
  let result: {
    message?: string;
    code?: string;
    error_code?: string;
    error?: {
      message?: string;
      code?: string;
      request_id?: string;
      details?: Array<{ code?: string; message?: string; target?: string }>;
    };
    data?: { error_code?: string };
    request_id?: string;
  } | null = null;
  try { result = JSON.parse(responseBody); } catch { /* Non-JSON provider errors are logged by status and content type only. */ }
  if (!response.ok) {
    console.error('[email] ZeptoMail rejected a transactional message.', {
      category: input.category ?? 'transactional',
      status: response.status,
      contentType: response.headers.get('content-type'),
      providerCode: result?.error?.code ?? result?.error_code ?? result?.data?.error_code ?? result?.code,
      providerSubcode: result?.error?.details?.[0]?.code,
      providerTarget: result?.error?.details?.[0]?.target,
      requestId: result?.error?.request_id ?? result?.request_id ?? response.headers.get('x-request-id') ?? response.headers.get('x-zoho-request-id'),
    });
    throw new Error('Transactional email could not be delivered. Please try again later.');
  }
  console.info('[email] ZeptoMail accepted a transactional message.', {
    category: input.category ?? 'transactional',
    requestId: result?.request_id,
  });
}

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!); }

export async function sendPurchaseReceiptEmail(input: { to: string; orderNumber: string; title: string; includedTitles?: string[]; amount: string; currency: string; accessUrl?: string }) {
  const title = escapeHtml(input.title);
  const products = (input.includedTitles?.length ? input.includedTitles : [input.title]).map((name) => `<li>${escapeHtml(name)}</li>`).join('');
  const access = input.accessUrl ? `<p>Your purchase is ready. Open it using the secure link below. This link verifies your email and starts a private session.</p><p><a href="${escapeHtml(input.accessUrl)}" style="display:inline-block;background:#014733;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Access your purchase</a></p><p style="font-size:13px;color:#52645b">The link expires in 30 minutes. If it expires, request a fresh access email from the purchase access page.</p>` : '<p>Your payment is confirmed. Keep this email as your receipt.</p>';
  await sendTransactionalEmail({ to: input.to, subject: `Receipt for ${input.title}`, html: `<main style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#17251b"><p style="color:#176343;font-weight:bold">ONSELLI</p><h1>Payment confirmed</h1><p>Order ${escapeHtml(input.orderNumber)}</p><ul>${products}</ul><p><strong>${escapeHtml(input.amount)} ${escapeHtml(input.currency)}</strong></p>${access}<p style="color:#718077;font-size:12px">This is a transactional receipt. It does not subscribe you to marketing emails.</p></main>`, text: `Payment confirmed. Order ${input.orderNumber}. ${input.title}. ${input.amount} ${input.currency}.${input.accessUrl ? ` Access your purchase: ${input.accessUrl}` : ''}` });
}

async function sendAccountEmail(to: string, action: AccountEmailAction, url: string) {
  const appUrl = getEnv().NEXT_PUBLIC_APP_URL;
  const isVerification = action === 'verify';
  const subject = isVerification ? 'Verify your Onselli email' : 'Reset your Onselli password';
  const html = await render(AccountActionEmail({ action, actionUrl: url, appUrl }));
  await sendTransactionalEmail({
    to,
    subject,
    html,
    text: isVerification
      ? `Verify your email\n\nConfirm this email address to finish setting up your Onselli account.\n\nVerify your email: ${url}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email. Never share this link.`
      : `Reset your password\n\nWe received a request to change the password for your Onselli account.\n\nChoose a new password: ${url}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email. Never share this link.`,
    category: isVerification ? 'account-verification' : 'password-reset',
  });
}

export const sendVerificationEmail = (to: string, url: string) => sendAccountEmail(to, 'verify', url);
export const sendPasswordResetEmail = (to: string, url: string) => sendAccountEmail(to, 'reset-password', url);

export async function sendFormEmail(input: { to: string; creatorName: string; formTitle: string; formUrl: string; confirmation?: string }) {
  const confirmation = Boolean(input.confirmation);
  const html = await render(FormSubmissionEmail(input));
  await sendTransactionalEmail({
    to: input.to,
    subject: confirmation ? 'We received your response' : 'New response: ' + input.formTitle,
    html,
  });
}
