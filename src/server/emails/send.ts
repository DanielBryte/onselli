import { render } from '@react-email/render';
import { FormSubmissionEmail } from './FormSubmissionEmail';
import { getEnv } from '../config/env';

type EmailAddress = { address: string; name?: string };

function configuredFrom(): EmailAddress {
  const env = getEnv();
  if (!env.ZEPTOMAIL_FROM_EMAIL) throw new Error('ZeptoMail sender address is not configured.');
  return { address: env.ZEPTOMAIL_FROM_EMAIL, ...(env.ZEPTOMAIL_FROM_NAME ? { name: env.ZEPTOMAIL_FROM_NAME } : {}) };
}

export async function sendTransactionalEmail(input: { to: string; subject: string; html: string; text?: string }) {
  const { ZEPTOMAIL_SEND_API_KEY: apiKey, ZEPTOMAIL_API_URL: apiUrl, ZEPTOMAIL_FROM_EMAIL: fromEmail } = getEnv();
  if (!apiKey || !apiUrl || !fromEmail) {
    throw new Error('Transactional email is not fully configured. Set ZEPTOMAIL_API_URL, ZEPTOMAIL_SEND_API_KEY, and ZEPTOMAIL_FROM_EMAIL.');
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
  const result = await response.json().catch(() => null) as { message?: string; error?: { message?: string }; request_id?: string } | null;
  if (!response.ok) {
    console.error('[email] ZeptoMail rejected a transactional message.', {
      status: response.status,
      requestId: result?.request_id,
    });
    throw new Error('Transactional email could not be delivered. Please try again later.');
  }
}

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!); }

export async function sendPurchaseReceiptEmail(input: { to: string; orderNumber: string; title: string; includedTitles?: string[]; amount: string; currency: string; accessUrl?: string }) {
  const title = escapeHtml(input.title);
  const products = (input.includedTitles?.length ? input.includedTitles : [input.title]).map((name) => `<li>${escapeHtml(name)}</li>`).join('');
  const access = input.accessUrl ? `<p>Your purchase is ready. Open it using the secure link below. This link verifies your email and starts a private session.</p><p><a href="${escapeHtml(input.accessUrl)}" style="display:inline-block;background:#014733;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Access your purchase</a></p><p style="font-size:13px;color:#52645b">The link expires in 30 minutes. If it expires, request a fresh access email from the purchase access page.</p>` : '<p>Your payment is confirmed. Keep this email as your receipt.</p>';
  await sendTransactionalEmail({ to: input.to, subject: `Receipt for ${input.title}`, html: `<main style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#17251b"><p style="color:#176343;font-weight:bold">ONSELLI</p><h1>Payment confirmed</h1><p>Order ${escapeHtml(input.orderNumber)}</p><ul>${products}</ul><p><strong>${escapeHtml(input.amount)} ${escapeHtml(input.currency)}</strong></p>${access}<p style="color:#718077;font-size:12px">This is a transactional receipt. It does not subscribe you to marketing emails.</p></main>`, text: `Payment confirmed. Order ${input.orderNumber}. ${input.title}. ${input.amount} ${input.currency}.${input.accessUrl ? ` Access your purchase: ${input.accessUrl}` : ''}` });
}

async function sendAccountEmail(to: string, subject: string, heading: string, url: string) {
  const appUrl = getEnv().NEXT_PUBLIC_APP_URL;
  const safeUrl = escapeHtml(url);
  await sendTransactionalEmail({
    to,
    subject,
    html: `<main style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#17251b"><p style="color:#176343;font-weight:bold">ONSELLI</p><h1>${heading}</h1><p>Use the secure link below to continue with your Onselli account.</p><p><a href="${safeUrl}" style="display:inline-block;background:#014733;color:white;padding:12px 18px;border-radius:8px;text-decoration:none">Continue to Onselli</a></p><p style="color:#718077;font-size:12px">If you did not request this, you can ignore this message.</p><a href="${escapeHtml(appUrl)}" style="color:#718077;font-size:12px">onselli.com</a></main>`,
    text: `${heading}\n\nUse this secure link to continue with your Onselli account: ${url}\n\nIf you did not request this, you can ignore this message.`,
  });
}

export const sendVerificationEmail = (to: string, url: string) => sendAccountEmail(to, 'Verify your Onselli email', 'Verify your email', url);
export const sendPasswordResetEmail = (to: string, url: string) => sendAccountEmail(to, 'Reset your Onselli password', 'Choose a new password', url);

export async function sendFormEmail(input: { to: string; creatorName: string; formTitle: string; formUrl: string; confirmation?: string }) {
  const confirmation = Boolean(input.confirmation);
  const html = await render(FormSubmissionEmail(input));
  await sendTransactionalEmail({
    to: input.to,
    subject: confirmation ? 'We received your response' : 'New response: ' + input.formTitle,
    html,
  });
}
