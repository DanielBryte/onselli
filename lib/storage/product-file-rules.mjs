export function ownsProductFile(file, { creatorId, productId }) {
  return Boolean(file && file.creatorId === creatorId && file.productId === productId);
}

export function validateProductFileCompletion(file, object, maxBytes) {
  if (!file || !object) return 'The uploaded file could not be verified.';
  const expectedBytes = Number(file.sizeBytes);
  if (!Number.isSafeInteger(expectedBytes) || expectedBytes < 1 || expectedBytes > maxBytes) return 'The declared file size is invalid.';
  if (!Number.isSafeInteger(object.contentLength) || object.contentLength !== expectedBytes || object.contentLength > maxBytes) return 'The uploaded file size does not match.';
  if (typeof object.contentType !== 'string' || object.contentType !== file.contentType) return 'The uploaded file type does not match.';
  if (!hasExpectedFileSignature(file.name, object.signatureBytes)) return 'The uploaded content does not match the selected file type.';
  return null;
}

function hasExpectedFileSignature(name, value) {
  if (!(value instanceof Uint8Array) || value.length < 4) return false;
  const extension = name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0];
  const starts = (...bytes) => bytes.every((byte, index) => value[index] === byte);
  if (extension === '.pdf') return new TextDecoder().decode(value.slice(0, 5)) === '%PDF-';
  if (extension === '.png') return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  if (extension === '.jpg' || extension === '.jpeg') return starts(0xff, 0xd8, 0xff);
  if (extension === '.webp') return starts(0x52, 0x49, 0x46, 0x46) && new TextDecoder().decode(value.slice(8, 12)) === 'WEBP';
  if (extension === '.gif') return ['GIF87a', 'GIF89a'].includes(new TextDecoder().decode(value.slice(0, 6)));
  if (extension === '.mp3') return new TextDecoder().decode(value.slice(0, 3)) === 'ID3' || (value[0] === 0xff && (value[1] & 0xe0) === 0xe0);
  if (['.m4a', '.mp4', '.mov'].includes(extension)) return new TextDecoder().decode(value.slice(4, 8)) === 'ftyp';
  if (extension === '.wav') return starts(0x52, 0x49, 0x46, 0x46) && new TextDecoder().decode(value.slice(8, 12)) === 'WAVE';
  if (extension === '.ogg') return new TextDecoder().decode(value.slice(0, 4)) === 'OggS';
  if (extension === '.webm') return starts(0x1a, 0x45, 0xdf, 0xa3);
  if (['.zip', '.epub', '.docx', '.pptx', '.xlsx'].includes(extension)) return starts(0x50, 0x4b, 0x03, 0x04) || starts(0x50, 0x4b, 0x05, 0x06) || starts(0x50, 0x4b, 0x07, 0x08);
  return false;
}

/** @param {{ file: any, entitlement: any, order: any, userId?: string | null, guestBuyerId?: string | null }} input */
export function canDownloadProductFile({ file, entitlement, order, userId = null, guestBuyerId = null }) {
  const principalMatches = userId ? entitlement?.userId === userId && order?.buyerUserId === userId
    : Boolean(guestBuyerId && entitlement?.guestBuyerId === guestBuyerId && order?.guestBuyerId === guestBuyerId);
  return Boolean(
    file && file.status === 'ready' && entitlement && entitlement.status === 'active' &&
    principalMatches && entitlement.productId === file.productId &&
    order && order.id === entitlement.orderId && order.status === 'paid',
  );
}

export function getDeliverableProductFiles(files, { creatorId, productId }) {
  return files.filter((file) => ownsProductFile(file, { creatorId, productId }) && file.status === 'ready');
}
