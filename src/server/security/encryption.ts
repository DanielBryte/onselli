import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function encryptionKey() {
  const encoded = process.env.BANK_DATA_ENCRYPTION_KEY;
  if (!encoded) throw new Error('BANK_DATA_ENCRYPTION_KEY is required to store bank details.');
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32) throw new Error('BANK_DATA_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  return key;
}

export function encryptBankAccount(value: string) {
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv); const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]); const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

export function decryptBankAccount(value: string) {
  const [version, iv, tag, ciphertext] = value.split(':');
  if (version !== 'v1' || !iv || !tag || !ciphertext) throw new Error('Encrypted payout data is invalid.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64')); decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8');
}
